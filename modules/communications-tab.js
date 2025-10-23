// modules/communications-tab.js - Communications tab (Quill RTE) with NoteID session handling and deleted-notes support
// UPDATED: implements NoteID format <contactId>_<dateId>, Enter-triggered autosave that overwrites the same NoteID file,
//         dynamic timestamp/timeline mirroring line counts, admin-only Delete that archives (deleted_<file>) and shows Deleted Notes to admins.
//
// NOTE: This file expects CommunicationsStorage to provide:
//  - saveNoteById(contactId, dateId, contentHtml, summary)
//  - archiveAndDeleteNote(contactId, sessionKey, deletedBy)
//  - listDeletedNotes(contactId)
//  - loadDeletedNote(contactId, deletedId)

const CommunicationsTab = {
    contacts: [],
    selectedContact: null,
    searchQuery: '',
    currentNote: '',         // latest editor HTML
    communications: [],
    viewingComm: null,
    lastSaveTime: null,
    autoSaveTimer: null,
    saveQueue: [],
    isSaving: false,
    lastTimestamp: null,
    googleDriveLink: null,
    editor: null,
    useRTE: false,
    currentNoteId: null,     // NoteID: <contactId>_<dateId>
    iconData: [],

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
                        <div style="padding: 15px; background: white; border-bottom: 1px solid var(--border);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong id="selectedContactHeader">Contact Name</strong>
                                <button class="btn-sm btn-primary" onclick="CommunicationsTab.saveAndClose()" id="btnSaveClose">
                                    💾 Save & Close
                                </button>
                            </div>
                        </div>
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
                        <div id="prevNoteArea" class="comm-prev-render" style="background: white; padding: 12px; border-radius: 6px; min-height: 120px; overflow:auto;"></div>
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
                        <!-- RTE container (Quill) -->
                        <div id="commEditor" style="min-height:200px; background:white; border-radius:6px; padding:8px; display:none;"></div>

                        <!-- Fallback textarea (hidden when Quill is used) -->
                        <textarea 
                            id="commNoteArea" 
                            class="comm-note-area" 
                            placeholder="Start typing your communication notes here...&#10;&#10;Press Enter to save current line and add timestamp if needed.&#10;Text auto-saves progressively."
                            style="display:none; width:100%; min-height:200px; padding:8px; box-sizing:border-box;"
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

                .comm-prev-render img {
                    max-width: 100%;
                    height: auto;
                }

                /* Mobile: show timestamp above each message (when previewing) */
                @media (max-width: 600px) {
                    .note-row { display:block !important; }
                    .note-ts { display:block; font-size:0.9em; color:var(--text-light); margin-bottom:6px; }
                }
            </style>
        `;
        await this.init();
    },

    /* ---------- RTE loader and initialization (was missing) ---------- */

    // Load local Quill css + js; fallback to textarea on failure
    async _ensureRTE(cssUrl, jsUrl) {
        // If Quill already present, init
        if (window.Quill) {
            this._initQuill();
            return;
        }

        try {
            await this._loadCss(cssUrl);
            await this._loadScript(jsUrl);
            if (window.Quill) {
                this._initQuill();
            } else {
                console.warn('Quill script loaded but window.Quill is not defined; using textarea fallback.');
                this._rteFallback();
            }
        } catch (err) {
            console.warn('Failed to load local Quill resources, using textarea fallback.', err);
            this._rteFallback();
        }
    },

    _rteFallback() {
        this.useRTE = false;
        const editorDiv = document.getElementById('commEditor');
        const ta = document.getElementById('commNoteArea');
        if (editorDiv) editorDiv.style.display = 'none';
        if (ta) ta.style.display = 'block';
    },

    _loadCss(url) {
        return new Promise((resolve, reject) => {
            // If already loaded, resolve
            if ([...document.getElementsByTagName('link')].some(l => l.href && l.href.includes(url))) {
                return resolve();
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => resolve();
            link.onerror = () => reject(new Error('Failed to load css: ' + url));
            document.head.appendChild(link);
        });
    },

    _loadScript(url) {
        return new Promise((resolve, reject) => {
            // If a script with same src already exists, resolve
            if ([...document.getElementsByTagName('script')].some(s => s.src && s.src.includes(url))) {
                return resolve();
            }
            const s = document.createElement('script');
            s.src = url;
            s.defer = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load script: ' + url));
            document.body.appendChild(s);
        });
    },

    _initQuill() {
        try {
            // Initialize Quill with a compact toolbar
            this.editor = new Quill('#commEditor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ header: [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['link', 'image'],
                        ['clean']
                    ],
                    keyboard: {
                        bindings: {}
                    }
                }
            });

            // When Quill content changes, update state and queue save
            this.editor.on('text-change', () => {
                this.currentNote = this.getEditorContent();
                this.updateTimeline();
                // Do not auto-persist on every change to avoid excessive API calls; Enter triggers save
                this.queueAutoSave();
            });

            // Hide fallback textarea, show editor
            const ta = document.getElementById('commNoteArea');
            if (ta) ta.style.display = 'none';
            const ed = document.getElementById('commEditor');
            if (ed) ed.style.display = 'block';

            this.useRTE = true;
            console.log('Quill initialized (local build) for CommunicationsTab');

            // Ensure Enter binding exists - we add handler via keyboard module only if available
            if (this.editor && this.editor.keyboard && typeof this.editor.keyboard.addBinding === 'function') {
                // keep default behavior but intercept to trigger save
                this.editor.keyboard.addBinding({ key: 13 }, (range, context) => {
                    // If shiftKey pressed, user wants newline; still save but keep newline
                    this.handleEnterSave().catch(err => console.error('Enter save failed', err));
                    return true; // allow default behavior
                });
            }
        } catch (e) {
            console.error('Failed to initialize Quill:', e);
            this._rteFallback();
        }
    },

    /* ---------- NoteID helpers ---------- */

    // Generate a dateId (YYYYMMDDTHHMMSS) used to form NoteID: <contactId>_<dateId>
    _generateDateId() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const dateId = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        return dateId;
    },

    // Ensure currentNoteId exists for active editing session
    _ensureCurrentNoteId() {
        if (!this.currentNoteId) {
            const dateId = this._generateDateId();
            this.currentNoteId = `${this.selectedContact.id}_${dateId}`;
        }
        return this.currentNoteId;
    },

    // Called when Enter is pressed (or can be invoked from a toolbar action)
    async handleEnterSave() {
        if (!this.selectedContact) {
            console.warn('No contact selected; cannot save note.');
            return;
        }

        // Build content to save in the internal two-column format (invisible grid)
        const contentHtml = this.getEditorContent() || '';
        const plainText = this._stripHtml(contentHtml);
        // Keep blank lines to mirror height
        const lines = plainText.split('\n');

        // Determine timestamp for newly created lines: use current time for first non-empty or last line
        const nowTime = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });

        const savedHtmlLines = lines.map((line, idx) => {
            const trimmed = line.trim();
            const hasTs = /^\[\d{2}:\d{2}\]/.test(trimmed);
            if (!hasTs && trimmed !== '') {
                // Insert timestamp at beginning for lines that have content and no timestamp
                return `<div class="note-row" data-line="${idx}"><span class="note-ts">[${nowTime}]</span><span class="note-text">${this._escapeHtml(line)}</span></div>`;
            } else {
                // Keep existing timestamp if present, otherwise empty ts placeholder
                const tsText = hasTs ? trimmed.match(/^\[\d{2}:\d{2}\]/)[0] : '';
                const textWithoutTs = hasTs ? trimmed.replace(/^\[\d{2}:\d{2}\]\s?/, '') : trimmed;
                return `<div class="note-row" data-line="${idx}"><span class="note-ts">${this._escapeHtml(tsText)}</span><span class="note-text">${this._escapeHtml(textWithoutTs)}</span></div>`;
            }
        }).join('');

        // use NoteID pattern: <contactId>_<dateId>
        const noteId = this._ensureCurrentNoteId();

        try {
            // Save via CommunicationsStorage wrapper (it will overwrite same file)
            await CommunicationsStorage.saveNoteById(this.selectedContact.id, noteId.split('_')[1], savedHtmlLines, document.getElementById('commSummary')?.value || '');
            this.lastSaveTime = new Date();
            // update timeline (mirrors line count) using the saved lines
            this.currentNote = savedHtmlLines;
            this._renderTimelineFromSavedContent(savedHtmlLines);
            // refresh history list (manifest updated by saveNoteById)
            await this.loadContactCommunications(); // reload communications/notes list
        } catch (err) {
            console.error('Error saving note (Enter):', err);
            alert('Failed to save note: ' + (err.message || err));
        }
    },

    // Render the timeline .comm-timestamp block so it mirrors the line count of the saved content
    _renderTimelineFromSavedContent(savedHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${savedHtml}</div>`, 'text/html');
        const rows = Array.from(doc.querySelectorAll('.note-row'));
        const timelineEl = document.getElementById('timelineContent');
        if (!timelineEl) return;

        let timelineHTML = '';
        rows.forEach((row, idx) => {
            const tsEl = row.querySelector('.note-ts');
            const tsText = tsEl ? tsEl.textContent.trim() : '';
            if (idx === 0) {
                timelineHTML += `<div class="comm-timestamp">${this._escapeHtml(tsText)}</div>`;
            } else {
                timelineHTML += `<div class="comm-timestamp">&nbsp;</div>`;
            }
        });

        if (rows.length === 0) {
            const now = new Date();
            const nowStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
            timelineHTML = `<div class="comm-timestamp">${this._escapeHtml(nowStr)}</div>`;
        }

        timelineEl.innerHTML = timelineHTML;
    },

    /* ---------- Delete / Deleted-notes UI integration ---------- */

    // Called from delete button in a comm-history-item (visible only to admins)
    async handleDeleteNoteClick(commId) {
        if (!confirm('Delete this note (it will be archived and only visible to admins)?')) return;
        try {
            await CommunicationsStorage.archiveAndDeleteNote(this.selectedContact.id, commId, (window.currentUser && window.currentUser.email) || 'unknown');
            // refresh lists and UI
            await this.loadContactCommunications();
            if (window.currentUser && window.currentUser.isAdmin) {
                this._renderDeletedNotesSection();
            }
            alert('Note archived (deleted).');
        } catch (err) {
            console.error('Archive/Delete failed', err);
            alert('Failed to archive/delete note: ' + (err.message||err));
        }
    },

    // Render deleted notes area in contact profile when admin
    async _renderDeletedNotesSection() {
        if (!(window.currentUser && window.currentUser.isAdmin)) return;
        const deletedList = await CommunicationsStorage.listDeletedNotes(this.selectedContact.id);
        const containerId = 'deletedNotesContainer';
        let container = document.getElementById(containerId);
        if (!container) {
            const parent = document.getElementById('selectedContactInfo') || document.body;
            container = document.createElement('div');
            container.id = containerId;
            container.style.marginTop = '12px';
            parent.appendChild(container);
        }
        if (deletedList.length === 0) {
            container.innerHTML = `<div style="color:var(--text-light);">No deleted notes</div>`;
            return;
        }

        const items = deletedList.map(d => {
            return `<div style="padding:6px 0;">
                        <strong>${this._escapeHtml(d.id)}</strong>
                        <div style="font-size:0.85em;color:var(--text-light);">Deleted: ${this._escapeHtml(d.deletedAt)} by ${this._escapeHtml(d.deletedBy)}</div>
                        <button class="btn-sm btn-secondary" onclick="CommunicationsTab._openDeletedNote('${d.id}')">View</button>
                    </div>`;
        }).join('');

        container.innerHTML = `<h4>Deleted Notes (admin)</h4>${items}`;
    },

    // Open and show deleted note details (admin only)
    async _openDeletedNote(deletedId) {
        try {
            const data = await CommunicationsStorage.loadDeletedNote(this.selectedContact.id, deletedId);
            const meta = data.deletedMeta || {};
            const original = data.originalNote || {};
            let message = `Deleted by: ${meta.deletedBy}\nDeleted at: ${meta.deletedAt}\n\nOriginal content preview:\n`;
            if (typeof original === 'string') {
                message += original.slice(0, 1000);
            } else if (original && original.content) {
                message += (typeof original.content === 'string' ? original.content : JSON.stringify(original.content)).slice(0,1000);
            } else {
                message += '[no preview available]';
            }
            alert(message);
        } catch (err) {
            console.error('Failed to load deleted note', err);
            alert('Failed to load deleted note: ' + (err.message||err));
        }
    },

    /* ---------- Utilities and existing behavior adapted to NoteID ---------- */

    // getEditorContent / setEditorContent: normalized (HTML strings)
    getEditorContent() {
        if (this.useRTE && this.editor) {
            return this.editor.root.innerHTML || '';
        } else {
            const ta = document.getElementById('commNoteArea');
            return ta ? ta.value : '';
        }
    },

    setEditorContent(html) {
        if (this.useRTE && this.editor) {
            try {
                if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) {
                    this.editor.clipboard.dangerouslyPasteHTML(html || '');
                } else {
                    this.editor.root.innerHTML = html || '';
                }
            } catch (e) {
                this.editor.root.innerHTML = html || '';
            }
        } else {
            const ta = document.getElementById('commNoteArea');
            if (ta) ta.value = this._stripHtml(html || '');
        }
        this.currentNote = html || '';
        this.updateTimeline();
    },

    updateTimeline() {
        const content = this.getEditorContent();
        if (!content) {
            const timelineEl = document.getElementById('timelineContent');
            if (timelineEl) timelineEl.innerHTML = '';
            return;
        }
        let savedHtml = '';
        if (/<div class="note-row"/.test(content)) {
            savedHtml = content;
        } else {
            const lines = this._stripHtml(content).split('\n');
            savedHtml = lines.map((l, idx) => `<div class="note-row" data-line="${idx}"><span class="note-ts"></span><span class="note-text">${this._escapeHtml(l)}</span></div>`).join('');
        }
        this._renderTimelineFromSavedContent(savedHtml);
    },

    _escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    },

    _stripHtml(html) {
        if (!html) return '';
        const d = document.createElement('div');
        d.innerHTML = html;
        return d.textContent || d.innerText || '';
    },

    _escapeJs(str) {
        if (!str) return '';
        return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
    },

    /* ---------- Storage/contacts/helpers and UI functions ---------- */

    async loadUserSettings() {
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

        document.getElementById('contactList').style.display = 'none';
        document.getElementById('historyList').style.display = 'block';
        document.getElementById('selectedContactHeader').textContent = this.selectedContact.name;

        this.displayContacts();
        document.getElementById('selectedContactInfo').innerHTML = `
            <h3 style="margin-bottom: 5px;">${this.selectedContact.name}</h3>
            <p style="color: var(--text-light); font-size: 0.9em;">
                ${this.selectedContact.organization || 'No organization'} • ${this.selectedContact.type || 'Contact'}
            </p>
        `;

        const summaryInput = document.getElementById('commSummary');
        summaryInput.style.display = 'block';
        summaryInput.disabled = false;

        // Enable editor or textarea
        if (this.useRTE && this.editor) {
            try {
                this.editor.enable(true);
                this.setEditorContent(''); // clear current editing area
                this.editor.focus();
            } catch (e) {
                console.warn('Error enabling editor', e);
            }
        } else {
            const ta = document.getElementById('commNoteArea');
            if (ta) {
                ta.disabled = false;
                ta.value = '';
                ta.focus();
            }
        }

        this.currentNote = '';
        this.lastTimestamp = null;
        this.currentNoteId = null; // reset session NoteID for new contact or new session

        // Enable toolbar buttons
        ['btnInsertTimestamp','btnInsertDate','btnUploadFile','btnInsertMenu','btnClearNote','btnNewNote'].forEach(id=>{
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });

        await this.loadContactCommunications();
        if (window.currentUser && window.currentUser.isAdmin) {
            await this._renderDeletedNotesSection();
        }
    },

    deselectContact() {
        this.selectedContact = null;
        this.communications = [];
        this.currentNote = '';
        this.lastTimestamp = null;
        this.currentNoteId = null;
        
        document.getElementById('contactList').style.display = 'block';
        document.getElementById('historyList').style.display = 'none';
        
        document.getElementById('selectedContactInfo').innerHTML = `
            <p style="color: var(--text-light);">Select a contact to start logging communications</p>
        `;
        
        document.getElementById('commSummary').style.display = 'none';
        if (!this.useRTE) {
            const ta = document.getElementById('commNoteArea');
            if (ta) { ta.disabled = true; ta.value = ''; }
        } else if (this.editor) {
            this.editor.disable();
            this.setEditorContent('');
        }
        
        ['btnInsertTimestamp','btnInsertDate','btnUploadFile','btnInsertMenu','btnClearNote','btnNewNote'].forEach(id=>{
            const el = document.getElementById(id);
            if (el) el.disabled = true;
        });
        
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

        // Each item includes Delete button if admin
        historyEl.innerHTML = this.communications.map(comm => `
            <div class="comm-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;">
                <div style="flex:1;">
                    <div style="font-size:0.85em;color:var(--text-light)">${formatDate(comm.timestamp)}</div>
                    <div style="font-weight:600">${comm.summary || 'No summary'}</div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="btn-sm btn-primary" onclick="CommunicationsTab.viewCommunication('${comm.id}')">View</button>
                    ${ (window.currentUser && window.currentUser.isAdmin) ? `<button class="btn-sm btn-danger" onclick="CommunicationsTab.handleDeleteNoteClick('${comm.id}')">Delete</button>` : '' }
                </div>
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

            const prev = document.getElementById('prevNoteArea');
            if (prev) {
                // comm.content may be HTML (our note-row HTML) or plain text; render it safely
                prev.innerHTML = comm.content || this._escapeHtml(comm.content || '');
            }
            
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

    // Save & Close (process queue then deselect)
    async saveAndClose() {
        if (!this.selectedContact) return;

        const saveIndicator = document.getElementById('saveIndicator');
        const btnSaveClose = document.getElementById('btnSaveClose');
        
        btnSaveClose.disabled = true;
        saveIndicator.innerHTML = '<span class="comm-save-indicator"><span class="comm-save-spinner"></span>Preparing to save...</span>';

        while (this.isSaving || this.saveQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Force a final save using handleEnterSave pattern (will write current NoteID)
        await this.handleEnterSave();

        // Wait briefly then deselect
        setTimeout(() => {
            saveIndicator.innerHTML = '';
            this.deselectContact();
        }, 800);
    },

    async createNewNote() {
        if (!this.selectedContact) return;

        // If current content exists and user confirms, save then clear
        if ((this.getEditorContent() || '').toString().trim()) {
            if (!confirm('Start a new note? Current unsaved changes will be saved first.')) {
                return;
            }
            await this.handleEnterSave();
        }

        // Reset editor
        if (this.useRTE && this.editor) {
            this.setEditorContent('');
            this.editor.focus();
        } else {
            const ta = document.getElementById('commNoteArea');
            if (ta) { ta.value = ''; ta.focus(); }
        }

        document.getElementById('commSummary').value = '';
        this.currentNote = '';
        this.lastTimestamp = null;
        this.currentNoteId = null;
        this.updateTimeline();
    },

    insertTimestamp() {
        const now = new Date();
        const timestamp = `[${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}] `;

        if (this.useRTE && this.editor) {
            const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
            this.editor.insertText(range.index, timestamp, 'user');
            this.editor.setSelection(range.index + timestamp.length);
            this.editor.focus();
        } else {
            const noteArea = document.getElementById('commNoteArea');
            const cursorPos = noteArea.selectionStart;
            const textBefore = noteArea.value.substring(0, cursorPos);
            const textAfter = noteArea.value.substring(cursorPos);
            noteArea.value = textBefore + timestamp + textAfter;
            noteArea.selectionStart = noteArea.selectionEnd = cursorPos + timestamp.length;
            noteArea.focus();
            this.currentNote = noteArea.value;
        }

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

        const eventText = `\n📅 ${formatted} - ${title}\n`;
        const googleCalUrl = this.createGoogleCalendarUrl(dateTime, title, notes);
        const linkHtml = `<a href="${googleCalUrl}" target="_blank">Add to Google Calendar</a>\n`;

        if (this.useRTE && this.editor) {
            const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
            try {
                const htmlSnippet = `${this._escapeHtml(eventText)}<br>${linkHtml}<br>`;
                if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) {
                    this.editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet);
                } else {
                    this.editor.insertText(range.index, eventText + ' Add to Google Calendar\n', 'user');
                }
            } catch (e) {
                this.editor.insertText(range.index, eventText + ' Add to Google Calendar\n', 'user');
            }
            this.editor.focus();
        } else {
            const noteArea = document.getElementById('commNoteArea');
            const cursorPos = noteArea.selectionStart;
            const textBefore = noteArea.value.substring(0, cursorPos);
            const textAfter = noteArea.value.substring(cursorPos);
            noteArea.value = textBefore + eventText + this._stripHtml(linkHtml) + textAfter;
            noteArea.selectionStart = noteArea.selectionEnd = cursorPos + eventText.length + this._stripHtml(linkHtml).length;
            noteArea.focus();
            this.currentNote = noteArea.value;
        }

        this.closeCalendarModal();
        this.handleNoteInput();
    },

    createGoogleCalendarUrl(dateTime, title, notes) {
        const date = new Date(dateTime);
        const startDate = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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

        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const isShared = confirm(`Upload "${file.name}" to shared folder?\n\nClick OK for shared (all users), Cancel for private (you only)`);

            const fileHtml = `\n📎 <a href="${this.googleDriveLink}" target="_blank">${this._escapeHtml(file.name)}</a> ${isShared ? '(Shared)' : '(Private)'}\n`;

            if (this.useRTE && this.editor) {
                const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
                try {
                    if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) {
                        this.editor.clipboard.dangerouslyPasteHTML(range.index, fileHtml);
                    } else {
                        this.editor.insertText(range.index, `📎 ${file.name} (${isShared ? 'Shared' : 'Private'})`, 'user');
                    }
                } catch (e) {
                    this.editor.insertText(range.index, `📎 ${file.name} (${isShared ? 'Shared' : 'Private'})`, 'user');
                }
                this.editor.focus();
            } else {
                const noteArea = document.getElementById('commNoteArea');
                const cursorPos = noteArea.selectionStart;
                const textBefore = noteArea.value.substring(0, cursorPos);
                const textAfter = noteArea.value.substring(cursorPos);
                noteArea.value = textBefore + this._stripHtml(fileHtml) + textAfter;
                noteArea.selectionStart = noteArea.selectionEnd = cursorPos + this._stripHtml(fileHtml).length;
                noteArea.focus();
                this.currentNote = noteArea.value;
            }

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
                <div class="icon-item" onclick="CommunicationsTab.insertIcon('${this._escapeJs(icon.filename)}', '${this._escapeJs(icon.label)}')">
                    <img src="icon-themes/Gradient/${this._escapeJs(icon.filename)}" alt="${this._escapeHtml(icon.label)}">
                    <span>${this._escapeHtml(icon.label)}</span>
                </div>
            `).join('');
        }
        
        modal.classList.add('active');
    },

    insertIcon(filename, label) {
        const imgHtml = `<img src="icon-themes/Gradient/${this._escapeHtml(filename)}" alt="${this._escapeHtml(label)}" style="max-width:48px; max-height:48px;"> `;
        if (this.useRTE && this.editor) {
            const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
            try {
                if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) {
                    this.editor.clipboard.dangerouslyPasteHTML(range.index, imgHtml);
                } else {
                    this.editor.insertText(range.index, `[${label}]`, 'user');
                }
            } catch (e) {
                this.editor.insertText(range.index, `[${label}]`, 'user');
            }
            this.editor.focus();
        } else {
            const noteArea = document.getElementById('commNoteArea');
            const cursorPos = noteArea.selectionStart;
            const textBefore = noteArea.value.substring(0, cursorPos);
            const textAfter = noteArea.value.substring(cursorPos);
            noteArea.value = textBefore + `![${label}](icon-themes/Gradient/${filename}) ` + textAfter;
            noteArea.selectionStart = noteArea.selectionEnd = cursorPos + (`![${label}](icon-themes/Gradient/${filename}) `).length;
            noteArea.focus();
            this.currentNote = noteArea.value;
        }

        this.closeInsertMenu();
        this.handleNoteInput();
    },

    closeInsertMenu() {
        document.getElementById('insertMenuModal').classList.remove('active');
    },

    handleNoteInput() {
        this.currentNote = this.getEditorContent();
        this.updateTimeline();
        this.queueAutoSave();
    },

    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            this.saveLine();
        }
    },

    saveLine() {
        const now = Date.now();
        if (!this.lastTimestamp || (now - this.lastTimestamp) > 60000) {
            setTimeout(() => {
                this.insertTimestamp();
                this.lastTimestamp = now;
            }, 10);
        }
        this.queueAutoSave();
    },

    queueAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        this.autoSaveTimer = setTimeout(() => {
            // autosave behavior here will reuse currentNoteId (overwrites)
            this.handleEnterSave().catch(err => console.error('Auto-save failed', err));
        }, 2000);
    },

    // Utilities for displaying/manipulating deleted-note data are in CommunicationsStorage

};

window.CommunicationsTab = CommunicationsTab;
