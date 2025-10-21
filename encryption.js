// encryption-local.js - Web Crypto API local encryption implementation
const EncryptionLocal = {
    config: {
        saltVersion: 'safecare-v1-salt',
        ivLength: 12,
        iterations: 100000,
        algorithm: 'AES-GCM',
        keyLength: 256
    },

    // Session-only storage for derived key
    _derivedKey: null,
    _keyIdentifier: null,

    /**
     * Derive encryption key from user identity
     * @param {string} identifier - User email or unique identifier
     * @param {string} loginType - 'google' | 'apple' | 'email' | 'passkey'
     * @param {string} credential - Password or OAuth token (optional)
     * @returns {Promise<void>}
     */
    async deriveKeyFromIdentity(identifier, loginType, credential = null) {
        try {
            console.log(`Deriving encryption key from ${loginType} login for:`, identifier);

            let keyMaterial;
            const encoder = new TextEncoder();

            switch (loginType) {
                case 'google':
                case 'apple':
                    // Derive from verified email address
                    // For OAuth logins, the email IS the credential
                    keyMaterial = encoder.encode(
                        (credential || identifier) + this.config.saltVersion
                    );
                    break;

                case 'email':
                    // Derive from email + password
                    if (!credential) {
                        throw new Error('Password required for email login encryption');
                    }
                    keyMaterial = encoder.encode(identifier + credential + this.config.saltVersion);
                    break;

                case 'passkey':
                    // Derive from passkey credential ID
                    if (!credential) {
                        throw new Error('Passkey credential required for encryption');
                    }
                    keyMaterial = encoder.encode(identifier + credential + this.config.saltVersion);
                    break;

                default:
                    throw new Error(`Unknown login type: ${loginType}`);
            }

            // Import key material
            const importedKey = await crypto.subtle.importKey(
                'raw',
                keyMaterial,
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            // Derive AES-GCM key using PBKDF2
            this._derivedKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode(this.config.saltVersion),
                    iterations: this.config.iterations,
                    hash: 'SHA-256'
                },
                importedKey,
                {
                    name: this.config.algorithm,
                    length: this.config.keyLength
                },
                false,
                ['encrypt', 'decrypt']
            );

            this._keyIdentifier = await this.hashIdentifier(identifier);
            
            // Mark encryption as ready
            sessionStorage.setItem('encryptionReady', 'true');
            sessionStorage.setItem('encryptionType', 'local');
            
            console.log('✓ Encryption key derived successfully');
        } catch (error) {
            console.error('Error deriving encryption key:', error);
            throw error;
        }
    },

    /**
     * Hash identifier for verification without storing plaintext
     * @param {string} identifier - User identifier
     * @returns {Promise<string>} - Base64 hash
     */
    async hashIdentifier(identifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(identifier + this.config.saltVersion);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return btoa(String.fromCharCode(...hashArray));
    },

    /**
     * Check if encryption key is available
     * @returns {boolean}
     */
    isReady() {
        return this._derivedKey !== null;
    },

    /**
     * Clear encryption key from memory
     */
    clearKey() {
        this._derivedKey = null;
        this._keyIdentifier = null;
        sessionStorage.removeItem('encryptionReady');
        sessionStorage.removeItem('encryptionType');
        console.log('✓ Encryption key cleared from memory');
    },

    /**
     * Encrypt plaintext
     * @param {string} plaintext - Data to encrypt
     * @returns {Promise<string>} - Base64 encoded IV + ciphertext
     */
    async encrypt(plaintext) {
        if (!this.isReady()) {
            throw new Error('Encryption key not initialized. Please log in first.');
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(plaintext);

            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));

            // Encrypt data
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.config.algorithm,
                    iv: iv
                },
                this._derivedKey,
                data
            );

            // Combine IV and ciphertext
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Encode as Base64
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    },

    /**
     * Decrypt ciphertext
     * @param {string} encryptedData - Base64 encoded IV + ciphertext
     * @returns {Promise<string>} - Decrypted plaintext
     */
    async decrypt(encryptedData) {
        if (!this.isReady()) {
            throw new Error('Encryption key not initialized. Please log in first.');
        }

        try {
            // Decode from Base64
            const combined = new Uint8Array(
                atob(encryptedData).split('').map(c => c.charCodeAt(0))
            );

            // Extract IV and ciphertext
            const iv = combined.slice(0, this.config.ivLength);
            const data = combined.slice(this.config.ivLength);

            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.config.algorithm,
                    iv: iv
                },
                this._derivedKey,
                data
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Decryption failed - data may be corrupted or encrypted with different key');
        }
    },

    /**
     * Encrypt a JavaScript object
     * @param {Object} obj - Object to encrypt
     * @returns {Promise<string>} - Encrypted JSON string
     */
    async encryptObject(obj) {
        const json = JSON.stringify(obj);
        return await this.encrypt(json);
    },

    /**
     * Decrypt and parse a JavaScript object
     * @param {string} encryptedData - Encrypted data
     * @returns {Promise<Object>} - Decrypted object
     */
    async decryptObject(encryptedData) {
        const json = await this.decrypt(encryptedData);
        return JSON.parse(json);
    },

    /**
     * Get key metadata for verification
     * @returns {Object} - Key metadata
     */
    getKeyMetadata() {
        return {
            ready: this.isReady(),
            identifier: this._keyIdentifier,
            algorithm: this.config.algorithm,
            keyLength: this.config.keyLength,
            saltVersion: this.config.saltVersion
        };
    }
};

window.EncryptionLocal = EncryptionLocal;
