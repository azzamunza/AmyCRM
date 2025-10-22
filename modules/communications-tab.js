// communications-tab.js - Enhanced encrypted communication logger

const CommunicationsTab = {
    contacts: [],
    selectedContact: null,
    searchQuery: '',
    currentNote: '',
    communications: [],
    viewingComm: null,
    lastSaveTime: null,
    autoSaveTimer: null,
    isMinimized: false,

    async render() {
        const container = document.getElementById('communications');
        
        container.innerHTML = `
            <div class="comm-container" id="commContainer">
                <!-- Left Sidebar: Contact List & History -->
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
                    <div class="comm-history-list" id="historyList" style="display:none;">
                        <!-- Previous communications list -->
                    </div>
                </div>

                <!-- Previous Note View (Split View) -->
                <div class="comm-previous" id="previousView">
                    <div class="comm-previous-header">
                        <strong>Previous Note</strong>
                        <button class="comm-previous-close" onclick="CommunicationsTab.closePreviousView()">✕</button>
                    </div>
                    <div class="comm-editor-container">
                        <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 10px;">
                            <strong id="prevSummary">Summary</strong>
                            <div style="font-size: 0.85em; color: var(--text-light); margin-top: 5px;" id="prevMeta">Date</div>
                        </div>
                        <textarea 
                            id="prevNoteArea" 
                            class="comm-note-area" 
                            readonly
                            style="background: white;"
                        ></textarea>
                    </div>
                </div>

                <!-- Middle: Current Note Editor -->
                <div class="comm-main">
                    <div class="comm-main-header">
                        <div id="selectedContactInfo">
                            <p style="color: var(--text-light);">Select a contact to start logging communications</p>
                        </div>
                        <input 
                            type="text" 
                            id="commSummary" 
                            class="comm-summary-input" 
                            placeholder="Communication summary (e.g., 'Phone call regarding appointment')"
                            disabled
                            style="display:none;"
                        >
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
                            💾 Save Note
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
        
        // Check encryption is ready
        if (!EncryptionService.isReady()) {
            document.getElementById('contactList').innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--danger);">
                    Encryption not initialized. Please refresh the page.
                </div>
            `;
            return;
        }

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
                ${this.selectedContact?.id === contact.id ? `
                    <button class="comm-contact-close" onclick="event.stopPropagation(); CommunicationsTab.deselectContact()">✕</button>
                ` : ''}
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

    async selectContact(contactId) {
        this.selectedContact = this.contacts.find(c => c.id === contactId);
        if (!this.selectedContact) return;

        console.log('Selected contact:', this.selectedContact.name);

        // Minimize contact list and show history
        this.isMinimized = true;
        document.getElementById('contactList').style.display = 'none';
        document.getElementById('historyList').style.display = 'block';

        // Update UI
        this.displayContacts();
        document.getElementById('selectedContactInfo').innerHTML = `
            <h3 style="margin-bottom: 5px;">${this.selectedContact.name}</h3>
            <p style="color: var(--text-light); font-size: 0.9em;">
                ${this.selectedContact.organization || 'No organization'} • ${this.selectedContact.type || 'Contact'}
            </p>
        `;

        // Show summary input
        const summaryInput = document.getElementById('commSummary');
        summaryInput.style.display = 'block';
        summaryInput.disabled = false;

        // Enable note taking
        const noteArea = document.getElementById('commNoteArea');
        noteArea.disabled = false;
        noteArea.value = '';
        this.currentNote = '';
        noteArea.focus();

        document.getElementById('btnInsertTimestamp').disabled = false;
        document.getElementById('btnClearNote').disabled = false;
        document.getElementById('btnSaveNote').disabled = false;

        // Load communications history
        await this.loadContactCommunications();
    },

    deselectContact() {
        this.selectedContact = null;
        this.isMinimized = false;
        this.communications = [];
        
        // Show contact list, hide history
        document.getElementById('contactList').style.display = 'block';
        document.getElementById('historyList').style.display = 'none';
        
        // Reset UI
        document.getElementById('selectedContactInfo').innerHTML = `
            <p style="color: var(--text-light);">Select a contact to start logging communications</p>
        `;
        
        document.getElementById('commSummary').style.display = 'none';
        document.getElementById('commNoteArea').disabled = true;
        document.getElementById('commNoteArea').value = '';
        
        document.getElementById('btnInsertTimestamp').disabled = true;
        document.getElementById('btnClearNote').disabled = true;
        document.getElementById('btnSaveNote').disabled = true;
        
        this.displayContacts();
        this.closePreviousView();
    },

    async loadContactCommunications() {
        try {
            this.communications = await CommunicationsStorage.listCommunications(this.selectedContact.id);
            console.log(`Loaded ${this.communications.length} communications for:`, this.selectedContact.name);
            
            this.displayCommunicationsList();
            
            document.getElementById('statusText').textContent = 
                `${this.selectedContact.name} (${this.communications.length} previous communications)`;
        } catch (error) {
            console.error('Error loading communications:', error);
            document.getElementById('statusText').textContent = 'Error loading communications';
        }
    },

    displayCommunicationsList() {
        const historyEl = document.getElementById('historyList');
        
        if (this.communications.length === 0) {
            historyEl.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-light); font-size: 0.9em;">
                    No previous communications
                </div>
            `;
            return;
        }

        historyEl.innerHTML = this.communications.map(comm => `
            <div class="comm-history-item" onclick="CommunicationsTab.viewCommunication('${comm.id}')">
                <div class="comm-history-date">${formatDate(comm.timestamp)}</div>
                <div class="comm-history-summary">${comm.summary || 'No summary'}</div>
            </div>
        `).join('');
    },

    async viewCommunication(commId) {
        try {
            const comm = await CommunicationsStorage.loadCommunication(this.selectedContact.id, commId);
            this.viewingComm = comm;
            
            // Show split view
            document.getElementById('commContainer').classList.add('split-view');
            
            // Populate previous note
            document.getElementById('prevSummary').textContent = comm.summary || 'No summary';
            document.getElementById('prevMeta').textContent = `${formatDate(comm.createdAt)} by ${comm.author}`;
            document.getElementById('prevNoteArea').value = comm.content;
            
            console.log('Viewing communication:', comm.id);
        } catch (error) {
            console.error('Error loading communication:', error);
            alert('Failed to load communication');
        }
    },

    closePreviousView() {
        document.getElementById('commContainer').classList.remove('split-view');
        this.viewingComm = null;
    },

    handleNoteInput() {
        this.currentNote = document.getElementById('commNoteArea').value;
        
        // Clear existing auto-save timer
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // Set new auto-save timer (3 seconds of inactivity)
        this.autoSaveTimer = setTimeout(() => {
            // Auto-save disabled - only save on Enter or manual save
            // this.autoSave();
        }, 3000);

        // Update timeline
        this.updateTimeline();
    },

    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            // Don't auto-save on Enter, just let user add timestamp if they want
            // User must click Save button
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
            alert('Please enter some notes before saving');
            return;
        }

        const summary = document.getElementById('commSummary').value.trim();
        if (!summary) {
            alert('Please enter a summary for this communication');
            document.getElementById('commSummary').focus();
            return;
        }

        const saveIndicator = document.getElementById('saveIndicator');
        saveIndicator.innerHTML = '<span class="comm-save-indicator saving">🔒 Encrypting & Saving...</span>';

        try {
            await CommunicationsStorage.saveCommunication(
                this.selectedContact.id,
                this.currentNote,
                summary
            );

            this.lastSaveTime = new Date();
            saveIndicator.innerHTML = '<span class="comm-save-indicator saved">✓ Saved & Encrypted</span>';
            
            setTimeout(() => {
                saveIndicator.innerHTML = '';
            }, 3000);

            document.getElementById('statusText').textContent = 
                `Last saved: ${this.lastSaveTime.toLocaleTimeString()}`;

            // Clear current note and summary
            document.getElementById('commNoteArea').value = '';
            document.getElementById('commSummary').value = '';
            this.currentNote = '';

            // Refresh communication list
            await this.loadContactCommunications();
            
            // Refresh dashboard if it exists
            if (typeof DashboardTab !== 'undefined') {
                await DashboardTab.refresh();
            }

        } catch (error) {
            console.error('Error saving note:', error);
            saveIndicator.innerHTML = '<span class="comm-save-indicator" style="background: #fee2e2; color: #991b1b;">✗ Save failed: ' + error.message + '</span>';
        }
    },

    clearNote() {
        if (!confirm('Clear current notes? This cannot be undone.')) {
            return;
        }

        document.getElementById('commNoteArea').value = '';
        document.getElementById('commSummary').value = '';
        this.currentNote = '';
        this.updateTimeline();
        document.getElementById('statusText').textContent = 'Notes cleared';
    }
};

window.CommunicationsTab = CommunicationsTab;
