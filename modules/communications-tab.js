// modules/communications-tab.js - Communications tab (Quill RTE) with integrated toolbar handlers and timeline alignment fixes
// Updated: integrate controls into the Quill toolbar (not separate buttons), ensure editor has scrollbar,
// align timeline top with editor top and remove gap, add custom toolbar handlers (link prompt, calendar modal, file/image handlers),
// keep autosave and Save & Close working (queueAutoSave & saveAndClose present), responsive layout.

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

  async render() {
    const container = document.getElementById('communications');
    container.innerHTML = `
      <div class="comm-container" id="commContainer" style="display:flex; gap:12px; align-items:flex-start; width:100%;">
        <div class="comm-sidebar" style="flex:0 0 260px;">
          <div class="comm-sidebar-header">
            <h3 style="margin-bottom:8px; font-size:1.05em;">Contacts</h3>
            <input type="text" class="comm-search" placeholder="🔍 Search contacts..." oninput="CommunicationsTab.handleContactSearch(this.value)" style="width:100%;padding:6px;">
          </div>
          <div class="comm-contact-list" id="contactList" style="margin-top:8px;"></div>
          <div class="comm-history-list" id="historyList" style="display:none; margin-top:10px;">
            <div style="padding:10px;background:white;border-bottom:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong id="selectedContactHeader">Contact Name</strong>
                <button id="btnSaveClose" class="btn-sm" title="Save & Close" style="background:white;color:black;border:1px solid #ddd;" onclick="CommunicationsTab.saveAndClose()">💾 Save & Close</button>
              </div>
            </div>
            <div id="historyItems" style="padding:10px;"></div>
          </div>
        </div>

        <div class="comm-main" style="flex:1 1 auto; min-width:420px;">
          <div class="comm-main-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div id="selectedContactInfo" style="flex:1;">
              <p style="color:var(--text-light); margin:0;">Select a contact to start logging communications</p>
            </div>
            <input id="commSummary" type="text" placeholder="Summary (optional)" style="flex:0 0 280px; padding:6px; display:none;">
          </div>

          <!-- Layout: toolbar+editor (left) and timeline (right)
               We use a flex row with align-items:flex-start so the top of the editor and the top of the timeline align.
               The Quill toolbar is the element with id quill-toolbar and is passed to Quill as toolbar container.
          -->
          <div class="comm-editor-and-timeline" style="display:flex; gap:0; margin-top:10px; align-items:flex-start;">
            <div class="comm-editor-wrapper" style="flex:1 1 auto; border:1px solid transparent;">
              <!-- Quill toolbar: integrated with Quill (container passed to Quill) -->
              <div id="quill-toolbar" style="background:#fff; border:1px solid var(--border); border-bottom:none; border-radius:6px 6px 0 0; padding:6px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
                <!-- Use standard quill classes for built-in formats -->
                <span class="ql-formats">
                  <select class="ql-header">
                    <option value="1"></option>
                    <option value="2"></option>
                    <option value="3"></option>
                    <option selected></option>
                  </select>
                  <button class="ql-bold"></button>
                  <button class="ql-italic"></button>
                  <button class="ql-underline"></button>
                  <button class="ql-strike"></button>
                </span>
                <span class="ql-formats">
                  <button class="ql-list" value="ordered"></button>
                  <button class="ql-list" value="bullet"></button>
                </span>
                <span class="ql-formats">
                  <select class="ql-color"></select>
                  <select class="ql-background"></select>
                </span>

                <!-- built-in link/image -->
                <span class="ql-formats">
                  <button class="ql-link"></button>
                  <button class="ql-image"></button>
                </span>

                <!-- custom handlers: emoji, calendar, file, table, save -->
                <span class="ql-formats">
                  <button class="ql-insertEmoji" title="Insert emoji">😀</button>
                  <button class="ql-insertCalendar" title="Insert calendar event">📅</button>
                  <button class="ql-insertFile" title="Insert file">📎</button>
                  <button class="ql-insertTable" title="Insert table">🔳</button>
                  <button class="ql-save" title="Save note">💾</button>
                </span>
              </div>

              <!-- Quill editor container: Quill expects a single container element -->
              <div id="commEditor" style="min-height:220px; max-height:480px; overflow:hidden; border:1px solid var(--border); border-top:none; border-radius:0 0 6px 6px;">
                <!-- Quill will populate this node -->
              </div>

              <!-- Fallback textarea -->
              <textarea id="commNoteArea" style="display:none; width:100%; min-height:220px; padding:8px; box-sizing:border-box;"></textarea>
            </div>

            <!-- Timeline aligned to top of editor with no gap -->
            <div class="comm-timeline" style="flex:0 0 160px; margin-left:0; display:flex; flex-direction:column; gap:6px;">
              <div class="comm-timeline-header" style="font-weight:600; margin-bottom:0;">Timeline</div>
              <div class="comm-timeline-content" id="timelineContent" style="background:white; padding:8px; border:1px solid var(--border); border-radius:6px; min-height:200px; overflow:auto;"></div>
            </div>
          </div>

          <div id="statusArea" style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <div id="saveIndicator"></div>
            <div id="statusText" style="color:var(--text-light)">Ready</div>
          </div>
        </div>
      </div>

      <!-- Calendar modal (as before) -->
      <div id="rteCalendarModal" class="modal" style="display:none;">
        <div class="modal-content" style="max-width:600px;">
          <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;">
            <h3>Create Calendar Event</h3>
            <button onclick="CommunicationsTab._closeCalendarModal()">✕</button>
          </div>
          <div style="padding:12px;">
            <form id="rteCalendarForm">
              <div style="display:grid;grid-template-columns:1fr 1fr; gap:8px;">
                <label>Start<input id="rteCalStart" type="datetime-local" required></label>
                <label>End<input id="rteCalEnd" type="datetime-local" required></label>
              </div>
              <label>Title<input id="rteCalTitle" type="text" required></label>
              <label>Description<textarea id="rteCalDesc" rows="3"></textarea></label>
              <label>Location<input id="rteCalLoc" type="text"></label>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <button type="submit" class="btn btn-primary">Create / Open in Google Calendar</button>
                <button type="button" class="btn" onclick="CommunicationsTab._closeCalendarModal()">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>
        /* Ensure Quill editor content scrolls internally */
        #commEditor .ql-editor {
          max-height: 480px;
          overflow-y: auto;
        }
        /* inserted images default width 30% */
        #commEditor img.inserted-image { width:30%; height:auto; display:block; }
        /* selected contact highlight */
        .comm-contact-item.selected { background:#0b57d0; color:white; padding:8px; border-radius:6px; }
        .comm-history-item.selected { background:#0b57d0; color:white; }
        /* remove gap between editor top and timeline: handled by flex align-items:flex-start */
        @media (max-width:900px) {
          .comm-container { flex-direction:column; }
        }
      </style>
    `;

    await this.init();
  },

  /* ---------- RTE helper + initialization ---------- */

  async _ensureRTE(cssUrl, jsUrl) {
    if (window.Quill) {
      this._initQuill();
      return;
    }
    try {
      await this._loadCss(cssUrl);
      await this._loadScript(jsUrl);
      if (window.Quill) this._initQuill();
      else this._rteFallback();
    } catch (err) {
      console.warn('RTE load failed', err);
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
      if ([...document.getElementsByTagName('link')].some(l => l.href && l.href.includes(url))) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = url;
      link.onload = () => resolve(); link.onerror = () => reject(new Error('Failed to load css: ' + url));
      document.head.appendChild(link);
    });
  },

  _loadScript(url) {
    return new Promise((resolve, reject) => {
      if ([...document.getElementsByTagName('script')].some(s => s.src && s.src.includes(url))) return resolve();
      const s = document.createElement('script'); s.src = url; s.defer = true;
      s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load script: ' + url));
      document.body.appendChild(s);
    });
  },

  _initQuill() {
    try {
      const editorContainer = document.getElementById('commEditor');
      const toolbarContainer = document.getElementById('quill-toolbar');
      if (!editorContainer) { this._rteFallback(); return; }

      // initialize Quill with the toolbar DOM element
      this.editor = new Quill('#commEditor', {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarContainer,
            handlers: {
              // register custom handler names matching buttons we added
              'insertEmoji': () => this._insertEmoji(),
              'insertCalendar': () => this._openCalendarModal(),
              'insertFile': () => this._handleInsertFile(),
              'insertTable': () => this._insertTable(),
              'save': () => this.saveAndClose()
            }
          }
        }
      });

      // Register custom toolbar button handlers (buttons use classes ql-insertEmoji etc.)
      const toolbarModule = this.editor.getModule('toolbar');
      if (toolbarModule) {
        // these handlers just call the methods above
        toolbarModule.addHandler('insertEmoji', () => this._insertEmoji());
        toolbarModule.addHandler('insertCalendar', () => this._openCalendarModal());
        toolbarModule.addHandler('insertFile', () => this._handleInsertFile());
        toolbarModule.addHandler('insertTable', () => this._insertTable());
        toolbarModule.addHandler('save', () => this.saveAndClose());
      }

      // Ensure editor exists and supports 'on'
      if (!this.editor || typeof this.editor.on !== 'function') {
        console.error('Quill instance invalid; fallback to textarea');
        this._rteFallback();
        return;
      }

      // text-change handler
      this.editor.on('text-change', () => {
        this.currentNote = this.getEditorContent();
        this.updateTimeline();
        if (typeof this.queueAutoSave === 'function') this.queueAutoSave();
      });

      // image paste hook to apply styling
      this.editor.root.addEventListener('paste', () => {
        setTimeout(() => {
          const imgs = this.editor.root.querySelectorAll('img');
          imgs.forEach(img => img.classList.add('inserted-image'));
        }, 50);
      });

      this.useRTE = true;
    } catch (err) {
      console.error('Failed to initialize Quill:', err);
      this._rteFallback();
    }
  },

  /* ---------- Custom toolbar handlers ---------- */

  _insertEmoji() {
    const emoji = prompt('Enter emoji (or paste one):', '😀');
    if (!emoji) return;
    const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
    this.editor.insertText(range.index, emoji, 'user');
    this.editor.setSelection(range.index + emoji.length);
  },

  _insertTable() {
    const rows = parseInt(prompt('Rows', '2'), 10) || 2;
    const cols = parseInt(prompt('Columns', '2'), 10) || 2;
    let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
    for (let r=0;r<rows;r++){
      tableHtml += '<tr>';
      for (let c=0;c<cols;c++){
        tableHtml += '<td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table><p></p>';
    const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
    if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) {
      this.editor.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
    } else {
      this.editor.insertText(range.index, this._stripHtml(tableHtml));
    }
  },

  /* ---------- File & image handlers (as before) ---------- */

  async _handleInsertFile() {
    const input = document.createElement('input'); input.type = 'file';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      // If Drive configured and available, attempt upload (hook)
      if (this.googleDriveLink && window.gapi && this._driveUploadAvailable()) {
        try {
          const uploaded = await this._uploadFileToDrive(file);
          const link = uploaded.webViewLink || uploaded.webContentLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
          const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
          this.editor.insertText(range.index, `📎 ${file.name} - ${link}`, 'user');
        } catch (err) {
          console.error('Drive upload failed', err);
          // fallback: insert reference to folder
          const ref = this.googleDriveLink.replace(/\/$/, '') + '/' + encodeURIComponent(file.name);
          const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
          this.editor.insertText(range.index, `📎 ${file.name} - ${ref}`, 'user');
        }
      } else {
        // no Drive: insert reference or ask to save folder
        if (!this.googleDriveLink && confirm('No Google Drive folder configured. Save one now?')) {
          const link = prompt('Enter Google Drive folder link:', '');
          if (link) { this.saveDriveLink(link); }
        }
        const ref = this.googleDriveLink ? (this.googleDriveLink.replace(/\/$/, '') + '/' + encodeURIComponent(file.name)) : file.name;
        const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
        this.editor.insertText(range.index, `📎 ${file.name} - ${ref}`, 'user');
      }
    };
    input.click();
  },

  async _handleImageInsert() {
    const input = document.createElement('input'); input.type='file'; input.accept='image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if(!file) return;
      // attempt Drive upload if available
      if (this.googleDriveLink && window.gapi && this._driveUploadAvailable()) {
        try {
          const uploaded = await this._uploadFileToDrive(file);
          const url = uploaded.webViewLink || uploaded.webContentLink || uploaded.thumbnailLink || uploaded.id;
          const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
          this.editor.insertEmbed(range.index, 'image', url);
          setTimeout(()=>{ const imgs=this.editor.root.querySelectorAll('img'); const img=imgs[imgs.length-1]; if(img) img.classList.add('inserted-image'); },50);
          return;
        } catch(e){ console.error('Drive upload failed', e); }
      }
      // fallback: inline base64
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
        this.editor.insertEmbed(range.index, 'image', dataUrl);
        setTimeout(()=>{ const imgs=this.editor.root.querySelectorAll('img'); const img=imgs[imgs.length-1]; if(img) img.classList.add('inserted-image'); },50);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  /* ---------- Initialization and wiring ---------- */

  async init() {
    const cssPath = 'css/quill.css';
    const jsPath = 'js/quill.js';

    await this._ensureRTE(cssPath, jsPath);

    if (!window.EncryptionService || !EncryptionService.isReady()) {
      const cList = document.getElementById('contactList'); if (cList) cList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger)">Encryption not initialized. Refresh.</div>'; return;
    }

    if (typeof this.loadContacts === 'function') await this.loadContacts();
    if (typeof this.loadUserSettings === 'function') await this.loadUserSettings();
    if (typeof this.displayContacts === 'function') this.displayContacts();
    if (typeof this.updateTimeline === 'function') this.updateTimeline();
    if (typeof this.loadIcons === 'function') await this.loadIcons();

    // header save button already wired in render via onclick attr to saveAndClose
    // restore googleDriveLink
    try {
      const s = JSON.parse(localStorage.getItem('userSettings') || '{}');
      this.googleDriveLink = s.googleDriveLink || this.googleDriveLink || null;
    } catch (e) { this.googleDriveLink = this.googleDriveLink || null; }
  },

  /* ---------- Autosave & Save helpers ---------- */

  queueAutoSave() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      if (typeof this.handleEnterSave === 'function') this.handleEnterSave().catch(e => console.error('Auto-save failed', e));
    }, 1800);
  },

  async saveAndClose() {
    if (!this.selectedContact) return;
    const indicator = document.getElementById('saveIndicator');
    if (indicator) indicator.innerHTML = '<span class="comm-save-spinner"></span>Saving...';
    try {
      if (typeof this.handleEnterSave === 'function') await this.handleEnterSave();
      if (indicator) indicator.innerHTML = '✓ Saved';
      setTimeout(()=>{ if (indicator) indicator.innerHTML = ''; },1200);
      if (typeof this.deselectContact === 'function') this.deselectContact();
    } catch (err) {
      console.error('Save and close failed', err);
      if (indicator) indicator.innerHTML = '✗ Save failed';
    }
  },

  /* ---------- Calendar modal ---------- */

  _openCalendarModal() {
    const modal = document.getElementById('rteCalendarModal'); if (!modal) return;
    const now = new Date(); const start = new Date(now.getTime()+5*60000); const end = new Date(start.getTime()+3600000);
    document.getElementById('rteCalStart').value = start.toISOString().slice(0,16);
    document.getElementById('rteCalEnd').value = end.toISOString().slice(0,16);
    document.getElementById('rteCalTitle').value = (document.getElementById('commSummary')?.value) || '';
    document.getElementById('rteCalDesc').value = '';
    document.getElementById('rteCalLoc').value = '';
    modal.style.display = 'block';
    document.getElementById('rteCalendarForm').onsubmit = (e) => {
      e.preventDefault();
      const startVal = document.getElementById('rteCalStart').value;
      const endVal = document.getElementById('rteCalEnd').value;
      const title = document.getElementById('rteCalTitle').value;
      const desc = document.getElementById('rteCalDesc').value;
      const loc = document.getElementById('rteCalLoc').value;
      const startIso = new Date(startVal).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
      const endIso = new Date(endVal).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
      const params = new URLSearchParams({ action:'TEMPLATE', text:title, dates:`${startIso}/${endIso}`, details:desc, location:loc, sf:'true', output:'xml' });
      const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
      const eventText = `📅 ${new Date(startVal).toLocaleString()} - ${title}\n`;
      const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
      if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) {
        this.editor.clipboard.dangerouslyPasteHTML(range.index, `${this._escapeHtml(eventText)}<br><a href="${url}" target="_blank">Add to Google Calendar</a><br>`);
      } else {
        this.editor.insertText(range.index, eventText + `Add to Google Calendar: ${url}\n`);
      }
      this._closeCalendarModal();
    };
  },

  _closeCalendarModal() {
    const modal = document.getElementById('rteCalendarModal'); if (modal) modal.style.display = 'none';
  },

  /* ---------- Contacts / communications (unchanged aside from UI behaviors) ---------- */

  async loadContacts() {
    try { this.contacts = await getContacts(); } catch (err) { console.error('Error loading contacts', err); const listEl = document.getElementById('contactList'); if (listEl) listEl.innerHTML = `<div style="padding:12px;color:var(--danger)">Error loading contacts</div>`; }
  },

  displayContacts() {
    const listEl = document.getElementById('contactList'); if (!listEl) return;
    const filtered = this.getFilteredContacts();
    if (!filtered || filtered.length === 0) { listEl.innerHTML = `<div style="padding:12px;color:var(--text-light)">No contacts</div>`; return; }
    listEl.innerHTML = filtered.map(c => `<div class="comm-contact-item" data-contact-id="${c.id}" onclick="CommunicationsTab.selectContact(${c.id})" style="padding:8px; cursor:pointer;"> <div style="font-weight:600">${c.name}</div> <div style="font-size:0.85em;color:var(--text-light)">${c.organization||''}</div> </div>`).join('');
  },

  getFilteredContacts() { if (!this.searchQuery) return this.contacts.sort((a,b)=>a.name.localeCompare(b.name)); const q=this.searchQuery.toLowerCase(); return this.contacts.filter(c=>c.name.toLowerCase().includes(q) || (c.organization||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)); },

  handleContactSearch(value) { this.searchQuery = value; this.displayContacts(); },

  async selectContact(contactId) {
    this.selectedContact = this.contacts.find(c => c.id === contactId); if (!this.selectedContact) return;
    document.querySelectorAll('#contactList .comm-contact-item').forEach(el=>el.classList.remove('selected'));
    const el = document.querySelector(`#contactList .comm-contact-item[data-contact-id="${contactId}"]`);
    if (el) el.classList.add('selected');
    document.getElementById('contactList').style.display='none'; document.getElementById('historyList').style.display='block';
    document.getElementById('selectedContactHeader').textContent = this.selectedContact.name;
    document.getElementById('selectedContactInfo').innerHTML = `<h3 style="margin:0 0 6px 0">${this.selectedContact.name}</h3><div style="color:var(--text-light)">${this.selectedContact.organization || 'No organization'}</div>`;
    const summaryInput = document.getElementById('commSummary'); if (summaryInput) { summaryInput.style.display='block'; const now=new Date(); summaryInput.value = now.toLocaleString(); summaryInput.disabled=false; }
    if (this.useRTE && this.editor) { this.editor.enable(true); this.setEditorContent(''); this.editor.focus(); } else { const ta=document.getElementById('commNoteArea'); if (ta){ta.disabled=false; ta.value=''; ta.focus();} }
    this.currentNote=''; this.lastTimestamp=null; this.currentNoteId=null;
    await this.loadContactCommunications();
  },

  deselectContact() { this.selectedContact=null; this.communications=[]; this.currentNote=''; this.lastTimestamp=null; this.currentNoteId=null; document.getElementById('contactList').style.display='block'; document.getElementById('historyList').style.display='none'; document.getElementById('selectedContactInfo').innerHTML = `<p style="color:var(--text-light)">Select a contact to start logging communications</p>`; const s=document.getElementById('commSummary'); if(s) s.style.display='none'; if (!this.useRTE) { const ta=document.getElementById('commNoteArea'); if(ta){ta.disabled=true; ta.value='';} } else if(this.editor){this.editor.disable(); this.setEditorContent('');} this.displayContacts(); this.closePreviousView(); },

  async loadContactCommunications() {
    try {
      const ok = await this._waitForStorage(2000); if (!ok) throw new Error('CommunicationsStorage not available');
      this.communications = await CommunicationsStorage.listCommunications(this.selectedContact.id);
      this.displayCommunicationsList();
      const st = document.getElementById('statusText'); if (st) st.textContent = `${this.selectedContact.name} (${this.communications.length} previous communications)`;
    } catch (err) { console.error('Error loading communications', err); const st=document.getElementById('statusText'); if(st) st.textContent='Error loading communications'; }
  },

  displayCommunicationsList() {
    const historyEl = document.getElementById('historyItems'); if (!historyEl) return;
    if (!this.communications || this.communications.length===0) { historyEl.innerHTML = `<div style="padding:12px;color:var(--text-light)">No previous communications</div>`; return; }
    historyEl.innerHTML = this.communications.map(comm => `<div class="comm-history-item" data-comm-id="${comm.id}" onclick="CommunicationsTab.viewCommunication('${comm.id}')" style="padding:8px;margin-bottom:6px;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"><div style="flex:1"><div style="font-size:0.85em;color:var(--text-light)">${formatDate(comm.timestamp)}</div><div style="font-weight:600">${comm.summary||'No summary'}</div></div><div style="display:flex;gap:8px;align-items:center;">${(window.currentUser && window.currentUser.isAdmin) ? `<button class="btn-sm btn-danger" onclick="event.stopPropagation(); CommunicationsTab.handleDeleteNoteClick('${comm.id}')">Delete</button>` : ''}</div></div>`).join('');
  },

  async viewCommunication(commId) {
    try {
      const comm = await CommunicationsStorage.loadCommunication(this.selectedContact.id, commId);
      this.viewingComm = comm; document.getElementById('commContainer').classList.add('split-view');
      document.getElementById('prevSummary').textContent = comm.summary || 'No summary';
      document.getElementById('prevMeta').textContent = `${formatDate(comm.createdAt)} by ${comm.author}`;
      const prev = document.getElementById('prevNoteArea'); if (prev) prev.innerHTML = comm.content || this._escapeHtml(comm.content || '');
      document.querySelectorAll('#historyItems .comm-history-item').forEach(el=>el.classList.remove('selected'));
      const el = document.querySelector(`#historyItems .comm-history-item[data-comm-id="${commId}"]`); if (el) el.classList.add('selected');
    } catch (err) { console.error('Error loading communication', err); alert('Failed to load communication'); }
  },

  async handleDeleteNoteClick(commId) {
    if (!confirm('Delete this note (it will be archived; only admins will see deleted notes). Continue?')) return;
    try { await CommunicationsStorage.archiveAndDeleteNote(this.selectedContact.id, commId, (window.currentUser && window.currentUser.email) || 'unknown'); await this.loadContactCommunications(); if (window.currentUser && window.currentUser.isAdmin) this._renderDeletedNotesSection?.(); alert('Note archived.'); } catch (err){ console.error('Archive/Delete failed', err); alert('Failed to archive/delete note: ' + (err.message||err)); }
  },

  /* ---------- Misc helpers ---------- */

  async _waitForStorage(timeoutMs = 2000) { const start = Date.now(); while (!window.CommunicationsStorage && (Date.now()-start) < timeoutMs) { await new Promise(r=>setTimeout(r,100)); } return !!window.CommunicationsStorage; },

  getEditorContent() { if (this.useRTE && this.editor) return this.editor.root.innerHTML || ''; const ta = document.getElementById('commNoteArea'); return ta ? ta.value : ''; },

  setEditorContent(html) { if (this.useRTE && this.editor) { try { if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) this.editor.clipboard.dangerouslyPasteHTML(this.editor.getLength(), html || ''); else this.editor.root.innerHTML = html || ''; } catch(e) { this.editor.root.innerHTML = html || ''; } } else { const ta=document.getElementById('commNoteArea'); if(ta) ta.value = this._stripHtml(html||''); } this.currentNote = html||''; this.updateTimeline(); },

  _renderTimelineFromSavedContent(savedHtml) {
    const parser=new DOMParser(); const doc=parser.parseFromString(`<div>${savedHtml}</div>`,'text/html'); const rows=Array.from(doc.querySelectorAll('.note-row')); const timelineEl=document.getElementById('timelineContent'); if(!timelineEl) return; let html=''; rows.forEach((row,idx)=>{ const tsEl=row.querySelector('.note-ts'); const tsText = tsEl ? tsEl.textContent.trim() : ''; html += `<div class="comm-timestamp">${idx===0?this._escapeHtml(tsText):'&nbsp;'}</div>`; }); if(rows.length===0){ const nowStr=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}); html=`<div class="comm-timestamp">${this._escapeHtml(nowStr)}</div>`; } timelineEl.innerHTML = html; },

  updateTimeline() { const content=this.getEditorContent(); if(!content){ const t=document.getElementById('timelineContent'); if(t) t.innerHTML=''; return; } let savedHtml=''; if (/<div class="note-row"/.test(content)) savedHtml = content; else { const lines = this._stripHtml(content).split('\n'); savedHtml = lines.map((l,idx)=>`<div class="note-row" data-line="${idx}"><span class="note-ts"></span><span class="note-text">${this._escapeHtml(l)}</span></div>`).join(''); } this._renderTimelineFromSavedContent(savedHtml); },

  _generateDateId() { const d=new Date(); const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; },

  _ensureCurrentNoteId() { if (!this.currentNoteId && this.selectedContact) { const dateId=this._generateDateId(); this.currentNoteId = `${this.selectedContact.id}_${dateId}`; } return this.currentNoteId; },

  async handleEnterSave() {
    if (!this.selectedContact) { console.warn('No contact selected'); return; }
    const contentHtml = this.getEditorContent() || ''; const plainText = this._stripHtml(contentHtml); const lines = plainText.split('\n'); const nowTime = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
    const savedHtml = lines.map((line,idx)=>{ const trimmed=line.trim(); const hasTs=/^\[\d{2}:\d{2}\]/.test(trimmed); if(!hasTs && trimmed!=='') return `<div class="note-row" data-line="${idx}"><span class="note-ts">[${nowTime}]</span><span class="note-text">${this._escapeHtml(line)}</span></div>`; else { const tsText = hasTs? trimmed.match(/^\[\d{2}:\d{2}\]/)[0]:''; const text = hasTs? trimmed.replace(/^\[\d{2}:\d{2}\]\s?/,''): trimmed; return `<div class="note-row" data-line="${idx}"><span class="note-ts">${this._escapeHtml(tsText)}</span><span class="note-text">${this._escapeHtml(text)}</span></div>`; } }).join('');
    const noteId = this._ensureCurrentNoteId(); if(!noteId){ console.error('Cannot build NoteID'); return; }
    try {
      if (typeof CommunicationsStorage?.saveNoteById === 'function') {
        await CommunicationsStorage.saveNoteById(this.selectedContact.id, noteId.split('_')[1], savedHtml, document.getElementById('commSummary')?.value || '');
      } else if (typeof CommunicationsStorage?.saveNoteSession === 'function') {
        await CommunicationsStorage.saveNoteSession(this.selectedContact.id, noteId, savedHtml, document.getElementById('commSummary')?.value || '');
      } else {
        throw new Error('No storage save method available');
      }
      this.lastSaveTime = new Date(); this.currentNote = savedHtml; this._renderTimelineFromSavedContent(savedHtml); if (typeof this.loadContactCommunications === 'function') await this.loadContactCommunications();
    } catch (err) { console.error('Save failed', err); alert('Save failed: ' + (err.message || err)); }
  },

  _escapeHtml(str){ if(!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); },
  _stripHtml(html){ if(!html) return ''; const d=document.createElement('div'); d.innerHTML = html; return d.textContent || d.innerText || ''; },

  async loadUserSettings(){ try { const s = JSON.parse(localStorage.getItem('userSettings') || '{}'); this.googleDriveLink = s.googleDriveLink || this.googleDriveLink || null; } catch(e){ this.googleDriveLink = this.googleDriveLink || null; } },

  saveDriveLink(link){ this.googleDriveLink = link; const s = JSON.parse(localStorage.getItem('userSettings') || '{}'); s.googleDriveLink = link; localStorage.setItem('userSettings', JSON.stringify(s)); }

};

window.CommunicationsTab = CommunicationsTab;
