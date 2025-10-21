// encryption.js — Central encryption service controller

const EncryptionService = {
    mode: 'local', // default (can be switched to 'kms')
    _initialized: false,
    _metadata: null,

    async initializeFromLogin(identifier, loginType, credential = null) {
        try {
            console.log(`🔐 Initializing EncryptionService [${loginType}]`);

            // Local encryption is used by default
            const key = await EncryptionLocal.deriveKeyFromIdentity(
                identifier,
                loginType,
                credential
            );

            if (!key) throw new Error('Key derivation failed');

            this.mode = 'local';
            this._initialized = true;
            this._metadata = EncryptionLocal.getMetadata();

            console.log('✓ EncryptionService ready:', this._metadata);
        } catch (error) {
            console.error('Failed to initialize encryption:', error);
            throw error;
        }
    },

    async encrypt(data) {
        if (!this._initialized) throw new Error('EncryptionService not initialized');
        return EncryptionLocal.encrypt(data);
    },

    async decrypt(data) {
        if (!this._initialized) throw new Error('EncryptionService not initialized');
        return EncryptionLocal.decrypt(data);
    },

    getMetadata() {
        return this._metadata || { mode: this.mode };
    }
};

window.EncryptionService = EncryptionService;
