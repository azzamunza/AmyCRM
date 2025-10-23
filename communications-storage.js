// communications-storage.js - Encrypted communications storage module
//
// Full implementation: manifest management, communications, note sessions (NoteID), deleted-note archiving.
// Uses GitHub contents API and EncryptionService to encrypt/decrypt payloads.
//
// NOTE: This file expects:
// - window.CRM_CONFIG to contain GITHUB_USERNAME, GITHUB_REPO, GITHUB_TOKEN
// - EncryptionService with encrypt, decrypt, encryptObject, decryptObject methods
// - addCommunication/updateCommunication/deleteCommunication helpers are available, but not required for notes

const CommunicationsStorage = {
  config: {
    basePath: 'data/contacts',
    CONFIG: window.CRM_CONFIG
  },

  // Get or create contact manifest
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
        return {
          contactId: contactId,
          communications: [],
          deletedNotes: [],
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
      manifest._sha = data.sha;
      manifest.communications = manifest.communications || manifest.items || [];
      manifest.deletedNotes = manifest.deletedNotes || [];
      return manifest;
    } catch (error) {
      console.error('Error getting manifest:', error);
      throw error;
    }
  },

  // Save manifest
  async saveManifest(manifest) {
    const manifestPath = `${this.config.basePath}/contact-${manifest.contactId}/manifest.json`;

    try {
      manifest.updatedAt = new Date().toISOString();

      const json = JSON.stringify(manifest, (key, value) => {
        if (key === '_sha') return undefined;
        return value;
      }, 2);

      const encrypted = await EncryptionService.encrypt(json);
      const content = btoa(encrypted);

      const payload = {
        message: `Update manifest for contact ${manifest.contactId} - ${new Date().toISOString()}`,
        content: content
      };

      if (manifest._sha) payload.sha = manifest._sha;

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

  // Save a communication (creates a new file under communications/)
  async saveCommunication(contactId, content, summary = '') {
    try {
      const timestamp = Date.now();
      const id = `comm-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      const commPath = `${this.config.basePath}/contact-${contactId}/communications/${id}.json`;

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

      const encrypted = await EncryptionService.encryptObject(communication);
      const encodedContent = btoa(encrypted);

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
      manifest.communications = manifest.communications || [];
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

  // Save or update a note session by sessionKey.
  async saveNoteSession(contactId, sessionKey, content, summary = '') {
    try {
      if (!sessionKey) {
        sessionKey = `note-${Date.now()}-${Math.random().toString(36).substr(2,6)}`;
      }
      const notePath = `${this.config.basePath}/contact-${contactId}/notes/${sessionKey}.json`;

      const note = {
        id: sessionKey,
        contactId: contactId,
        summary: summary,
        content: content,
        author: window.currentUser?.email || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const encrypted = await EncryptionService.encryptObject(note);
      const encoded = btoa(encrypted);

      const payload = {
        message: `Save note session ${sessionKey} for contact ${contactId}`,
        content: encoded
      };

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

      // Update manifest to reference this note file if not present
      const manifest = await this.getManifest(contactId);
      manifest.communications = manifest.communications || [];
      const exists = manifest.communications.find(c => c.filePath === notePath || c.id === sessionKey);
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

  // Load a note session by sessionKey
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

  // List note sessions for a contact (scans manifest for isNote flags)
  async listNoteSessions(contactId) {
    try {
      const manifest = await this.getManifest(contactId);
      return (manifest.communications || []).filter(c => c.isNote === true).sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
    } catch (error) {
      console.error('Error listing note sessions:', error);
      return [];
    }
  },

  // Load a communication
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
      communication._sha = data.sha;
      return communication;
    } catch (error) {
      console.error('Error loading communication:', error);
      throw error;
    }
  },

  // List all communications for a contact (reads manifest)
  async listCommunications(contactId) {
    try {
      const manifest = await this.getManifest(contactId);
      return (manifest.communications || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Error listing communications:', error);
      return [];
    }
  },

  // Update a communication
  async updateCommunication(communication) {
    const commPath = `${this.config.basePath}/contact-${communication.contactId}/communications/${communication.id}.json`;

    try {
      communication.updatedAt = new Date().toISOString();
      communication.timestamps = this.extractTimestamps(communication.content);

      const encrypted = await EncryptionService.encryptObject(communication);
      const encodedContent = btoa(encrypted);

      const payload = {
        message: `Update communication ${communication.id}`,
        content: encodedContent
      };

      if (communication._sha) payload.sha = communication._sha;

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

  // Delete a communication
  async deleteCommunication(contactId, commId) {
    const commPath = `${this.config.basePath}/contact-${contactId}/communications/${commId}.json`;

    try {
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

      const manifest = await this.getManifest(contactId);
      manifest.communications = (manifest.communications || []).filter(c => c.id !== commId);
      await this.saveManifest(manifest);

      console.log('Communication deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting communication:', error);
      throw error;
    }
  },

  // Extract timestamps from content
  extractTimestamps(content) {
    const lines = (content || '').split('\n');
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
  },

  // --- New helpers for NoteID save and deleted notes (archive) ---

  // Save a note using the NoteID pattern: <contactId>_<dateId>
  async saveNoteById(contactId, dateId, content, summary = '') {
    const sessionKey = `${contactId}_${dateId}`;
    return await this.saveNoteSession(contactId, sessionKey, content, summary);
  },

  // Archive a note (create deleted_<originalfilename>) and remove the original note file.
  async archiveAndDeleteNote(contactId, sessionKey, deletedBy = (window.currentUser && window.currentUser.email) || 'unknown') {
    const notePath = `${this.config.basePath}/contact-${contactId}/notes/${sessionKey}.json`;
    const deletedPath = `${this.config.basePath}/contact-${contactId}/notes/deleted_${sessionKey}.json`;

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

      if (!getResp.ok) {
        throw new Error(`Note not found: ${notePath}`);
      }

      const fileData = await getResp.json();
      const existingSha = fileData.sha;
      const encryptedContent = atob(fileData.content);

      const deletedWrapper = {
        deletedMeta: {
          deletedBy: deletedBy,
          deletedAt: new Date().toISOString(),
          originalPath: notePath,
          originalSha: existingSha
        },
        archivedContent: encryptedContent
      };

      const encryptedWrapper = await EncryptionService.encryptObject(deletedWrapper);
      const encodedWrapper = btoa(encryptedWrapper);

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
        throw new Error(`Failed to delete original note file: ${err.message || deleteResp.status}`);
      }

      const manifest = await this.getManifest(contactId);
      manifest.communications = (manifest.communications || []).filter(c => {
        if (!c.filePath) return true;
        return !c.filePath.endsWith(`/notes/${sessionKey}.json`);
      });

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

  // List deleted notes (from manifest)
  async listDeletedNotes(contactId) {
    try {
      const manifest = await this.getManifest(contactId);
      return manifest.deletedNotes || [];
    } catch (error) {
      console.error('Error listing deleted notes:', error);
      return [];
    }
  },

  // Load deleted archived wrapper and decrypt
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

      let originalNote = null;
      if (wrapper && wrapper.archivedContent) {
        const origEncrypted = wrapper.archivedContent;
        try {
          originalNote = await EncryptionService.decryptObject(origEncrypted);
        } catch (e) {
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
