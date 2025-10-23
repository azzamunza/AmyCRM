// communications-storage.js - Encrypted communications storage module

const CommunicationsStorage = {
    config: {
        basePath: 'data/contacts',
        CONFIG: window.CRM_CONFIG
    },

    /**
     * Get or create contact manifest
     * @param {number} contactId - Contact ID
     * @returns {Promise<Object>} - Manifest object
     */
    async getManifest(contactId) {
        const manifestPath = `${this.config.basePath}/contact-${contactId}/manifest.json`;
        
        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${manifestPath}`,
                {
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.status === 404) {
                // Create new manifest
                return {
                    contactId: contactId,
                    communications: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    _sha: null
                };
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch manifest: ${response.status}`);
            }

            const data = await response.json();
            const encryptedContent = atob(data.content);
            const decrypted = await EncryptionService.decrypt(encryptedContent);
            const manifest = JSON.parse(decrypted);
            manifest._sha = data.sha; // Store SHA for updates
            
            return manifest;
        } catch (error) {
            console.error('Error getting manifest:', error);
            throw error;
        }
    },

    /**
     * Save manifest
     * @param {Object} manifest - Manifest object
     * @returns {Promise<boolean>}
     */
    async saveManifest(manifest) {
        const manifestPath = `${this.config.basePath}/contact-${manifest.contactId}/manifest.json`;
        
        try {
            manifest.updatedAt = new Date().toISOString();
            
            // Encrypt manifest
            const json = JSON.stringify(manifest, (key, value) => {
                // Exclude internal SHA property
                if (key === '_sha') return undefined;
                return value;
            }, 2);
            
            const encrypted = await EncryptionService.encrypt(json);
            const content = btoa(encrypted);

            const payload = {
                message: `Update manifest for contact ${manifest.contactId} - ${new Date().toISOString()}`,
                content: content
            };

            if (manifest._sha) {
                payload.sha = manifest._sha;
            }

            const response = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${manifestPath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to save manifest: ${error.message}`);
            }

            const result = await response.json();
            manifest._sha = result.content.sha;
            
            console.log('Manifest saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving manifest:', error);
            throw error;
        }
    },

    /**
     * Save a communication
     * @param {number} contactId - Contact ID
     * @param {string} content - Communication content
     * @param {string} summary - Short summary
     * @returns {Promise<Object>} - Saved communication object
     */
    async saveCommunication(contactId, content, summary = '') {
        try {
            const timestamp = Date.now();
            const id = `comm-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
            const commPath = `${this.config.basePath}/contact-${contactId}/communications/${id}.json`;

            // Extract timestamps from content
            const timestamps = this.extractTimestamps(content);

            const communication = {
                id: id,
                contactId: contactId,
                summary: summary,
                content: content,
                timestamps: timestamps,
                author: window.currentUser?.email || 'unknown',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Encrypt communication
            const encrypted = await EncryptionService.encryptObject(communication);
            const encodedContent = btoa(encrypted);

            // Save to GitHub
            const response = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${commPath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Add communication ${id} for contact ${contactId}`,
                        content: encodedContent
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to save communication: ${error.message}`);
            }

            // Update manifest
            const manifest = await this.getManifest(contactId);
            manifest.communications.push({
                id: id,
                summary: summary,
                timestamp: communication.createdAt,
                author: communication.author,
                filePath: commPath,
                hasAttachments: false
            });
            await this.saveManifest(manifest);

            console.log('Communication saved successfully:', id);
            return communication;
        } catch (error) {
            console.error('Error saving communication:', error);
            throw error;
        }
    },

    /**
     * Save or update a note session by sessionKey.
     * If sessionKey is provided and file exists, this overwrites the existing note file.
     * If sessionKey is null, a sessionKey will be generated and returned in response.
     *
     * @param {number} contactId
     * @param {string|null} sessionKey - persistent identifier string (e.g. note-session-123)
     * @param {string} content - editor content (Markdown or HTML as decided by client)
     * @param {string} summary
     * @returns {Promise<Object>} - { sessionKey, savedAt }
     */
    async saveNoteSession(contactId, sessionKey, content, summary = '') {
        try {
            // Create or reuse sessionKey. If none provided, create one (but client should reuse it).
            if (!sessionKey) {
                sessionKey = `note-${Date.now()}-${Math.random().toString(36).substr(2,6)}`;
            }
            const notePath = `${this.config.basePath}/contact-${contactId}/notes/${sessionKey}.json`;

            // Build note record
            const note = {
                id: sessionKey,
                contactId: contactId,
                summary: summary,
                content: content,
                author: window.currentUser?.email || 'unknown',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Encrypt and encode
            const encrypted = await EncryptionService.encryptObject(note);
            const encoded = btoa(encrypted);

            // Use PUT to create or update the same path (overwrite behavior)
            const payload = {
                message: `Save note session ${sessionKey} for contact ${contactId}`,
                content: encoded
            };

            // If file exists we must include its sha for the GitHub API - attempt to fetch sha first
            try {
                const getResp = await fetch(
                    `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${notePath}`,
                    {
                        headers: {
                            'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                if (getResp.ok) {
                    const existing = await getResp.json();
                    if (existing.sha) payload.sha = existing.sha;
                }
            } catch (e) {
                // file not found -> will create new
            }

            const response = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${notePath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to save note session: ${error.message || response.status}`);
            }

            const result = await response.json();

            // Update manifest to reference this note file (if not already present)
            const manifest = await this.getManifest(contactId);
            const exists = manifest.communications.find(c => c.filePath === notePath);
            if (!exists) {
                manifest.communications.push({
                    id: sessionKey,
                    summary: summary,
                    timestamp: note.createdAt,
                    author: note.author,
                    filePath: notePath,
                    hasAttachments: false,
                    isNote: true
                });
                await this.saveManifest(manifest);
            }

            return { sessionKey: sessionKey, savedAt: new Date().toISOString() };
        } catch (error) {
            console.error('Error saving note session:', error);
            throw error;
        }
    },

    /**
     * Load a note session by sessionKey
     * @param {number} contactId
     * @param {string} sessionKey
     * @returns {Promise<Object>} - note object
     */
    async loadNoteSession(contactId, sessionKey) {
        const notePath = `${this.config.basePath}/contact-${contactId}/notes/${sessionKey}.json`;
        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${notePath}`,
                {
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            if (!response.ok) {
                throw new Error(`Failed to load note session: ${response.status}`);
            }
            const data = await response.json();
            const encryptedContent = atob(data.content);
            const note = await EncryptionService.decryptObject(encryptedContent);
            note._sha = data.sha;
            return note;
        } catch (error) {
            console.error('Error loading note session:', error);
            throw error;
        }
    },

    /**
     * List note sessions for a contact (scans manifest for isNote flags)
     * @param {number} contactId
     * @returns {Promise<Array>}
     */
    async listNoteSessions(contactId) {
        try {
            const manifest = await this.getManifest(contactId);
            return manifest.communications.filter(c => c.isNote === true).sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
        } catch (error) {
            console.error('Error listing note sessions:', error);
            return [];
        }
    },

    /**
     * Load a communication
     * @param {number} contactId - Contact ID
     * @param {string} commId - Communication ID
     * @returns {Promise<Object>} - Communication object
     */
    async loadCommunication(contactId, commId) {
        const commPath = `${this.config.basePath}/contact-${contactId}/communications/${commId}.json`;
        
        try {
            const response = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${commPath}`,
                {
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to load communication: ${response.status}`);
            }

            const data = await response.json();
            const encryptedContent = atob(data.content);
            const communication = await EncryptionService.decryptObject(encryptedContent);
            communication._sha = data.sha; // Store for updates
            
            return communication;
        } catch (error) {
            console.error('Error loading communication:', error);
            throw error;
        }
    },

    /**
     * List all communications for a contact
     * @param {number} contactId - Contact ID
     * @returns {Promise<Array>} - Array of communication metadata
     */
    async listCommunications(contactId) {
        try {
            const manifest = await this.getManifest(contactId);
            // Sort by timestamp, newest first
            return manifest.communications.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (error) {
            console.error('Error listing communications:', error);
            return [];
        }
    },

    /**
     * Update a communication
     * @param {Object} communication - Communication object with updates
     * @returns {Promise<boolean>}
     */
    async updateCommunication(communication) {
        const commPath = `${this.config.basePath}/contact-${communication.contactId}/communications/${communication.id}.json`;
        
        try {
            communication.updatedAt = new Date().toISOString();
            communication.timestamps = this.extractTimestamps(communication.content);

            // Encrypt
            const encrypted = await EncryptionService.encryptObject(communication);
            const encodedContent = btoa(encrypted);

            const payload = {
                message: `Update communication ${communication.id}`,
                content: encodedContent
            };

            if (communication._sha) {
                payload.sha = communication._sha;
            }

            const response = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${commPath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Failed to update communication: ${error.message}`);
            }

            console.log('Communication updated successfully');
            return true;
        } catch (error) {
            console.error('Error updating communication:', error);
            throw error;
        }
    },

    /**
     * Delete a communication
     * @param {number} contactId - Contact ID
     * @param {string} commId - Communication ID
     * @returns {Promise<boolean>}
     */
    async deleteCommunication(contactId, commId) {
        const commPath = `${this.config.basePath}/contact-${contactId}/communications/${commId}.json`;
        
        try {
            // Get file SHA first
            const getResponse = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${commPath}`,
                {
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!getResponse.ok) {
                throw new Error('Communication not found');
            }

            const fileData = await getResponse.json();

            // Delete file
            const deleteResponse = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${commPath}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Delete communication ${commId}`,
                        sha: fileData.sha
                    })
                }
            );

            if (!deleteResponse.ok) {
                throw new Error('Failed to delete communication');
            }

            // Update manifest
            const manifest = await this.getManifest(contactId);
            manifest.communications = manifest.communications.filter(c => c.id !== commId);
            await this.saveManifest(manifest);

            console.log('Communication deleted successfully');
            return true;
        } catch (error) {
            console.error('Error deleting communication:', error);
            throw error;
        }
    },

    /**
     * Extract timestamps from content
     * @param {string} content - Communication content
     * @returns {Array} - Array of {time, line} objects
     */
    extractTimestamps(content) {
        const lines = content.split('\n');
        const timestamps = [];
        
        lines.forEach((line, index) => {
            const match = line.match(/\[(\d{2}:\d{2})\]/);
            if (match) {
                timestamps.push({
                    time: match[1],
                    line: index
                });
            }
        });
        
        return timestamps;
    }
};

window.CommunicationsStorage = CommunicationsStorage;