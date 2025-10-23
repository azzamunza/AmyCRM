// encryption.js - Encryption controller (routes to local or KMS)

const EncryptionService = {
    // Current active encryption module
    _activeModule: null,
    _loginType: null,

    /**
     * Initialize encryption based on login type
     * @param {string} identifier - User email or unique ID
     * @param {string} loginType - 'google' | 'apple' | 'email' | 'passkey'
     * @param {string} credential - Password or credential (optional)
     * @returns {Promise<void>}
     */
    async initializeFromLogin(identifier, loginType, credential = null) {
        try {
            console.log('Initializing encryption for', loginType, 'login');

            // Check if KMS is configured and active
            const useKMS = window.CRM_CONFIG?.USE_KMS === true && EncryptionKMS.config.active;

            if (useKMS) {
                console.log('Using Google Cloud KMS encryption');
                this._activeModule = EncryptionKMS;
                await EncryptionKMS.initialize(window.CRM_CONFIG.GCP_PROJECT_ID);
            } else {
                console.log('Using local Web Crypto API encryption');
                this._activeModule = EncryptionLocal;
                await EncryptionLocal.deriveKeyFromIdentity(identifier, loginType, credential);
            }

            this._loginType = loginType;
            console.log('✓ Encryption initialized successfully');
        } catch (error) {
            console.error('Failed to initialize encryption:', error);
            throw error;
        }
    },

    /**
     * Check if encryption is ready
     * @returns {boolean}
     */
    isReady() {
        return this._activeModule !== null && this._activeModule.isReady();
    },

    /**
     * Get current encryption type
     * @returns {string} - 'local' | 'kms' | 'none'
     */
    getEncryptionType() {
        if (!this._activeModule) return 'none';
        return this._activeModule === EncryptionLocal ? 'local' : 'kms';
    },

    /**
     * Clear encryption key on logout
     */
    clearKey() {
        if (this._activeModule) {
            this._activeModule.clearKey();
        }
        this._activeModule = null;
        this._loginType = null;
        console.log('✓ Encryption service cleared');
    },

    /**
     * Encrypt plaintext
     * @param {string} plaintext - Data to encrypt
     * @returns {Promise<string>} - Encrypted data
     */
    async encrypt(plaintext) {
        if (!this.isReady()) {
            throw new Error('Encryption not initialized - please log in first');
        }
        return await this._activeModule.encrypt(plaintext);
    },

    /**
     * Decrypt ciphertext
     * @param {string} encryptedData - Encrypted data
     * @returns {Promise<string>} - Decrypted plaintext
     */
    async decrypt(encryptedData) {
        if (!this.isReady()) {
            throw new Error('Encryption not initialized - please log in first');
        }
        return await this._activeModule.decrypt(encryptedData);
    },

    /**
     * Encrypt a JavaScript object
     * @param {Object} obj - Object to encrypt
     * @returns {Promise<string>} - Encrypted JSON
     */
    async encryptObject(obj) {
        if (!this.isReady()) {
            throw new Error('Encryption not initialized - please log in first');
        }
        return await this._activeModule.encryptObject(obj);
    },

    /**
     * Decrypt and parse a JavaScript object
     * @param {string} encryptedData - Encrypted data
     * @returns {Promise<Object>} - Decrypted object
     */
    async decryptObject(encryptedData) {
        if (!this.isReady()) {
            throw new Error('Encryption not initialized - please log in first');
        }
        return await this._activeModule.decryptObject(encryptedData);
    },

    /**
     * Get encryption metadata
     * @returns {Object} - Metadata about current encryption
     */
    getMetadata() {
        if (!this._activeModule) {
            return {
                ready: false,
                type: 'none',
                loginType: null
            };
        }

        return {
            ...this._activeModule.getKeyMetadata(),
            loginType: this._loginType,
            type: this.getEncryptionType()
        };
    },

    /**
     * Helper: Hash password for storage (one-way)
     * @param {string} password - Plain password
     * @returns {Promise<string>} - Base64 hashed password
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const salt = 'safecare-v1-salt';
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return btoa(String.fromCharCode(...hashArray));
    },

    /**
     * Helper: Verify password against hash
     * @param {string} password - Plain password
     * @param {string} hash - Stored hash
     * @returns {Promise<boolean>}
     */
    async verifyPassword(password, hash) {
        const computed = await this.hashPassword(password);
        return computed === hash;
    }
};

// Expose globally
window.EncryptionService = EncryptionService;
