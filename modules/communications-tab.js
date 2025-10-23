// modules/communications-tab.js - Communications tab (Quill RTE) with NoteID session handling and deleted-notes support
// Updated: ensure RTE helpers present, guard Quill init if container missing, and check presence of methods before calling

const CommunicationsTab = {
  contacts: [],
  selectedContact: null,
  searchQuery: '',
  currentNote: '',
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
  currentNoteId: null,
  iconData: [],

  // Render the tab HTML (full markup required so #commEditor exists before Quill init)
  async render() {
    const container = document.getElementById('communications');
    container.innerHTML = `
      <div class="comm-container" id="commContainer">
        <div class="comm-sidebar">
          <div class="comm-sidebar-header">
            <h3 style="margin-bottom:10px;font-size:1.1em;">Contacts</h3>
            <input type="text" class="comm-search" placeholder="🔍 Search contacts..." oninput="CommunicationsTab.handleContactSearch(this.value)">
          </div>
          <div class="comm-contact-list" id="contactList">
            <div style="text-align:center;padding:40px 20px;color:var(--text-light)">Loading contacts...</div>
          </div>
          <div class="comm-history-list" id="historyList" style="display:none;">
            <div style="padding:15px;background:white;border-bottom:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong id="selectedContactHeader">Contact Name</strong>
                <button class="btn-sm btn-primary" onclick="CommunicationsTab.saveAndClose()" id="btnSaveClose">💾 Save & Close</button>
              </div>
            </div>
            <div id="historyItems" style="padding:10px"></div>
          </div>
        </div>

        <div class="comm-previous" id="previousView">
          <div class="comm-previous-header">
            <strong>Previous Note</strong>
            <button class="comm-previous-close" onclick="CommunicationsTab.closePreviousView()">✕</button>
          </div>
          <div class="comm-editor-container">
            <div style="padding:15px;background:white;border-radius:8px;margin-bottom:10px;">
              <strong id="prevSummary">Summary</strong>
              <div id="prevMeta" style="font-size:0.85em;color:var(--text-light);margin-top:5px">Date</div>
            </div>
            <div id="prevNoteArea" class="comm-prev-render" style="background:white;padding:12px;border-radius:6px;min-height:120px;overflow:auto"></div>
          </div>
        </div>

        <div class="comm-main">
          <div class="comm-main-header">
            <div id="selectedContactInfo"><p style="color:var(--text-light)">Select a contact to start logging communications</p></div>
            <input id="commSummary" type="text" class="comm-summary-input" placeholder="Communication summary" disabled style="display:none">
          </div>

          <div class="comm-editor-container">
            <div id="commEditor" style="min-height:200px;background:white;border-radius:6px;padding:8px;display:none;"></div>
            <textarea id="commNoteArea" class="comm-note-area" placeholder="Start typing your communication notes here..." style="display:none;width:100%;min-height:200px;padding:8px;box-sizing:border-box;"></textarea>
          </div>

          <div class="comm-toolbar">
            <button id="btnInsertTimestamp" class="btn btn-sm btn-secondary" onclick="CommunicationsTab.insertTimestamp()" disabled>🕐 Time</button>
            <button id="btnInsertDate" class="btn btn-sm btn-secondary" onclick="CommunicationsTab.insertCalendarDate()" disabled>📅 Date</button>
            <button id="btnUploadFile" class="btn btn-sm btn-secondary" onclick="CommunicationsTab.uploadFile()" disabled>📎 File</button>
            <button id="btnInsertMenu" class="btn btn-sm btn-secondary" onclick="CommunicationsTab.showInsertMenu()" disabled>✨ Insert</button>
            <button id="btnClearNote" class="btn btn-sm btn-secondary" onclick="CommunicationsTab.clearNote()" disabled>🗑️ Clear</button>
            <button id="btnNewNote" class="btn btn-sm btn-primary" onclick="CommunicationsTab.createNewNote()" disabled>📝 New Note</button>
            <span id="saveIndicator"></span>
          </div>

          <div class="comm-status">
            <span id="statusText">Ready</span>
          </div>
        </div>

        <div class="comm-timeline">
          <div class="comm-timeline-header">Timeline</div>
          <div class="comm-timeline-content" id="timelineContent">
            <p style="text-align:center;color:var(--text-light);font-size:0.9em">Timestamps will appear here as you type</p>
          </div>
        </div>
      </div>

      <!-- Insert Menu Modal -->
      <div id="insertMenuModal" class="modal">
        <div class="modal-content" style="max-width:600px;">
          <div class="modal-header">
            <h3>Insert Custom Element</h3>
            <button class="modal-close" onclick="CommunicationsTab.closeInsertMenu()">✕</button>
          </div>
          <div style="padding:20px;">
            <div id="iconGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:10px;max-height:400px;overflow-y:auto">
              <p style="text-align:center;color:var(--text-light)">Loading icons...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Calendar Modal -->
      <div id="calendarModal" class="modal">
        <div class="modal-content" style="max-width:500px;">
          <div class="modal-header">
            <h3>Insert Calendar Date</h3>
            <button class="modal-close" onclick="CommunicationsTab.closeCalendarModal()">✕</button>
          </div>
          <form onsubmit="CommunicationsTab.handleCalendarInsert(event)" style="padding:20px;">
            <div class="form-group">
              <label>Date & Time</label>
              <input type="datetime-local" id="calendarDateTime" required>
            </div>
            <div class="form-group">
              <label>Event Title</label>
              <input type="text" id="calendarTitle" required>
            </div>
            <div class="form-group">
              <label>Notes (optional)</label>
              <textarea id="calendarNotes" rows="3"></textarea>
            </div>
            <div style="display:flex;gap:10px;">
              <button type="submit" class="btn btn-primary" style="flex:1">📅 Insert Date</button>
              <button type="button" class="btn btn-secondary" style="flex:1" onclick="CommunicationsTab.closeCalendarModal()">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Drive setup -->
      <div id="driveSetupModal" class="modal">
        <div class="modal-content" style="max-width:500px;">
          <div class="modal-header"><h3>🔒 Google Drive Setup</h3><button class="modal-close" onclick="CommunicationsTab.closeDriveSetup()">✕</button></div>
          <div style="padding:20px;">
            <p style="margin-bottom:15px">Provide a link to your Google Drive folder with read/write permissions.</p>
            <div class="form-group">
              <label>Google Drive Folder Link</label>
              <input type="url" id="driveLink" placeholder="https://drive.google.com/drive/folders/..." required>
            </div>
            <div style="display:flex;gap:10px;margin-top:20px;">
              <button class="btn btn-primary" style="flex:1" onclick="CommunicationsTab.saveDriveLink()">💾 Save Link</button>
              <button class="btn btn-secondary" style="flex:1" onclick="CommunicationsTab.closeDriveSetup()">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <style>
        .comm-save-spinner{display:inline-block;width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite;margin-right:8px;vertical-align:middle}
        @keyframes spin{to{transform:rotate(360deg)}}
        .icon-item{display:flex;flex-direction:column;align-items:center;padding:10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all .2s}
        .icon-item img{width:40px;height:40px;margin-bottom:5px}
        @media (max-width:600px){.note-row{display:block !important}.note-ts{display:block;font-size:0.9em;color:var(--text-light);margin-bottom:6px}}
      </style>
    `;

    await this.init();
  },

  /* ---------- RTE loader and initialization ---------- */

  async _ensureRTE(cssUrl, jsUrl) {
    // If Quill present -> init
    if (window.Quill) {
      this._initQuill();
      return;
    }

    try {
      await this._loadCss(cssUrl);
      await this._loadScript(jsUrl);

      // ensure container exists before initializing Quill
      const editorEl = document.getElementById('commEditor');
      if (!editorEl) {
        console.warn('commEditor not found in DOM; will use textarea fallback.');
        this._rteFallback();
        return;
      }

      if (window.Quill) {
        this._initQuill();
      } else {
        console.warn('Quill loaded but not available; using fallback.');
        this._rteFallback();
      }
    } catch (err) {
      console.warn('Failed to load Quill assets, falling back to textarea.', err);
      this._rteFallback();
    }
  },

  _rteFallback() {
    this.useRTE = false;
    const ed = document.getElementById('commEditor');
    const ta = document.getElementById('commNoteArea');
    if (ed) ed.style.display = 'none';
    if (ta) ta.style.display = 'block';
  },

  _loadCss(url) {
    return new Promise((resolve, reject) => {
      // avoid double-loading
      if ([...document.getElementsByTagName('link')].some(l => l.href && l.href.includes(url))) return resolve();
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
      // avoid double-loading
      if ([...document.getElementsByTagName('script')].some(s => s.src && s.src.includes(url))) return resolve();
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
      // make sure container exists
      const container = document.getElementById('commEditor');
      if (!container) {
        console.warn('Quill container #commEditor missing; falling back to textarea.');
        this._rteFallback();
        return;
      }

      // initialize Quill
      this.editor = new Quill('#commEditor', {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image'],
            ['clean']
          ]
        }
      });

      // sanity check
      if (!this.editor || typeof this.editor.on !== 'function') {
        console.error('Quill created but editor instance invalid; using textarea fallback.');
        this._rteFallback();
        return;
      }

      this.editor.on('text-change', () => {
        this.currentNote = this.getEditorContent();
        this.updateTimeline();
        // don't perform network save on every keystroke; Enter triggers an explicit save
        this.queueAutoSave();
      });

      // show editor, hide fallback textarea
      const ta = document.getElementById('commNoteArea');
      if (ta) ta.style.display = 'none';
      container.style.display = 'block';

      this.useRTE = true;
      console.log('Quill initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Quill:', err);
      this._rteFallback();
    }
  },

  /* ---------- Initialization ---------- */

  async init() {
    console.log('Initializing Communications tab...');

    // paths relative to site root - ensure deploy copies them to _site/css and _site/js
    const cssPath = 'css/quill.css';
    const jsPath = 'js/quill.js';

    // ensure helper exists and call; guard if not defined
    if (typeof this._ensureRTE === 'function') {
      await this._ensureRTE(cssPath, jsPath);
    } else {
      console.warn('_ensureRTE not available; using textarea fallback.');
      this._rteFallback();
    }

    // Ensure the EncryptionService is ready (if needed)
    if (!window.EncryptionService || !EncryptionService.isReady()) {
      const cList = document.getElementById('contactList');
      if (cList) cList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger);">Encryption not initialized. Please refresh the page.</div>';
      return;
    }

    // Guard calls for existence to avoid "is not a function" runtime errors
    if (typeof this.loadContacts === 'function') await this.loadContacts();
    if (typeof this.loadUserSettings === 'function') await this.loadUserSettings();
    if (typeof this.displayContacts === 'function') this.displayContacts();
    if (typeof this.updateTimeline === 'function') this.updateTimeline();
    if (typeof this.loadIcons === 'function') await this.loadIcons();

    // Wire fallback textarea if not using RTE
    if (!this.useRTE) {
      const ta = document.getElementById('commNoteArea');
      if (ta) {
        ta.style.display = 'block';
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (typeof this.handleEnterSave === 'function') this.handleEnterSave();
          }
        });
        ta.addEventListener('input', () => {
          this.currentNote = ta.value;
          if (typeof this.updateTimeline === 'function') this.updateTimeline();
        });
      }
    } else {
      // ensure Enter triggers save but allows newline
      try {
        if (this.editor && this.editor.keyboard && typeof this.editor.keyboard.addBinding === 'function') {
          this.editor.keyboard.addBinding({ key: 13 }, (range, context) => {
            if (typeof this.handleEnterSave === 'function') {
              this.handleEnterSave().catch(e => console.error('Enter-save failed', e));
            }
            return true; // allow default newline behavior
          });
        }
      } catch (e) {
        console.warn('Failed to attach Enter binding to Quill', e);
      }
    }

    // Ensure toolbar initial state
    ['btnInsertTimestamp','btnInsertDate','btnUploadFile','btnInsertMenu','btnClearNote','btnNewNote'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !this.selectedContact;
    });
  },

  /* ---------- NoteID and save logic (unchanged) ---------- */

  _generateDateId() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  },

  _ensureCurrentNoteId() {
    if (!this.currentNoteId && this.selectedContact) {
      const dateId = this._generateDateId();
      this.currentNoteId = `${this.selectedContact.id}_${dateId}`;
    }
    return this.currentNoteId;
  },

  async handleEnterSave() {
    if (!this.selectedContact) {
      console.warn('No contact selected; cannot save note.');
      return;
    }

    const contentHtml = this.getEditorContent() || '';
    const plainText = this._stripHtml(contentHtml);
    const lines = plainText.split('\n');
    const nowTime = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });

    const savedHtmlLines = lines.map((line, idx) => {
      const trimmed = line.trim();
      const hasTs = /^\[\d{2}:\d{2}\]/.test(trimmed);
      if (!hasTs && trimmed !== '') {
        return `<div class="note-row" data-line="${idx}"><span class="note-ts">[${nowTime}]</span><span class="note-text">${this._escapeHtml(line)}</span></div>`;
      } else {
        const tsText = hasTs ? trimmed.match(/^\[\d{2}:\d{2}\]/)[0] : '';
        const text = hasTs ? trimmed.replace(/^\[\d{2}:\d{2}\]\s?/, '') : trimmed;
        return `<div class="note-row" data-line="${idx}"><span class="note-ts">${this._escapeHtml(tsText)}</span><span class="note-text">${this._escapeHtml(text)}</span></div>`;
      }
    }).join('');

    const noteId = this._ensureCurrentNoteId();
    if (!noteId) {
      console.error('Failed to build NoteID; aborting save.');
      return;
    }

    try {
      if (typeof CommunicationsStorage?.saveNoteById === 'function') {
        await CommunicationsStorage.saveNoteById(this.selectedContact.id, noteId.split('_')[1], savedHtmlLines, document.getElementById('commSummary')?.value || '');
      } else if (typeof CommunicationsStorage?.saveNoteSession === 'function') {
        // fallback if saveNoteById not present
        await CommunicationsStorage.saveNoteSession(this.selectedContact.id, noteId, savedHtmlLines, document.getElementById('commSummary')?.value || '');
      } else {
        throw new Error('No storage method available to save note.');
      }

      this.lastSaveTime = new Date();
      this.currentNote = savedHtmlLines;
      this._renderTimelineFromSavedContent(savedHtmlLines);
      if (typeof this.loadContactCommunications === 'function') await this.loadContactCommunications();
    } catch (err) {
      console.error('Error saving note (Enter):', err);
      alert('Failed to save note: ' + (err.message || err));
    }
  },

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
      timelineHTML += `<div class="comm-timestamp">${idx === 0 ? this._escapeHtml(tsText) : '&nbsp;'}</div>`;
    });

    if (rows.length === 0) {
      const nowStr = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
      timelineHTML = `<div class="comm-timestamp">${this._escapeHtml(nowStr)}</div>`;
    }

    timelineEl.innerHTML = timelineHTML;
  },

  /* ---------- Contacts/communications functions (existing) ---------- */

  async loadContacts() {
    try {
      this.contacts = await getContacts();
    } catch (err) {
      console.error('Error loading contacts', err);
      const listEl = document.getElementById('contactList');
      if (listEl) listEl.innerHTML = `<div style="text-align:center;padding:20px;color:var(--danger)">Error loading contacts</div>`;
    }
  },

  displayContacts() {
    const listEl = document.getElementById('contactList');
    if (!listEl) return;
    const filtered = this.getFilteredContacts();
    if (!filtered || filtered.length === 0) {
      listEl.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-light)">No contacts found</div>`;
      return;
    }
    listEl.innerHTML = filtered.map(contact => `
      <div class="comm-contact-item ${this.selectedContact?.id === contact.id ? 'active' : ''}" onclick="CommunicationsTab.selectContact(${contact.id})">
        <div class="comm-contact-name">${contact.name}</div>
        ${contact.organization ? `<div class="comm-contact-org">${contact.organization}</div>` : ''}
      </div>
    `).join('');
  },

  getFilteredContacts() {
    if (!this.searchQuery) return this.contacts.sort((a,b)=>a.name.localeCompare(b.name));
    const q = this.searchQuery.toLowerCase();
    return this.contacts.filter(c => c.name.toLowerCase().includes(q) || (c.organization||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  },

  handleContactSearch(value) {
    this.searchQuery = value;
    this.displayContacts();
  },

  async selectContact(contactId) {
    this.selectedContact = this.contacts.find(c => c.id === contactId);
    if (!this.selectedContact) return;
    document.getElementById('contactList').style.display = 'none';
    document.getElementById('historyList').style.display = 'block';
    document.getElementById('selectedContactHeader').textContent = this.selectedContact.name;
    document.getElementById('selectedContactInfo').innerHTML = `<h3 style="margin-bottom:5px">${this.selectedContact.name}</h3><p style="color:var(--text-light);font-size:0.9em">${this.selectedContact.organization || 'No organization'}</p>`;
    const summaryInput = document.getElementById('commSummary');
    if (summaryInput) { summaryInput.style.display='block'; summaryInput.disabled=false; }

    if (this.useRTE && this.editor) { try { this.editor.enable(true); this.setEditorContent(''); this.editor.focus(); } catch(e){ console.warn('Error enabling editor', e); } }
    else { const ta = document.getElementById('commNoteArea'); if (ta) { ta.disabled=false; ta.value=''; ta.focus(); } }

    this.currentNote=''; this.lastTimestamp=null; this.currentNoteId=null;
    ['btnInsertTimestamp','btnInsertDate','btnUploadFile','btnInsertMenu','btnClearNote','btnNewNote'].forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled=false; });

    if (typeof this.loadContactCommunications === 'function') await this.loadContactCommunications();
    if (window.currentUser && window.currentUser.isAdmin && typeof this._renderDeletedNotesSection === 'function') await this._renderDeletedNotesSection();
  },

  deselectContact() {
    this.selectedContact = null; this.communications = []; this.currentNote = ''; this.lastTimestamp = null; this.currentNoteId = null;
    document.getElementById('contactList').style.display = 'block';
    document.getElementById('historyList').style.display = 'none';
    const info = document.getElementById('selectedContactInfo'); if (info) info.innerHTML = `<p style="color:var(--text-light)">Select a contact to start logging communications</p>`;
    const summary = document.getElementById('commSummary'); if (summary) summary.style.display='none';
    if (!this.useRTE) { const ta = document.getElementById('commNoteArea'); if (ta) { ta.disabled=true; ta.value=''; } } else if (this.editor) { this.editor.disable(); this.setEditorContent(''); }
    ['btnInsertTimestamp','btnInsertDate','btnUploadFile','btnInsertMenu','btnClearNote','btnNewNote'].forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled=true; });
    this.displayContacts(); this.closePreviousView();
  },

  async loadContactCommunications() {
    try {
      this.communications = await CommunicationsStorage.listCommunications(this.selectedContact.id);
      this.displayCommunicationsList();
      const st = document.getElementById('statusText'); if (st) st.textContent = `${this.selectedContact.name} (${this.communications.length} previous communications)`;
    } catch (err) {
      console.error('Error loading communications', err);
      const st = document.getElementById('statusText'); if (st) st.textContent = 'Error loading communications';
    }
  },

  displayCommunicationsList() {
    const historyEl = document.getElementById('historyItems');
    if (!historyEl) return;
    if (!this.communications || this.communications.length === 0) { historyEl.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-light);font-size:0.9em">No previous communications</div>`; return; }

    historyEl.innerHTML = this.communications.map(comm => `
      <div class="comm-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 4px;">
        <div style="flex:1;"><div style="font-size:0.85em;color:var(--text-light)">${formatDate(comm.timestamp)}</div><div style="font-weight:600">${comm.summary || 'No summary'}</div></div>
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
      this.viewingComm = comm; document.getElementById('commContainer').classList.add('split-view');
      document.getElementById('prevSummary').textContent = comm.summary || 'No summary';
      document.getElementById('prevMeta').textContent = `${formatDate(comm.createdAt)} by ${comm.author}`;
      const prev = document.getElementById('prevNoteArea'); if (prev) prev.innerHTML = comm.content || this._escapeHtml(comm.content || '');
    } catch (err) { console.error('Error loading communication', err); alert('Failed to load communication'); }
  },

  closePreviousView() { const c = document.getElementById('commContainer'); if (c) c.classList.remove('split-view'); this.viewingComm = null; },

  /* ---------- small utility methods used across the module ---------- */

  getEditorContent() { if (this.useRTE && this.editor) return this.editor.root.innerHTML || ''; const ta = document.getElementById('commNoteArea'); return ta ? ta.value : ''; },

  setEditorContent(html) { if (this.useRTE && this.editor) { try { if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) this.editor.clipboard.dangerouslyPasteHTML(html || ''); else this.editor.root.innerHTML = html || ''; } catch (e) { this.editor.root.innerHTML = html || ''; } } else { const ta = document.getElementById('commNoteArea'); if (ta) ta.value = this._stripHtml(html || ''); } this.currentNote = html || ''; this.updateTimeline(); },

  updateTimeline() { const content = this.getEditorContent(); if (!content) { const t = document.getElementById('timelineContent'); if (t) t.innerHTML = ''; return; } let savedHtml = ''; if (/<div class="note-row"/.test(content)) savedHtml = content; else { const lines = this._stripHtml(content).split('\n'); savedHtml = lines.map((l,idx)=>`<div class="note-row" data-line="${idx}"><span class="note-ts"></span><span class="note-text">${this._escapeHtml(l)}</span></div>`).join(''); } this._renderTimelineFromSavedContent(savedHtml); },

  _escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); },

  _stripHtml(html) { if (!html) return ''; const d = document.createElement('div'); d.innerHTML = html; return d.textContent || d.innerText || ''; },

  _escapeJs(str) { if (!str) return ''; return String(str).replace(/'/g,"\\'").replace(/"/g,'\\"'); }

};

window.CommunicationsTab = CommunicationsTab;
