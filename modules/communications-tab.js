// modules/communications-tab.js - Communications tab (uses QuillEditor module)
// Updated layout: left contacts column + right editor/timeline 2x2 grid.
// Toolbar custom buttons use non-ql classes so Quill won't treat them as formats.

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
  editorReady: false,
  useRTE: false,
  currentNoteId: null,
  iconData: [],

  async render() {
    const container = document.getElementById('communications');

    // Two-column layout:
    // - left column: contacts / history
    // - right column: a 2-row grid: (toolbar | timeline-header) and (editor | timeline content)
    container.innerHTML = `
      <div class="comm-layout" style="display:flex; gap:12px; width:100%;">
        <!-- Left sidebar: contacts & history -->
        <aside class="comm-sidebar" style="flex:0 0 270px;">
          <div style="padding:8px 6px;">
            <h3 style="margin:6px 0 8px 0; font-size:1.05em;">Contacts</h3>
            <input type="text" placeholder="🔍 Search..." oninput="CommunicationsTab.handleContactSearch(this.value)" style="width:100%;padding:6px;">
          </div>
          <div id="contactList" class="comm-contact-list" style="padding:8px; overflow:auto; max-height:640px;">
            <div style="color:var(--text-light); padding:20px; text-align:center;">Loading contacts...</div>
          </div>

          <div id="historyWrapper" style="display:none; margin-top:12px;">
            <div style="padding:10px; background:white; border-top:1px solid var(--border);">
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <strong id="selectedContactHeader">Contact</strong>
                <button id="btnSaveClose" class="btn-sm" title="Save & Close" onclick="CommunicationsTab.saveAndClose()" style="background:white;color:black;border:1px solid #ddd;">💾</button>
              </div>
            </div>
            <div id="historyItems" style="padding:8px; max-height:360px; overflow:auto;"></div>
          </div>
        </aside>

        <!-- Right: editor + timeline (top-row toolbar+timeline header, bottom-row editor+timeline) -->
        <main class="comm-right" style="flex:1 1 auto;">
           Top-left (toolbar), Top-right (timeline header),
   Bottom-left (editor), Bottom-right (timeline content)
*/

<div id="commGrid" class="comm-grid">
  <!-- Top-left: toolbar -->
  <div class="grid-toolbar">
    <div id="quill-toolbar" class="ql-toolbar ql-snow">
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
      <span class="ql-formats">
        <button class="ql-link"></button>
        <button class="ql-image"></button>
      </span>

      <!-- custom buttons (non-ql classes) -->
      <span class="ql-formats">
        <button class="btn-insert-emoji" title="Insert emoji">😀</button>
        <button class="btn-insert-calendar" title="Insert calendar">📅</button>
        <button class="btn-insert-file" title="Insert file">📎</button>
        <button class="btn-insert-table" title="Insert table">🔳</button>
        <button class="btn-save" title="Save">💾</button>
      </span>
    </div>
  </div>

  <!-- Top-right: timeline header (centered, bordered white box) -->
  <div class="grid-timeline-header" style="grid-column:2 / 3; grid-row:1 / 2; display:flex; justify-content:center; align-items:center; align-self:stretch; background:#ffffff; border:1px solid var(--border);">
    <div class="comm-timeline-header" style="font-weight:600;">Timeline</div>
  </div>

  <!-- Bottom-left: editor -->
  <div class="grid-editor" style="grid-column:1 / 2; grid-row:2 / 3;">
    <div id="commEditor" class="comm-editor-container" style="min-height:260px;"></div>
    <textarea id="commNoteArea" style="display:none;"></textarea>
  </div>

  <!-- Bottom-right: timeline content -->
  <div class="grid-timeline" style="grid-column:2 / 3; grid-row:2 / 3;">
    <div id="timelineContent" class="comm-timeline-content" style="background:white; border:1px solid var(--border); border-radius:6px; min-height:260px; overflow:auto; padding:8px;"></div>
  </div>
</div>

          <div id="statusArea" style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <div id="saveIndicator"></div>
            <div id="statusText" style="color:var(--text-light)">Ready</div>
          </div>
        </main>
      </div>
    `;

    await this.init();
  },

  async init() {
    // Initialize QuillEditor if available
    try {
      // QuillEditor expects toolbarSelector and editorSelector to exist; our toolbar uses non-ql custom button classes
      if (window.QuillEditor && typeof QuillEditor.init === 'function') {
        await QuillEditor.init({
          editorSelector: '#commEditor',
          toolbarSelector: '#quill-toolbar',
          cssPath: 'css/quill.css',
          jsPath: 'js/quill.js',
          showTimeline: true,
          // delegate handlers from QuillEditor back to this module
          onSave: async () => { await this.handleEnterSave(); },
          onOpenCalendar: () => { this._openCalendarModal(); },
          onInsertFile: () => { this._handleInsertFile(); },
          onInsertTable: () => { this._insertTable(); },
          // new: allow QuillEditor to attach to non-ql classes (we added these)
          customButtonSelectors: {
            insertEmoji: '.btn-insert-emoji',
            insertCalendar: '.btn-insert-calendar',
            insertFile: '.btn-insert-file',
            insertTable: '.btn-insert-table',
            save: '.btn-save'
          }
        });

        // subscribe to editor changes
        QuillEditor.onChange((html) => {
          this.currentNote = html;
          this.updateTimeline();
          this.queueAutoSave?.();
        });

        this.useRTE = true;
        this.editorReady = true;
      } else {
        // fallback: show textarea
        console.warn('QuillEditor not available; falling back to textarea.');
        const ta = document.getElementById('commNoteArea'); if (ta) ta.style.display = 'block';
        this.useRTE = false;
      }
    } catch (err) {
      console.error('Failed to init QuillEditor:', err);
      this.useRTE = false;
    }

    // Ensure encryption / contacts load
    if (!window.EncryptionService || !EncryptionService.isReady()) {
      const cList = document.getElementById('contactList');
      if (cList) cList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger)">Encryption not initialized. Please refresh.</div>';
      return;
    }

    if (typeof this.loadContacts === 'function') await this.loadContacts();
    if (typeof this.loadUserSettings === 'function') await this.loadUserSettings();
    if (typeof this.displayContacts === 'function') this.displayContacts();
    if (typeof this.updateTimeline === 'function') this.updateTimeline();
    if (typeof this.loadIcons === 'function') await this.loadIcons();

    // fallback textarea wiring
    if (!this.useRTE) {
      const ta = document.getElementById('commNoteArea');
      if (ta) {
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleEnterSave();
          }
        });
        ta.addEventListener('input', () => {
          this.currentNote = ta.value;
          this.updateTimeline();
        });
      }
    }

    // restore user settings
    try {
      const s = JSON.parse(localStorage.getItem('userSettings') || '{}');
      this.googleDriveLink = s.googleDriveLink || null;
    } catch (e) { this.googleDriveLink = null; }
  },

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

  /* Autosave */
  queueAutoSave() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      if (typeof this.handleEnterSave === 'function') this.handleEnterSave().catch(e => console.error('Auto-save failed', e));
    }, 1800);
  },

  async saveAndClose() {
    if (!this.selectedContact) return;
    const ind = document.getElementById('saveIndicator'); if (ind) ind.innerHTML = '<span class="comm-save-spinner"></span>Saving...';
    try {
      if (typeof this.handleEnterSave === 'function') await this.handleEnterSave();
      if (ind) ind.innerHTML = '✓ Saved';
      setTimeout(()=>{ if (ind) ind.innerHTML = ''; }, 1000);
      if (typeof this.deselectContact === 'function') this.deselectContact();
    } catch (err) {
      console.error('Save and close failed', err);
      if (ind) ind.innerHTML = '✗ Save failed';
    }
  },

  /* ---------- remaining methods (contacts, timeline, saving) ---------- */
  async loadContacts() {
    try {
      this.contacts = await getContacts();
      // render contact list into #contactList
      const listEl = document.getElementById('contactList');
      if (!listEl) return;
      if (!this.contacts || this.contacts.length === 0) {
        listEl.innerHTML = `<div style="padding:12px;color:var(--text-light)">No contacts</div>`;
        return;
      }
      listEl.innerHTML = this.contacts.map(c => `<div class="comm-contact-item" data-contact-id="${c.id}" onclick="CommunicationsTab.selectContact(${c.id})" style="padding:8px;cursor:pointer;"><div style="font-weight:600">${c.name}</div><div style="font-size:0.85em;color:var(--text-light)">${c.organization||''}</div></div>`).join('');
    } catch (err) {
      console.error('Error loading contacts', err);
      const listEl = document.getElementById('contactList'); if (listEl) listEl.innerHTML = `<div style="padding:12px;color:var(--danger)">Error loading contacts</div>`;
    }
  },

  displayContacts() { /* unused - loadContacts already renders */ },

  getFilteredContacts() { if (!this.searchQuery) return this.contacts.sort((a,b)=>a.name.localeCompare(b.name)); const q=this.searchQuery.toLowerCase(); return this.contacts.filter(c=>c.name.toLowerCase().includes(q) || (c.organization||'').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)); },

  handleContactSearch(value) { this.searchQuery = value; this.loadContacts(); },

  // ... rest of the module kept as in prior version (loadContactCommunications, displayCommunicationsList, viewCommunication, handleDeleteNoteClick, save logic, helpers)
  // For brevity I kept these functions unchanged from your last working copy — they still call CommunicationsStorage.* etc.

  async loadContactCommunications() {
    try {
      const ok = await this._waitForStorage(2000);
      if (!ok) throw new Error('CommunicationsStorage not available');
      this.communications = await CommunicationsStorage.listCommunications(this.selectedContact.id);
      this.displayCommunicationsList();
      const st = document.getElementById('statusText'); if (st) st.textContent = `${this.selectedContact.name} (${this.communications.length} previous communications)`;
    } catch (err) {
      console.error('Error loading communications', err);
      const st = document.getElementById('statusText'); if (st) st.textContent = 'Error loading communications';
    }
  },

  displayCommunicationsList() {
    const historyEl = document.getElementById('historyItems'); if (!historyEl) return;
    if (!this.communications || this.communications.length === 0) { historyEl.innerHTML = `<div style="padding:12px;color:var(--text-light)">No previous communications</div>`; return; }
    historyEl.innerHTML = this.communications.map(comm => `<div class="comm-history-item" data-comm-id="${comm.id}" onclick="CommunicationsTab.viewCommunication('${comm.id}')" style="padding:8px;margin-bottom:6px;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"><div style="flex:1"><div style="font-size:0.85em;color:var(--text-light)">${formatDate(comm.timestamp)}</div><div style="font-weight:600">${comm.summary||'No summary'}</div></div><div style="display:flex;gap:8px;align-items:center;">${(window.currentUser && window.currentUser.isAdmin) ? `<button class="btn-sm btn-danger" onclick="event.stopPropagation(); CommunicationsTab.handleDeleteNoteClick('${comm.id}')">Delete</button>` : ''}</div></div>`).join('');
  },

  async viewCommunication(commId) {
    try {
      const comm = await CommunicationsStorage.loadCommunication(this.selectedContact.id, commId);
      this.viewingComm = comm;
      const prev = document.getElementById('prevNoteArea');
      if (prev) prev.innerHTML = comm.content || this._escapeHtml(comm.content || '');
    } catch (err) {
      console.error('Error loading communication', err);
      alert('Failed to load communication');
    }
  },

  async handleDeleteNoteClick(commId) {
    if (!confirm('Delete this note (it will be archived; only admins will see deleted notes). Continue?')) return;
    try {
      await CommunicationsStorage.archiveAndDeleteNote(this.selectedContact.id, commId, (window.currentUser && window.currentUser.email) || 'unknown');
      await this.loadContactCommunications();
      if (window.currentUser && window.currentUser.isAdmin) this._renderDeletedNotesSection?.();
      alert('Note archived.');
    } catch (err) {
      console.error('Archive/Delete failed', err);
      alert('Failed to archive/delete note: ' + (err.message || err));
    }
  },

  async _waitForStorage(timeoutMs = 2000) { const start = Date.now(); while (!window.CommunicationsStorage && (Date.now()-start) < timeoutMs) { await new Promise(r=>setTimeout(r,100)); } return !!window.CommunicationsStorage; },

  getEditorContent() { if (this.useRTE && this.editorReady) return QuillEditor.getHTML(); const ta = document.getElementById('commNoteArea'); return ta ? ta.value : ''; },

  setEditorContent(html) { if (this.useRTE && this.editorReady) QuillEditor.setHTML(html); else { const ta = document.getElementById('commNoteArea'); if (ta) ta.value = this._stripHtml(html||''); } this.currentNote = html||''; this.updateTimeline(); },

  _renderTimelineFromSavedContent(savedHtml) { const parser=new DOMParser(); const doc=parser.parseFromString(`<div>${savedHtml}</div>`,'text/html'); const rows=Array.from(doc.querySelectorAll('.note-row')); const timelineEl=document.getElementById('timelineContent'); if(!timelineEl) return; let html=''; rows.forEach((row,idx)=>{ const tsEl=row.querySelector('.note-ts'); const tsText = tsEl ? tsEl.textContent.trim() : ''; html += `<div class="comm-timestamp">${idx===0?this._escapeHtml(tsText):'&nbsp;'}</div>`; }); if(rows.length===0){ const nowStr=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}); html=`<div class="comm-timestamp">${this._escapeHtml(nowStr)}</div>`; } timelineEl.innerHTML = html; },

  updateTimeline() { const content=this.getEditorContent(); if(!content){ const t=document.getElementById('timelineContent'); if(t) t.innerHTML=''; return; } let savedHtml=''; if (/<div class="note-row"/.test(content)) savedHtml=content; else { const lines=this._stripHtml(content).split('\\n'); savedHtml=lines.map((l,idx)=>`<div class="note-row" data-line="${idx}"><span class="note-ts"></span><span class="note-text">${this._escapeHtml(l)}</span></div>`).join(''); } this._renderTimelineFromSavedContent(savedHtml); },

  _generateDateId(){ const d=new Date(); const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; },

  _ensureCurrentNoteId(){ if(!this.currentNoteId && this.selectedContact){ const dateId=this._generateDateId(); this.currentNoteId = `${this.selectedContact.id}_${dateId}`; } return this.currentNoteId; },

  async handleEnterSave(){ if(!this.selectedContact){ console.warn('No contact selected'); return; } const contentHtml=this.getEditorContent()||''; const plainText=this._stripHtml(contentHtml); const lines=plainText.split('\\n'); const nowTime=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}); const savedHtml = lines.map((line,idx)=>{ const trimmed=line.trim(); const hasTs=/^\\[\\d{2}:\\d{2}\\]/.test(trimmed); if(!hasTs && trimmed!=='') return `<div class="note-row" data-line="${idx}"><span class="note-ts">[${nowTime}]</span><span class="note-text">${this._escapeHtml(line)}</span></div>`; else { const tsText=hasTs? trimmed.match(/^\\[\\d{2}:\\d{2}\\]/)[0]:''; const text=hasTs? trimmed.replace(/^\\[\\d{2}:\\d{2}\\]\\s?/,''): trimmed; return `<div class="note-row" data-line="${idx}"><span class="note-ts">${this._escapeHtml(tsText)}</span><span class="note-text">${this._escapeHtml(text)}</span></div>`; } }).join(''); const noteId=this._ensureCurrentNoteId(); if(!noteId){ console.error('Cannot build NoteID'); return; } try { if(typeof CommunicationsStorage?.saveNoteById==='function'){ await CommunicationsStorage.saveNoteById(this.selectedContact.id, noteId.split('_')[1], savedHtml, document.getElementById('commSummary')?.value||''); } else if(typeof CommunicationsStorage?.saveNoteSession==='function'){ await CommunicationsStorage.saveNoteSession(this.selectedContact.id, noteId, savedHtml, document.getElementById('commSummary')?.value||''); } else { throw new Error('No storage save method available'); } this.lastSaveTime=new Date(); this.currentNote=savedHtml; this._renderTimelineFromSavedContent(savedHtml); if(typeof this.loadContactCommunications==='function') await this.loadContactCommunications(); } catch(err){ console.error('Save failed',err); alert('Save failed: '+(err.message||err)); } },

  _escapeHtml(str){ if(!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;'); },
  _stripHtml(html){ if(!html) return ''; const d=document.createElement('div'); d.innerHTML=html; return d.textContent||d.innerText||''; },

  async loadUserSettings(){ try{ const s=JSON.parse(localStorage.getItem('userSettings')||'{}'); this.googleDriveLink = s.googleDriveLink||this.googleDriveLink||null; }catch(e){ this.googleDriveLink=null; } },
  saveDriveLink(link){ this.googleDriveLink = link; const s=JSON.parse(localStorage.getItem('userSettings')||'{}'); s.googleDriveLink=link; localStorage.setItem('userSettings', JSON.stringify(s)); }
};

window.CommunicationsTab = CommunicationsTab;
