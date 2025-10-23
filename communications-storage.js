// communications-storage.js - Encrypted communications storage module
// UPDATED: added note-id save helpers, deleted-note archive flow, and helpers to list deleted notes.
// See: saveNoteById(contactId, dateId, content, summary)
//      archiveAndDeleteNote(contactId, sessionKey, deletedBy)
//      listDeletedNotes(contactId)

const CommunicationsStorage = {
    config: {
        basePath: 'data/contacts',
        CONFIG: window.CRM_CONFIG
    },

    /* existing methods unchanged... (getManifest, saveManifest, saveCommunication, saveNoteSession, loadNoteSession, listNoteSessions, loadCommunication, listCommunications, updateCommunication, deleteCommunication, extractTimestamps) */
    // (The full file previously present remains; below are added/modified helpers appended)

    /**
     * Save a note using the NoteID pattern: <contactId>_<dateId>
     * Overwrites existing file with same NoteID.
     *
     * @param {number} contactId
     * @param {string} dateId - date identifier portion (e.g. 20251023T140102 or any client-generated id)
     * @param {string} content - editor content (HTML)
     * @param {string} summary
     * @returns {Promise<Object>} - result from saveNoteSession
     */
    async saveNoteById(contactId, dateId, content, summary = '') {
        const sessionKey = `${contactId}_${dateId}`;
        return await this.saveNoteSession(contactId, sessionKey, content, summary);
    },

    /**
     * Archive a note (create deleted_<originalfilename>) and remove the original note file.
     * - Creates a deleted file containing metadata (deletedBy, deletedAt) and the original encrypted content.
     * - Updates the contact manifest to include a deletedNotes entry.
     * - Deletes the original note file.
     *
     * @param {number} contactId
     * @param {string} sessionKey - e.g. "<contactId>_<dateId>" or other note filename without extension
     * @param {string} deletedBy - user/email who performed the deletion
     * @returns {Promise<boolean>}
     */
    async archiveAndDeleteNote(contactId, sessionKey, deletedBy = (window.currentUser && window.currentUser.email) || 'unknown') {
        const notePath = `${this.config.basePath}/contact-${contactId}/notes/${sessionKey}.json`;
        const deletedPath = `${this.config.basePath}/contact-${contactId}/notes/deleted_${sessionKey}.json`;

        try {
            // 1) fetch the existing file (to obtain content and sha)
            const getResp = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${notePath}`,
                {
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!getResp.ok) {
                throw new Error(`Note not found: ${notePath}`);
            }

            const fileData = await getResp.json();
            const existingSha = fileData.sha;
            const encryptedContent = atob(fileData.content);

            // 2) Create a deleted note wrapper with metadata
            const deletedWrapper = {
                deletedMeta: {
                    deletedBy: deletedBy,
                    deletedAt: new Date().toISOString(),
                    originalPath: notePath,
                    originalSha: existingSha
                },
                archivedContent: encryptedContent // keep encrypted payload as-is (so archive remains encrypted)
            };

            // Encrypt the wrapper (we keep wrapper encrypted with EncryptionService.encryptObject)
            const encryptedWrapper = await EncryptionService.encryptObject(deletedWrapper);
            const encodedWrapper = btoa(encryptedWrapper);

            // 3) Write the deleted_ file
            const putDeletedResp = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${deletedPath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Archive note ${sessionKey} as deleted by ${deletedBy}`,
                        content: encodedWrapper
                    })
                }
            );

            if (!putDeletedResp.ok) {
                const err = await putDeletedResp.json().catch(()=>({message:'unknown'}));
                throw new Error(`Failed to create deleted note file: ${err.message || putDeletedResp.status}`);
            }

            const deletedResult = await putDeletedResp.json();

            // 4) Delete the original note file (so active notes no longer show up as normal notes)
            const deleteResp = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${notePath}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Archive and delete note ${sessionKey}`,
                        sha: existingSha
                    })
                }
            );

            if (!deleteResp.ok) {
                const err = await deleteResp.json().catch(()=>({message:'unknown'}));
                // If deletion fails we don't want to leave inconsistent state; still report error.
                throw new Error(`Failed to delete original note file: ${err.message || deleteResp.status}`);
            }

            // 5) Update manifest: remove original note from communications and add to deletedNotes
            const manifest = await this.getManifest(contactId);
            // remove any communications entry that references this note (by filePath or id)
            manifest.communications = manifest.communications.filter(c => {
                if (!c.filePath) return true;
                // filePath may end with `/notes/${sessionKey}.json` or communications path
                return !c.filePath.endsWith(`/notes/${sessionKey}.json`);
            });

            // Add deletedNotes entry
            manifest.deletedNotes = manifest.deletedNotes || [];
            manifest.deletedNotes.push({
                id: `deleted_${sessionKey}`,
                originalId: sessionKey,
                deletedAt: new Date().toISOString(),
                deletedBy: deletedBy,
                filePath: deletedPath,
                archived_sha: deletedResult.content.sha
            });

            await this.saveManifest(manifest);

            console.log(`Note archived as ${deletedPath} and original deleted.`);
            return true;
        } catch (error) {
            console.error('Error archiving/deleting note:', error);
            throw error;
        }
    },

    /**
     * List deleted notes for a contact (returns manifest.deletedNotes entries).
     * Caller may fetch and decrypt individual deleted files if needed.
     *
     * @param {number} contactId
     * @returns {Promise<Array>} - array of deleted-note metadata from manifest
     */
    async listDeletedNotes(contactId) {
        try {
            const manifest = await this.getManifest(contactId);
            return manifest.deletedNotes || [];
        } catch (error) {
            console.error('Error listing deleted notes:', error);
            return [];
        }
    },

    /**
     * Load a deleted archived file's metadata and archived encrypted content.
     * Decrypts the wrapper and returns { deletedMeta, originalNoteObject }.
     *
     * @param {number} contactId
     * @param {string} deletedId - the filename without extension, e.g. deleted_12_20251023T...
     * @returns {Promise<Object>}
     */
    async loadDeletedNote(contactId, deletedId) {
        const deletedPath = `${this.config.basePath}/contact-${contactId}/notes/${deletedId}.json`;
        try {
            const resp = await fetch(
                `https://api.github.com/repos/${this.config.CONFIG.GITHUB_USERNAME}/${this.config.CONFIG.GITHUB_REPO}/contents/${deletedPath}`,
                {
                    headers: {
                        'Authorization': `token ${this.config.CONFIG.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (!resp.ok) throw new Error(`Failed to load deleted note: ${resp.status}`);
            const data = await resp.json();
            const encryptedWrapper = atob(data.content);
            const wrapper = await EncryptionService.decryptObject(encryptedWrapper);
            // wrapper contains deletedMeta + archivedContent (which is the original encrypted payload string)
            // Decrypt archivedContent to return original note object
            let originalNote = null;
            if (wrapper && wrapper.archivedContent) {
                const origEncrypted = wrapper.archivedContent;
                try {
                    originalNote = await EncryptionService.decryptObject(origEncrypted);
                } catch (e) {
                    // If original content is not an encrypted object but a plain string, return raw
                    originalNote = origEncrypted;
                }
            }

            return { deletedMeta: wrapper.deletedMeta || {}, originalNote: originalNote || null, _sha: data.sha };
        } catch (error) {
            console.error('Error loading deleted note:', error);
            throw error;
        }
    }
};

window.CommunicationsStorage = CommunicationsStorage;
