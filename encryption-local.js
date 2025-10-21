// encryption-local.js — Local encryption (client-side, Web Crypto API)

const EncryptionLocal = {
    config: {
        salt: 'safecare-crm-salt-v1',
        iterations: 100000,
        keyLength: 256,
        ivLength: 12
    },

    _cachedKey: null,
    _metadata: null,

    getMetadata() {
        return this._metadata;
    },

    /**
     * Derives a symmetric encryption key based on login identity
     * @param {string} identifier - user email or unique ID
     * @param {string} loginType - 'email' | 'google' | 'apple' | 'passkey'
     * @param {string|null} credential - password, passkey credential, etc
     */
    async deriveKeyFromIdentity(identifier, loginType, credential = null) {
        try {
            const encoder = new TextEncoder();
            const salt = encoder.encode(this.config.salt);

            let keyMaterialInput;

            switch (loginType) {
                case 'email':
                    if (!credential) {
                        throw new Error('Password required for email login encryption');
                    }
                    keyMaterialInput = encoder.encode(identifier + ':' + credential);
                    break;

                case 'google':
                case 'apple':
                    // Derive deterministic key from verified email
                    keyMaterialInput = encoder.encode(identifier + ':oauth-derived');
                    break;

                case 'passkey':
                    if (!credential) {
                        throw new Error('Passkey credential missing for key derivation');
                    }
                    keyMaterialInput = encoder.encode(identifier + ':' + credential);
                    break;

                default:
                    throw new Error(`Unsupported login type: ${loginType}`);
            }

            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                keyMaterialInput,
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            const derivedKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt,
                    iterations: this.config.iterations,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: this.config.keyLength },
                false,
                ['encrypt', 'decrypt']
            );

            this._cachedKey = derivedKey;
            this._metadata = { derivedFrom: loginType, identifier };
            return derivedKey;

        } catch (err) {
            console.error('Error deriving encryption key:', err);
            throw err;
        }
    },

    async encrypt(plaintext) {
        if (!this._cachedKey) throw new Error('Encryption key not initialized');

        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            this._cachedKey,
            encoder.encode(plaintext)
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    },

    async decrypt(ciphertext) {
        if (!this._cachedKey) throw new Error('Encryption key not initialized');

        const combined = new Uint8Array(atob(ciphertext).split('').map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, this.config.ivLength);
        const data = combined.slice(this.config.ivLength);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            this._cachedKey,
            data
        );

        return new TextDecoder().decode(decrypted);
    }
};

window.EncryptionLocal = EncryptionLocal;
