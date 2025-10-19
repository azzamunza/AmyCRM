// communications-tab.js - Enhanced communication logger with contact list

const CommunicationsTab = {
    contacts: [],
    selectedContact: null,
    searchQuery: '',
    currentNote: '',
    lastSaveTime: null,
    autoSaveTimer: null,

    async render() {
        const container = document.getElementById('communications');
        
        container.innerHTML = `
            <style>
                .comm-container {
                    display: grid;
                    grid-template-columns: 300px 1fr 150px;
                    gap: 0;
                    height: calc(100vh - 200px);
                    background: white;
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    overflow: hidden;
                }

                .comm-sidebar {
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    background: var(--light);
                }

                .comm-sidebar-header {
                    padding: 20px;
                    border-bottom: 1px solid var(--border);
                    background: white;
                }

                .comm-search {
                    width: 100%;
                    padding: 10px 12px;
                    border: 2px solid var(--border);
                    border-radius: 8px;
                    font-size: 14px;
                }

                .comm-search:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .comm-contact-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                }

                .comm-contact-item {
                    padding: 12px 15px;
                    margin-bottom: 5px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: white;
                    border: 1px solid var(--border);
                }

                .comm-contact-item:hover {
                    background: var(--primary);
                    color: white;
                    transform: translateX(5px);
                }

                .comm-contact-item.active {
                    background: var(--primary);
                    color: white;
                    font-weight: 600;
                }

                .comm-contact-name {
                    font-weight: 600;
                    margin-bottom: 3px;
                }

                .comm-contact-org {
                    font-size: 0.85em;
                    opacity: 0.8;
                }

                .comm-main {
                    display: flex;
                    flex-direction: column;
                    background: white;
                }

                .comm-main-header {
                    padding: 20px;
                    border-bottom: 1px solid var(--border);
                    background: var(--light);
                }

                .comm-editor-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 20px;
                    overflow-y: auto;
                }

                .comm-note-area {
                    flex: 1;
                    border: 2px solid var(--border);
                    border-radius: 8px;
                    padding: 15px;
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    line-height: 1.6;
                    resize: none;
                    min-height: 300px;
                }

                .comm-note-area:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .comm-toolbar {
                    display: flex;
                    gap: 10px;
                    padding: 15px 20px;
                    border-top: 1px solid var(--border);
                    background: var(--light);
                }

                .comm-timeline {
                    border-left: 2px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    background: var(--light);
                    overflow-y: auto;
                }

                .comm-timeline-header {
                    padding: 20px 15px;
                    border-bottom: 1px solid var(--border);
                    background: white;
                    font-weight: 600;
                    text-align: center;
                }

                .comm-timeline-content {
                    padding: 15px;
                }

                .comm-timestamp {
                    font-size: 0.75em;
                    color: var(--text-light);
                    text-align: right;
                    padding: 5px 0;
                    font-family: monospace;
                }

                .comm-timestamp.date {
                    font-weight: 600;
                    color: var(--primary);
                    text-align: center;
                    padding: 10px 0;
                    border-bottom: 1px solid var(--border);
                    margin-bottom: 10px;
                }

                .comm-status {
                    padding: 10px 20px;
                    font-size: 0.85em;
                    color: var(--text-light);
                    text-align: center;
                    border-top: 1px solid var(--border);
                }

                .comm-save-indicator {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.85em;
                    margin-left: 10px;
                }

                .comm-save-indicator.saving {
                    background: #fef3c7;
                    color: #92400e;
                }

                .comm-save-indicator.saved {
                    background: #d1fae5;
                    color: #065f46;
                }

                @media (max-width: 968px) {
                    .comm-container {
                        grid-template-columns: 1fr;
                        height: auto;
                    }
                    .comm-sidebar, .comm-timeline {
                        border: none;
                        border-bottom: 1px solid var(--border);
                    }
                }
            </style>

            <div class="comm-container">
                <!-- Left Sidebar: Contact List -->
                <div class="comm-sidebar">
                    <div class="comm-sidebar-header">
                        <h3 style="margin-bottom: 10px; font-size: 1.1em;">Contacts</h3>
                        <input 
                            type="text" 
                            class="comm-search" 
                            placeholder="🔍 Search contacts..."
                            oninput="CommunicationsTab.handleContactSearch(this.value)"
                        >
                    </div>
                    <div class="comm-contact-list" id="contactList">
                        <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
                            Loading contacts...
                        </div>
                    </div>
                </div>

                <!-- Middle: Note Editor -->
                <div class="comm-main">
                    <div class="comm-main-header">
                        <div id="selectedContactInfo">
                            <p style="color: var(--text-light);">Select a contact to start logging communications</p>
                        </div>
                    </div>
                    
                    <div class="comm-editor-container">
                        <textarea 
                            id="commNoteArea" 
                            class="comm-note-area" 
                            placeholder="Start typing your communication notes here...&#10;&#10;Press Enter to save a line with timestamp.&#10;Text will auto-save after 3 seconds of inactivity."
                            oninput="CommunicationsTab.handleNoteInput()"
                            onkeydown="CommunicationsTab.handleKeyPress(event)"
                            disabled
                        ></textarea>
                    </div>

                    <div class="comm-toolbar">
                        <button class="btn btn-sm btn-secondary" onclick="CommunicationsTab.insertTimestamp()" disabled id="btnInsertTimestamp">
                            🕐 Insert Time
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="CommunicationsTab.clearNote()" disabled id="btnClearNote">
                            🗑️ Clear
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="CommunicationsTab.saveNote()" disabled id="btnSaveNote">
                            💾 Save Now
                        </button>
                        <span id="saveIndicator"></span>
                    </div>

                    <div class="comm-status">
                        <span id="statusText">Ready</span>
                    </div>
                </div>

                <!-- Right: Timeline -->
                <div class="comm-timeline">
                    <div class="comm-timeline-header">
                        Timeline
                    </div>
                    <div class="comm-timeline-content" id="timelineContent">
                        <p style="text-align: center; color: var(--text-light); font-size: 0.9em;">
                            Timestamps will appear here as you type
                        </p>
                    </div>
                </div>
            </div>
        `;

        await this.init();
    },

    async init() {
        console.log('Initializing Communications tab...');
        await this.loadContacts();
        this.displayContacts();
        this.updateTimeline();
    },

    async loadContacts() {
        try {
            this.contacts = await getContacts();
            console.log(`Loaded ${this.contacts.length} contacts`);
        } catch (error) {
            console.error('Error loading contacts:', error);
            document.getElementById('contactList').innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--danger);">
                    Error loading contacts
                </div>
            `;
        }
    },

    displayContacts() {
        const listEl = document.getElementById('contactList');
        const filtered = this.getFilteredContacts();

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-light);">
                    No contacts found
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.map(contact => `
            <div 
                class="comm-contact-item ${this.selectedContact?.id === contact.id ? 'active' : ''}" 
                onclick="CommunicationsTab.selectContact(${contact.id})"
            >
                <div class="comm-contact-name">${contact.name}</div>
                ${contact.organization ? `<div class="comm-contact-org">${contact.organization}</div>` : ''}
            </div>
        `).join('');
    },

    getFilteredContacts() {
        if (!this.searchQuery) {
            return this.contacts.sort((a, b) => a.name.localeCompare(b.name));
        }

        const query = this.searchQuery.toLowerCase();
        return this.contacts
            .filter(c => 
                c.name.toLowerCase().includes(query) ||
                c.organization?.toLowerCase().includes(query) ||
                c.email?.toLowerCase().includes(query)
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    handleContactSearch(value) {
        this.searchQuery = value;
        this.displayContacts();
    },

    selectContact(contactId) {
        this.selectedContact = this.contacts.find(c => c.id === contactId);
        if (!this.selectedContact) return;

        console.log('Selected contact:', this.selectedContact.name);

        // Update UI
        this.displayContacts();
        document.getElementById('selectedContactInfo').innerHTML = `
            <h3 style="margin-bottom: 5px;">${this.selectedContact.name}</h3>
            <p style="color: var(--text-light); font-size: 0.9em;">
                ${this.selectedContact.organization || 'No organization'} • ${this.selectedContact.type || 'Contact'}
            </p>
        `;

        // Enable note taking
        const noteArea = document.getElementById('commNoteArea');
        noteArea.disabled = false;
        noteArea.focus();

        document.getElementById('btnInsertTimestamp').disabled = false;
        document.getElementById('btnClearNote').disabled = false;
        document.getElementById('btnSaveNote').disabled = false;

        // TODO: Load existing communications for this contact
        this.loadContactCommunications();
    },

    async loadContactCommunications() {
        // TODO: Load from Google Sheets in Stage 2
        console.log('Loading communications for:', this.selectedContact.name);
        document.getElementById('statusText').textContent = `Viewing: ${this.selectedContact.name}`;
    },

    handleNoteInput() {
        this.currentNote = document.getElementById('commNoteArea').value;
        
        // Clear existing auto-save timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Set new auto-save timer (3 seconds of inactivity)
        this.autoSaveTimer = setTimeout(() => {
            this.autoSave();
        }, 3000);

        // Update timeline
        this.updateTimeline();
    },

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            // Save on Enter key
            setTimeout(() => {
                this.saveNote();
            }, 100);
        }
    },

    insertTimestamp() {
        const noteArea = document.getElementById('commNoteArea');
        const now = new Date();
        const timestamp = `[${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}] `;
        
        const cursorPos = noteArea.selectionStart;
        const textBefore = noteArea.value.substring(0, cursorPos);
        const textAfter = noteArea.value.substring(cursorPos);
        
        noteArea.value = textBefore + timestamp + textAfter;
        noteArea.selectionStart = noteArea.selectionEnd = cursorPos + timestamp.length;
        noteArea.focus();

        this.handleNoteInput();
    },

    updateTimeline() {
        const now = new Date();
        const timelineEl = document.getElementById('timelineContent');
        
        const currentDate = now.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        const currentTime = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });

        // Extract timestamps from note
        const noteArea = document.getElementById('commNoteArea');
        const lines = noteArea.value.split('\n');
        const timestamps = lines
            .map(line => line.match(/\[(\d{2}:\d{2})\]/))
            .filter(match => match)
            .map(match => match[1]);

        let timelineHTML = `<div class="comm-timestamp date">${currentDate}</div>`;
        
        if (timestamps.length > 0) {
            timelineHTML += timestamps.map(time => 
                `<div class="comm-timestamp">${time}</div>`
            ).join('');
        } else {
            timelineHTML += `<div class="comm-timestamp">${currentTime}</div>`;
        }

        timelineEl.innerHTML = timelineHTML;
    },

    async saveNote() {
        if (!this.selectedContact || !this.currentNote.trim()) {
            return;
        }

        const saveIndicator = document.getElementById('saveIndicator');
        saveIndicator.innerHTML = '<span class="comm-save-indicator saving">Saving...</span>';

        try {
            // TODO: Stage 2 - Save to Google Sheets
            console.log('Saving note for:', this.selectedContact.name);
            console.log('Note content:', this.currentNote);

            // Simulate save delay
            await new Promise(resolve => setTimeout(resolve, 500));

            this.lastSaveTime = new Date();
            saveIndicator.innerHTML = '<span class="comm-save-indicator saved">✓ Saved</span>';
            
            setTimeout(() => {
                saveIndicator.innerHTML = '';
            }, 3000);

            document.getElementById('statusText').textContent = `Last saved: ${this.lastSaveTime.toLocaleTimeString()}`;

        } catch (error) {
            console.error('Error saving note:', error);
            saveIndicator.innerHTML = '<span class="comm-save-indicator" style="background: #fee2e2; color: #991b1b;">✗ Save failed</span>';
        }
    },

    async autoSave() {
        if (!this.selectedContact || !this.currentNote.trim()) {
            return;
        }

        console.log('Auto-saving...');
        await this.saveNote();
    },

    clearNote() {
        if (!confirm('Clear all notes? This cannot be undone.')) {
            return;
        }

        document.getElementById('commNoteArea').value = '';
        this.currentNote = '';
        this.updateTimeline();
        document.getElementById('statusText').textContent = 'Notes cleared';
    }
};

window.CommunicationsTab = CommunicationsTab;
