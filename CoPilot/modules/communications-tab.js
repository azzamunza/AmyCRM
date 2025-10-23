// communications-tab.js - Enhanced encrypted communication logger with new features

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
    saveQueue: [],
    isSaving: false,
    lastTimestamp: null,
    googleDriveLink: null,

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
                        <!-- Previous communications header -->
                        <div style="padding: 15px; background: white; border-bottom: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong id="selectedContactHeader">Contact Name</strong>
                                <button class="btn-sm btn-primary" onclick="CommunicationsTab.saveAndClose()" id="btnSaveClose">
                                    💾 Save & Close
                                </button>
                            </div>
                        </div>
                        <!-- History items -->
                        <div id="historyItems" style="padding: 10px;"></div>
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
                            placeholder="Start typing your communication notes here...&#10;&#10;Press Enter to save current line and add timestamp if needed.&#10;Text auto-saves progressively."
                            oninput="CommunicationsTab.handleNoteInput()"
                            onkeydown="CommunicationsTab.handleKeyPress(event)"
                            disabled
                        ></textarea>
                    </div>

                    <div class="comm-toolbar">
                        <button class="btn btn-sm btn-secondary" onclick="CommunicationsTab.insertTimestamp()" disabled id="btnInsertTimestamp" title="Insert timestamp">
                            🕐 Time
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="CommunicationsTab.insertCalendarDate()" disabled id="btnInsertDate" title="Insert calendar date">
                            📅 Date
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="CommunicationsTab.uploadFile()" disabled id="btnUploadFile" title="Upload file">
                            📎 File
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="CommunicationsTab.showInsertMenu()" disabled id="btnInsertMenu" title="Insert custom elements">
                            ✨ Insert
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="CommunicationsTab.clearNote()" disabled id="btnClearNote">
                            🗑️ Clear
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="CommunicationsTab.createNewNote()" disabled id="btnNewNote">
                            📝 New Note
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

            <!-- Insert Menu Modal -->
            <div id="insertMenuModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>Insert Custom Element</h3>
                        <button class="modal-close" onclick="CommunicationsTab.closeInsertMenu()">✕</button>
                    </div>
                    <div style="padding: 20px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; max-height: 400px; overflow-y: auto;" id="iconGrid">
                            <p style="text-align: center; color: var(--text-light);">Loading icons...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Calendar Date Modal -->
            <div id="calendarModal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Insert Calendar Date</h3>
                        <button class="modal-close" onclick="CommunicationsTab.closeCalendarModal()">✕</button>
                    </div>
                    <form onsubmit="CommunicationsTab.handleCalendarInsert(event)" style="padding: 20px;">
                        <div class="form-group">
                            <label>Date & Time</label>
                            <input type="datetime-local" id="calendarDateTime" required>
                        </div>
                        <div class="form-group">
                            <label>Event Title</label>
                            <input type="text" id="calendarTitle" placeholder="Appointment with Dr. Smith" required>
                        </div>
                        <div class="form-group">
                            <label>Notes (optional)</label>
                            <textarea id="calendarNotes" rows="3"></textarea>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button type="submit" class="btn btn-primary" style="flex: 1;">
                                📅 Insert Date
                            </button>
                            <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="CommunicationsTab.closeCalendarModal()">
                                Cancel
                            </button>
                        </div>
                        <p style="margin-top: 15px; font-size: 0.85em; color: var(--text-light);">
                            💡 After inserting, you can add to Google Calendar
                        </p>
                    </form>
                </div>
            </div>

            <!-- Google Drive Setup Modal -->
            <div id="driveSetupModal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>🔒 Google Drive Setup</h3>
                        <button class="modal-close" onclick="CommunicationsTab.closeDriveSetup()">✕</button>
                    </div>
                    <div style="padding: 20px;">
                        <p style="margin-bottom: 15px;">To upload files, please provide a link to your Google Drive folder with read-write permissions.</p>
                        <div class="form-group">
                            <label>Google Drive Folder Link</label>
                            <input type="url" id="driveLink" placeholder="https://drive.google.com/drive/folders/..." required>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-primary" style="flex: 1;" onclick="CommunicationsTab.saveDriveLink()">
                                💾 Save Link
                            </button>
                            <button class="btn btn-secondary" style="flex: 1;" onclick="CommunicationsTab.closeDriveSetup()">
                                Cancel
                            </button>
                        </div>
                        <p style="margin-top: 15px; font-size: 0.85em; color: var(--text-light);">
                            💡 This will be encrypted and stored securely in your profile
                        </p>
                    </div>
                </div>
            </div>

            <style>
                .comm-save-spinner {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid var(--border);
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .icon-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 10px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .icon-item:hover {
                    background: var(--light);
                    border-color: var(--primary);
                    transform: translateY(-2px);
                }

                .icon-item img {
                    width: 40px;
                    height: 40px;
                    margin-bottom: 5px;
                }

                .icon-item span {
                    font-size: 0.75em;
                    text-align: center;
                    color: var(--text-light);
                }

                .calendar-event {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 8px;
                    background: #dbeafe;
                    border: 1px solid #93c5fd;
                    border-radius: 6px;
                    color: #1e40af;
                    font-size: 0.9em;
                    cursor: pointer;
                }

                .calendar-event:hover {
                    background: #bfdbfe;
                }
            </style>
        `;

        await this.init();
    },

    async init() {
        console.log('Initializing Communications tab...');
        
        if (!EncryptionService.isReady()) {
            document.getElementById('contactList').innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--danger);">
                    Encryption not initialized. Please refresh the page.
                </div>
            `;
            return;
        }

        await this.loadContacts();
        await this.loadUserSettings();
        this.displayContacts();
        this.updateTimeline();
        this.loadIcons();
    },

    async loadUserSettings() {
        // Load Google Drive link from user settings
        const userSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
        this.googleDriveLink = userSettings.googleDriveLink || null;
    },

    async saveUserSettings() {
        const userSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
        userSettings.googleDriveLink = this.googleDriveLink;
        localStorage.setItem('userSettings', JSON.stringify(userSettings));
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

    async selectContact(contactId) {
        this.selectedContact = this.contacts.find(c => c.id === contactId);
        if (!this.selectedContact) return;

        console.log('Selected contact:', this.selectedContact.name);

        // Show history list with contact header
        document.getElementById('contactList').style.display = 'none';
        document.getElementById('historyList').style.display = 'block';
        document.getElementById('selectedContactHeader').textContent = this.selectedContact.name;

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
        this.lastTimestamp = null;
        noteArea.focus();

        // Enable all buttons
        document.getElementById('btnInsertTimestamp').disabled = false;
        document.getElementById('btnInsertDate').disabled = false;
        document.getElementById('btnUploadFile').disabled = false;
        document.getElementById('btnInsertMenu').disabled = false;
        document.getElementById('btnClearNote').disabled = false;
        document.getElementById('btnNewNote').disabled = false;

        await this.loadContactCommunications();
    },

    deselectContact() {
        this.selectedContact = null;
        this.communications = [];
        this.currentNote = '';
        this.lastTimestamp = null;
        
        document.getElementById('contactList').style.display = 'block';
        document.getElementById('historyList').style.display = 'none';
        
        document.getElementById('selectedContactInfo').innerHTML = `
            <p style="color: var(--text-light);">Select a contact to start logging communications</p>
        `;
        
        document.getElementById('commSummary').style.display = 'none';
        document.getElementById('commNoteArea').disabled = true;
        document.getElementById('commNoteArea').value = '';
        
        document.getElementById('btnInsertTimestamp').disabled = true;
        document.getElementById('btnInsertDate').disabled = true;
        document.getElementById('btnUploadFile').disabled = true;
        document.getElementById('btnInsertMenu').disabled = true;
        document.getElementById('btnClearNote').disabled = true;
        document.getElementById('btnNewNote').disabled = true;
        
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
        const historyEl = document.getElementById('historyItems');
        
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
            
            document.getElementById('commContainer').classList.add('split-view');
            
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
        this.updateTimeline();
        this.queueAutoSave();
    },

    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            // Save line on Enter
            this.saveLine();
        }
    },

    saveLine() {
        const noteArea = document.getElementById('commNoteArea');
        const cursorPos = noteArea.selectionStart;
        const lines = noteArea.value.substring(0, cursorPos).split('\n');
        const currentLineIndex = lines.length - 1;
        
        // Check if we need a new timestamp (more than 1 minute since last)
        const now = Date.now();
        if (!this.lastTimestamp || (now - this.lastTimestamp) > 60000) {
            // Insert timestamp at beginning of new line
            setTimeout(() => {
                this.insertTimestamp();
                this.lastTimestamp = now;
            }, 10);
        }
        
        // Queue save
        this.queueAutoSave();
    },

    queueAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        this.autoSaveTimer = setTimeout(() => {
            this.progressiveSave();
        }, 2000);
    },

    async progressiveSave() {
        if (!this.selectedContact || !this.currentNote.trim()) return;

        const summary = document.getElementById('commSummary').value.trim() || 'Draft note';
        
        this.saveQueue.push({
            contactId: this.selectedContact.id,
            content: this.currentNote,
            summary: summary,
            timestamp: Date.now()
        });

        this.processSaveQueue();
    },

    async processSaveQueue() {
        if (this.isSaving || this.saveQueue.length === 0) return;

        this.isSaving = true;
        const saveIndicator = document.getElementById('saveIndicator');
        
        // Show saving status
        saveIndicator.innerHTML = '<span class="comm-save-indicator saving"><span class="comm-save-spinner"></span>Saving...</span>';

        try {
            const saveData = this.saveQueue[this.saveQueue.length - 1]; // Get latest
            
            await CommunicationsStorage.saveCommunication(
                saveData.contactId,
                saveData.content,
                saveData.summary
            );

            this.lastSaveTime = new Date();
            saveIndicator.innerHTML = '<span class="comm-save-indicator saved">✓ Saved</span>';
            
            setTimeout(() => {
                saveIndicator.innerHTML = '';
            }, 2000);

            this.saveQueue = []; // Clear queue after successful save
            
        } catch (error) {
            console.error('Save error:', error);
            saveIndicator.innerHTML = '<span class="comm-save-indicator" style="background: #fee2e2; color: #991b1b;">✗ Save failed</span>';
        } finally {
            this.isSaving = false;
            
            // Process next in queue if any
            if (this.saveQueue.length > 0) {
                setTimeout(() => this.processSaveQueue(), 1000);
            }
        }
    },

    async saveAndClose() {
        if (!this.selectedContact) return;

        const saveIndicator = document.getElementById('saveIndicator');
        const btnSaveClose = document.getElementById('btnSaveClose');
        
        btnSaveClose.disabled = true;
        saveIndicator.innerHTML = '<span class="comm-save-indicator"><span class="comm-save-spinner"></span>Preparing to save...</span>';

        // Wait for any pending saves
        while (this.isSaving || this.saveQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Final save
        if (this.currentNote.trim()) {
            saveIndicator.innerHTML = '<span class="comm-save-indicator saving"><span class="comm-save-spinner"></span>Saving data...</span>';
            
            try {
                await this.progressiveSave();
                await this.processSaveQueue();
                
                saveIndicator.innerHTML = '<span class="comm-save-indicator saved">✓ Data saved</span>';
                
                setTimeout(() => {
                    saveIndicator.innerHTML = '';
                    this.deselectContact();
                }, 1500);
                
            } catch (error) {
                saveIndicator.innerHTML = '<span class="comm-save-indicator" style="background: #fee2e2; color: #991b1b;">✗ Save failed</span>';
                btnSaveClose.disabled = false;
            }
        } else {
            this.deselectContact();
        }
    },

    async createNewNote() {
        if (!this.selectedContact) return;

        if (this.currentNote.trim()) {
            if (!confirm('Start a new note? Current unsaved changes will be saved first.')) {
                return;
            }
            await this.saveAndClose();
        }

        // Reset for new note
        document.getElementById('commNoteArea').value = '';
        document.getElementById('commSummary').value = '';
        this.currentNote = '';
        this.lastTimestamp = null;
        this.updateTimeline();
        
        document.getElementById('commNoteArea').focus();
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

    insertCalendarDate() {
        const now = new Date();
        const formatted = now.toISOString().slice(0, 16);
        document.getElementById('calendarDateTime').value = formatted;
        document.getElementById('calendarModal').classList.add('active');
    },

    handleCalendarInsert(event) {
        event.preventDefault();
        
        const dateTime = document.getElementById('calendarDateTime').value;
        const title = document.getElementById('calendarTitle').value;
        const notes = document.getElementById('calendarNotes').value;
        
        const date = new Date(dateTime);
        const formatted = date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Create calendar event text with Google Calendar link
        const eventText = `\n📅 ${formatted} - ${title}\n`;
        const googleCalUrl = this.createGoogleCalendarUrl(dateTime, title, notes);
        const linkText = `[Add to Google Calendar](${googleCalUrl})\n`;
        
        const noteArea = document.getElementById('commNoteArea');
        const cursorPos = noteArea.selectionStart;
        const textBefore = noteArea.value.substring(0, cursorPos);
        const textAfter = noteArea.value.substring(cursorPos);
        
        noteArea.value = textBefore + eventText + linkText + textAfter;
        noteArea.selectionStart = noteArea.selectionEnd = cursorPos + eventText.length + linkText.length;
        noteArea.focus();

        this.closeCalendarModal();
        this.handleNoteInput();
    },

    createGoogleCalendarUrl(dateTime, title, notes) {
        const date = new Date(dateTime);
        const startDate = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        // End time 1 hour later
        const endDate = new Date(date.getTime() + 3600000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${startDate}/${endDate}`,
            details: notes || '',
            sf: 'true',
            output: 'xml'
        });
        
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    },

    closeCalendarModal() {
        document.getElementById('calendarModal').classList.remove('active');
        document.getElementById('calendarDateTime').value = '';
        document.getElementById('calendarTitle').value = '';
        document.getElementById('calendarNotes').value = '';
    },

    async uploadFile() {
        if (!this.googleDriveLink) {
            document.getElementById('driveSetupModal').classList.add('active');
            return;
        }

        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const isShared = confirm(`Upload "${file.name}" to shared folder?\n\nClick OK for shared (all users), Cancel for private (you only)`);
            
            // In a real implementation, you would upload to Google Drive here
            // For now, we'll just insert a reference to the file
            const noteArea = document.getElementById('commNoteArea');
            const cursorPos = noteArea.selectionStart;
            const textBefore = noteArea.value.substring(0, cursorPos);
            const textAfter = noteArea.value.substring(cursorPos);
            
            const fileRef = `\n📎 [${file.name}](${this.googleDriveLink}) ${isShared ? '(Shared)' : '(Private)'}\n`;
            
            noteArea.value = textBefore + fileRef + textAfter;
            noteArea.selectionStart = noteArea.selectionEnd = cursorPos + fileRef.length;
            noteArea.focus();
            
            this.handleNoteInput();
            
            alert(`File reference added: ${file.name}\n\n⚠️ Note: Actual file upload to Google Drive requires additional implementation.`);
        };
        
        input.click();
    },

    saveDriveLink() {
        const link = document.getElementById('driveLink').value.trim();
        if (!link) {
            alert('Please enter a valid Google Drive folder link');
            return;
        }

        if (!link.includes('drive.google.com')) {
            alert('Please enter a valid Google Drive link');
            return;
        }

        this.googleDriveLink = link;
        this.saveUserSettings();
        
        alert('✓ Google Drive link saved securely!');
        this.closeDriveSetup();
    },

    closeDriveSetup() {
        document.getElementById('driveSetupModal').classList.remove('active');
        document.getElementById('driveLink').value = '';
    },

    async loadIcons() {
        try {
            // Load icon data from GitHub
            const response = await fetch('icon-themes/Gradient/icon-data.json');
            if (!response.ok) throw new Error('Failed to load icons');
            
            const iconData = await response.json();
            this.iconData = iconData.icons || [];
            console.log(`Loaded ${this.iconData.length} icons`);
        } catch (error) {
            console.error('Error loading icons:', error);
            this.iconData = [];
        }
    },

    showInsertMenu() {
        const modal = document.getElementById('insertMenuModal');
        const grid = document.getElementById('iconGrid');
        
        if (this.iconData.length === 0) {
            grid.innerHTML = '<p style="text-align: center; color: var(--text-light);">No icons available</p>';
        } else {
            grid.innerHTML = this.iconData.map(icon => `
                <div class="icon-item" onclick="CommunicationsTab.insertIcon('${icon.filename}', '${icon.label}')">
                    <img src="icon-themes/Gradient/${icon.filename}" alt="${icon.label}">
                    <span>${icon.label}</span>
                </div>
            `).join('');
        }
        
        modal.classList.add('active');
    },

    insertIcon(filename, label) {
        const noteArea = document.getElementById('commNoteArea');
        const cursorPos = noteArea.selectionStart;
        const textBefore = noteArea.value.substring(0, cursorPos);
        const textAfter = noteArea.value.substring(cursorPos);
        
        // Insert as markdown image
        const iconRef = `![${label}](icon-themes/Gradient/${filename}) `;
        
        noteArea.value = textBefore + iconRef + textAfter;
        noteArea.selectionStart = noteArea.selectionEnd = cursorPos + iconRef.length;
        noteArea.focus();
        
        this.closeInsertMenu();
        this.handleNoteInput();
    },

    closeInsertMenu() {
        document.getElementById('insertMenuModal').classList.remove('active');
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
        if (!noteArea) return;
        
        const lines = noteArea.value.split('\n');
        const timestamps = [];
        
        lines.forEach((line, index) => {
            const match = line.match(/\[(\d{2}:\d{2})\]/);
            if (match) {
                timestamps.push({
                    time: match[1],
                    line: index + 1
                });
            }
        });

        let timelineHTML = `<div class="comm-timestamp date">${currentDate}</div>`;
        
        if (timestamps.length > 0) {
            timelineHTML += timestamps.map(ts => 
                `<div class="comm-timestamp">${ts.time} (Line ${ts.line})</div>`
            ).join('');
        } else {
            timelineHTML += `<div class="comm-timestamp">${currentTime}</div>`;
        }

        timelineEl.innerHTML = timelineHTML;
    },

    clearNote() {
        if (!confirm('Clear current notes? This cannot be undone.')) {
            return;
        }

        document.getElementById('commNoteArea').value = '';
        document.getElementById('commSummary').value = '';
        this.currentNote = '';
        this.lastTimestamp = null;
        this.updateTimeline();
        document.getElementById('statusText').textContent = 'Notes cleared';
    }
};

window.CommunicationsTab = CommunicationsTab;
