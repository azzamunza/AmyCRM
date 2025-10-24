// modules/communications-tab.js - Communications tab with Quill RTE (enhanced toolbar, NoteID saves, deleted-note archive hooks)
// Updated: scrollbar on editor, toolbar custom buttons (link, file, calendar, emoji, table, image), autosave bugfixes, save & close implemented.
// Notes:
// - For full Google Drive upload and Google Calendar direct-add you'll need to configure Google OAuth (gapi) and client id; code includes hooks and fallbacks.
// - For interactive image resizing use a Quill image-resize plugin (recommended: quill-image-resize-module). See comments below.

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
            <h3 style="margin-bottom: 8px; font-size:1.05em;">Contacts</h3>
            <input type="text" class="comm-search" placeholder="🔍 Search contacts..." oninput="CommunicationsTab.handleContactSearch(this.value)" style="width:100%;padding:6px;">
          </div>
          <div class="comm-contact-list" id="contactList" style="margin-top:8px;"></div>
          <div class="comm-history-list" id="historyList" style="display:none; margin-top:10px;">
            <div style="padding:10px; background:white; border-bottom:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong id="selectedContactHeader">Contact</strong>
                <button id="btnSaveClose" class="btn-sm" onclick="CommunicationsTab.saveAndClose()" title="Save & Close" style="background:white; color:black; border:1px solid #ddd;">💾 Save & Close</button>
              </div>
            </div>
            <div id="historyItems" style="padding:10px;"></div>
          </div>
        </div>

        <div class="comm-main" style="flex:1 1 auto; min-width: 400px;">
          <div class="comm-main-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div id="selectedContactInfo" style="flex:1;">
              <p style="color:var(--text-light); margin:0;">Select a contact to start logging communications</p>
            </div>
            <input id="commSummary" type="text" placeholder="Summary (optional)" style="flex:0 0 280px; padding:6px; display:none;">
          </div>

          <div class="comm-editor-and-toolbar" style="display:flex; gap:12px; margin-top:10px;">
            <div class="comm-editor-container" style="flex:1 1 auto; background:transparent;">
              <!-- Quill toolbar container -->
              <div id="commToolbar" style="background:#fff;border:1px solid var(--border);border-radius:6px 6px 0 0;padding:6px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;"></div>
              <!-- Editor -->
              <div id="commEditor" style="min-height:220px; background:white; border:1px solid var(--border); border-top:none; border-radius:0 0 6px 6px; overflow:hidden;">
                <div class="ql-toolbar-spacer" style="display:none"></div>
                <div id="editorInner" style="padding:8px;"></div>
              </div>
              <!-- Fallback textarea -->
              <textarea id="commNoteArea" style="display:none; width:100%; min-height:220px; padding:8px; box-sizing:border-box;"></textarea>
            </div>

            <div class="comm-timeline" style="flex:0 0 160px;">
              <div class="comm-timeline-header" style="font-weight:600; margin-bottom:8px;">Timeline</div>
              <div class="comm-timeline-content" id="timelineContent" style="background:white; padding:8px; border:1px solid var(--border); border-radius:6px; min-height:200px; overflow:auto;"></div>
            </div>
          </div>

          <div id="statusArea" style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <div id="saveIndicator"></div>
            <div id="statusText" style="color:var(--text-light)">Ready</div>
          </div>
        </div>
      </div>

      <!-- calendar modal -->
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
        /* make ql-editor scrollable and constrained */
        #commEditor .ql-editor {
          max-height: 480px;
          overflow-y: auto;
        }
        /* Inserted images default width 30% */
        #commEditor img.inserted-image { width: 30%; height: auto; display:block; }
        /* selected contact highlight */
        .comm-contact-item.selected { background: #0b57d0; color: white; padding:8px; border-radius:6px; }
        /* history item selected */
        .comm-history-item.selected { background: #0b57d0; color: white; }
        /* responsive */
        @media (max-width:900px) {
          .comm-container { flex-direction:column; }
          .comm-sidebar { order:2; width:100%; }
          .comm-main { order:1; width:100%; }
          .comm-timeline { display:flex; width:100%; order:3; }
        }
      </style>
    `;

    // create inner editor container used to initialize Quill
    // init editor after DOM inserted
    await this.init();
  },

  /* ---------- RTE loader and Quill initialization ---------- */

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
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('Failed to load css: ' + url));
      document.head.appendChild(link);
    });
  },

  _loadScript(url) {
    return new Promise((resolve, reject) => {
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
      // Attach Quill to #editorInner inside commEditor
      const editorInner = document.getElementById('editorInner');
      if (!editorInner) {
        console.warn('Editor inner element missing; fallback to textarea');
        this._rteFallback();
        return;
      }

      // Build a basic toolbar container (we will add custom buttons below)
      const toolbarOptions = [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'image'],
        [{ 'color': [] }, { 'background': [] }],
        ['clean']
      ];

      // Create Quill editor
      this.editor = new Quill(editorInner, {
        theme: 'snow',
        modules: {
          toolbar: toolbarOptions
        }
      });

      // Insert custom toolbar UI (append custom buttons to commToolbar)
      this._buildCustomToolbar();

      if (!this.editor || typeof this.editor.on !== 'function') {
        console.error('Quill instance invalid; using textarea fallback');
        this._rteFallback();
        return;
      }

      // Quill change handling
      this.editor.on('text-change', (delta, oldDelta, source) => {
        // update current note and timeline
        this.currentNote = this.getEditorContent();
        if (typeof this.updateTimeline === 'function') this.updateTimeline();
        // Debounced autosave via queueAutoSave
        if (typeof this.queueAutoSave === 'function') this.queueAutoSave();
      });

      // Paste handler to enforce images scaling
      this.editor.root.addEventListener('paste', async (e) => {
        // small guard; Quill already handles paste; here we ensure images get styled
        setTimeout(() => {
          const imgs = this.editor.root.querySelectorAll('img');
          imgs.forEach(img => {
            img.classList.add('inserted-image');
          });
        }, 50);
      });

      // Show editor UI
      const commEditor = document.getElementById('commEditor');
      if (commEditor) {
        commEditor.style.display = 'block';
      }
      document.getElementById('commNoteArea').style.display = 'none';

      this.useRTE = true;
      console.log('Quill initialized');
    } catch (err) {
      console.error('Failed to initialize Quill:', err);
      this._rteFallback();
    }
  },

  /* ---------- Custom toolbar creation and handlers ---------- */

  _buildCustomToolbar() {
    const toolbar = document.getElementById('commToolbar');
    if (!toolbar) return;

    // Clear existing
    toolbar.innerHTML = '';

    // basic built-in controls (we use simple buttons that call Quill formats)
    const addToolBtn = (label, title, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-sm';
      btn.textContent = label;
      btn.title = title;
      btn.style.padding = '6px 8px';
      btn.onclick = onClick;
      toolbar.appendChild(btn);
      return btn;
    };

    // Formatting buttons using Quill APIs
    addToolBtn('B', 'Bold', () => this.editor.format('bold', !this.editor.getFormat().bold));
    addToolBtn('I', 'Italic', () => this.editor.format('italic', !this.editor.getFormat().italic));
    addToolBtn('U', 'Underline', () => this.editor.format('underline', !this.editor.getFormat().underline));
    addToolBtn('• List', 'Bullet List', () => { this.editor.format('list', 'bullet'); });
    addToolBtn('1. List', 'Numbered List', () => { this.editor.format('list', 'ordered'); });

    // Color and background selectors (use native selects)
    const colorSelect = document.createElement('input');
    colorSelect.type = 'color';
    colorSelect.title = 'Text color';
    colorSelect.style.marginLeft = '6px';
    colorSelect.onchange = (e) => {
      this.editor.format('color', e.target.value);
    };
    toolbar.appendChild(colorSelect);

    const bgSelect = document.createElement('input');
    bgSelect.type = 'color';
    bgSelect.title = 'Highlight color';
    bgSelect.style.marginLeft = '6px';
    bgSelect.onchange = (e) => {
      this.editor.format('background', e.target.value);
    };
    toolbar.appendChild(bgSelect);

    // Emoji button - open small prompt to insert emoji characters
    addToolBtn('😀', 'Insert emoji', () => {
      const emoji = prompt('Enter emoji (or paste one):', '😀');
      if (emoji) {
        const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
        this.editor.insertText(range.index, emoji, 'user');
        this.editor.setSelection(range.index + emoji.length);
      }
    });

    // Insert Link: if selection present use Quill's link format; if not prompt for url & text
    addToolBtn('🔗', 'Insert Hyperlink', () => {
      const range = this.editor.getSelection();
      if (range && range.length > 0) {
        const url = prompt('Enter URL', 'https://');
        if (url) this.editor.format('link', url);
      } else {
        // prompt for both
        const url = prompt('Enter URL', 'https://');
        if (!url) return;
        const text = prompt('Link text', url);
        const insertText = text || url;
        const insertAt = (this.editor.getSelection(true) || { index: this.editor.getLength() }).index;
        this.editor.insertText(insertAt, insertText, { link: url });
        this.editor.setSelection(insertAt + insertText.length);
      }
    });

    // Insert Calendar button -> opens modal with richer fields; handler below
    const calBtn = addToolBtn('📅', 'Insert Calendar Event', () => {
      this._openCalendarModal();
    });

    // Insert file button
    addToolBtn('📎', 'Insert file (Google Drive)', () => {
      this._handleInsertFile();
    });

    // Image upload button
    addToolBtn('🖼️', 'Insert image', () => {
      this._handleImageInsert();
    });

    // Insert table button (inserts a simple table HTML)
    addToolBtn('🔳', 'Insert table', () => {
      const rows = parseInt(prompt('Rows', '2'), 10) || 2;
      const cols = parseInt(prompt('Columns', '2'), 10) || 2;
      let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
      for (let r=0; r<rows; r++) {
        tableHtml += '<tr>';
        for (let c=0; c<cols; c++) {
          tableHtml += `<td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table><p></p>';
      const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
      // paste HTML by using dangerouslyPasteHTML if clipboard available, otherwise insert plain text fallback
      if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) {
        this.editor.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
      } else {
        this.editor.insertText(range.index, this._stripHtml(tableHtml));
      }
    });

    // Save button moved to toolbar as icon (duplicate save and close still in header)
    addToolBtn('💾', 'Save note (Enter also saves)', () => {
      if (typeof this.handleEnterSave === 'function') this.handleEnterSave();
    });

    // Keep styling tidy
    toolbar.style.alignItems = 'center';
  },

  /* ---------- File / Image Insert Handlers ---------- */

  async _handleImageInsert() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // If googleDriveLink + OAuth available, upload to Drive (hook area)
      if (this.googleDriveLink && window.gapi && window.gapi.client && this._driveUploadAvailable()) {
        try {
          const uploaded = await this._uploadFileToDrive(file);
          // insert link / image link
          const url = uploaded.webViewLink || uploaded.webContentLink || uploaded.thumbnailLink || uploaded.id;
          const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
          this.editor.insertEmbed(range.index, 'image', url);
          // apply 30% width via DOM after insertion
          setTimeout(() => {
            const imgs = this.editor.root.querySelectorAll('img');
            const img = imgs[imgs.length-1];
            if (img) img.classList.add('inserted-image');
          }, 50);
        } catch (err) {
          console.error('Drive upload failed', err);
          alert('Drive upload failed. Inserting image as base64 instead.');
          this._insertImageAsBase64(file);
        }
      } else {
        // fallback: insert inline base64
        this._insertImageAsBase64(file);
      }
    };
    input.click();
  },

  _insertImageAsBase64(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
      this.editor.insertEmbed(range.index, 'image', dataUrl);
      setTimeout(() => {
        const imgs = this.editor.root.querySelectorAll('img');
        const img = imgs[imgs.length-1];
        if (img) img.classList.add('inserted-image');
      }, 50);
    };
    reader.readAsDataURL(file);
  },

  async _handleInsertFile() {
    // Use Drive upload if available, otherwise create a reference to the stored googleDriveLink
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!this.googleDriveLink) {
        // prompt to save drive link
        if (confirm('No Google Drive folder configured. Would you like to save a Google Drive folder link for uploads?')) {
          const link = prompt('Enter your Google Drive folder link (shareable):', '');
          if (link) {
            this.googleDriveLink = link;
            localStorage.setItem('userSettings', JSON.stringify({ googleDriveLink: link }));
            alert('Saved Google Drive folder link. File reference will be inserted pointing to that folder.');
          }
        }
      }
      if (this.googleDriveLink && (!window.gapi || !this._driveUploadAvailable())) {
        // fallback: insert a reference string into the editor pointing to the folder (user must upload separately)
        const folderRef = `${this.googleDriveLink.replace(/\/$/, '')}/${encodeURIComponent(file.name)}`;
        const insertText = `📎 ${file.name} - ${folderRef}`;
        const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
        this.editor.insertText(range.index, insertText, 'user');
      } else if (this._driveUploadAvailable()) {
        try {
          const uploaded = await this._uploadFileToDrive(file);
          const link = uploaded.webViewLink || uploaded.webContentLink || uploaded.id;
          const insertText = `📎 ${file.name} - ${link}`;
          const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
          this.editor.insertText(range.index, insertText, 'user');
        } catch (err) {
          console.error('Drive upload failed', err);
          alert('Drive upload failed; inserted a local reference.');
          const range = this.editor.getSelection(true) || { index: this.editor.getLength() };
          this.editor.insertText(range.index, `📎 ${file.name}`, 'user');
        }
      }
    };
    input.click();
  },

  // Placeholder helper to check if drive upload via gapi is configured
  _driveUploadAvailable() {
    // Replace this with real checks for gapi auth + drive scope
    return !!(window.gapi && window.gapi.client && window.gapi.client.drive);
  },

  // Upload file to Google Drive via gapi client (requires prior gapi auth & drive scope)
  async _uploadFileToDrive(file) {
    // This requires the app to have loaded gapi, initialized with clientId, and user to have signed in with drive.file or drive scopes.
    // Implementer note: you must include gapi script and call gapi.auth2.init / gapi.client.init with your client id and scopes.
    if (!this._driveUploadAvailable()) throw new Error('Drive API not configured.');

    // Create metadata
    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [] // leave blank or the folder id extracted from googleDriveLink if provided
    };

    // If googleDriveLink contains folder ID, parse it
    const folderId = this._extractDriveFolderId(this.googleDriveLink);
    if (folderId) metadata.parents = [folderId];

    const accessToken = gapi.auth.getToken().access_token;
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink,thumbnailLink', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
      body: form
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Drive upload failed');
    }
    return await res.json();
  },

  _extractDriveFolderId(link) {
    if (!link) return null;
    // Try to find folder id in typical drive URLs
    const m = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  },

  /* ---------- Initialization and event wiring ---------- */

  async init() {
    // Load local Quill CSS/JS
    const cssPath = 'css/quill.css'; // ensure deploy copies this
    const jsPath = 'js/quill.js';    // ensure deploy copies this

    await this._ensureRTE(cssPath, jsPath);

    if (!window.EncryptionService || !EncryptionService.isReady()) {
      const cList = document.getElementById('contactList');
      if (cList) cList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger)">Encryption not initialized. Please refresh.</div>';
      return;
    }

    // Load contacts, user settings, icons
    if (typeof this.loadContacts === 'function') await this.loadContacts();
    if (typeof this.loadUserSettings === 'function') await this.loadUserSettings();
    if (typeof this.displayContacts === 'function') this.displayContacts();
    if (typeof this.updateTimeline === 'function') this.updateTimeline();
    if (typeof this.loadIcons === 'function') await this.loadIcons();

    // Wire textarea fallback if not using RTE
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
      // Add enter binding to Quill keyboard (still allow newline)
      try {
        if (this.editor && this.editor.keyboard && typeof this.editor.keyboard.addBinding === 'function') {
          this.editor.keyboard.addBinding({ key: 13 }, (range, context) => {
            if (typeof this.handleEnterSave === 'function') {
              this.handleEnterSave().catch(e => console.error(e));
            }
            return true;
          });
        }
      } catch (e) {
        console.warn('Could not attach Enter binding', e);
      }
    }

    // Ensure Save & Close exists (header button)
    const sc = document.getElementById('btnSaveClose');
    if (sc) sc.onclick = () => { if (typeof this.saveAndClose === 'function') this.saveAndClose(); };

    // restore googleDriveLink from settings if present
    try {
      const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
      this.googleDriveLink = settings.googleDriveLink || this.googleDriveLink || null;
    } catch (e) {
      this.googleDriveLink = this.googleDriveLink || null;
    }
  },

  /* ---------- Autosave + Save helpers ---------- */

  queueAutoSave() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      // autosave using same save method as Enter (overwrite NoteID)
      if (typeof this.handleEnterSave === 'function') this.handleEnterSave().catch(e => console.error('Auto-save failed', e));
    }, 1800);
  },

  // Save & Close - exposed for header and toolbar
  async saveAndClose() {
    if (!this.selectedContact) return;
    const indicator = document.getElementById('saveIndicator');
    if (indicator) indicator.innerHTML = '<span class="comm-save-spinner"></span>Saving...';
    try {
      // ensure final save
      if (typeof this.handleEnterSave === 'function') await this.handleEnterSave();
      if (indicator) indicator.innerHTML = '✓ Saved';
      setTimeout(() => {
        if (indicator) indicator.innerHTML = '';
      }, 1200);
      // deselect contact
      if (typeof this.deselectContact === 'function') this.deselectContact();
    } catch (err) {
      console.error('Save and close failed', err);
      if (indicator) indicator.innerHTML = '✗ Save failed';
    }
  },

  /* ---------- Calendar modal handlers ---------- */

  _openCalendarModal() {
    const modal = document.getElementById('rteCalendarModal');
    if (!modal) return;
    // set defaults
    const now = new Date();
    const start = new Date(now.getTime() + (5*60*1000));
    const end = new Date(start.getTime() + 60*60*1000);
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
      // Build google calendar create url
      const startIso = new Date(startVal).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
      const endIso = new Date(endVal).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${startIso}/${endIso}`,
        details: desc,
        location: loc,
        sf: 'true',
        output: 'xml'
      });
      const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
      // Insert an event text into editor plus link to add
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
    const modal = document.getElementById('rteCalendarModal');
    if (modal) modal.style.display = 'none';
  },

  /* ---------- Contacts + History UI ---------- */

  async loadContacts() {
    try {
      this.contacts = await getContacts();
    } catch (err) {
      console.error('Error loading contacts', err);
      const listEl = document.getElementById('contactList');
      if (listEl) listEl.innerHTML = `<div style="padding:12px;color:var(--danger)">Error loading contacts</div>`;
    }
  },

  displayContacts() {
    const listEl = document.getElementById('contactList');
    if (!listEl) return;
    const filtered = this.getFilteredContacts();
    if (!filtered || filtered.length === 0) {
      listEl.innerHTML = `<div style="padding:12px;color:var(--text-light)">No contacts</div>`;
      return;
    }
    listEl.innerHTML = filtered.map(c => `
      <div class="comm-contact-item" data-contact-id="${c.id}" onclick="CommunicationsTab.selectContact(${c.id})" style="padding:8px; cursor:pointer;">
        <div style="font-weight:600">${c.name}</div>
        <div style="font-size:0.85em;color:var(--text-light)">${c.organization || ''}</div>
      </div>
    `).join('');
  },

  getFilteredContacts() {
    if (!this.searchQuery) return this.contacts.sort((a,b)=>a.name.localeCompare(b.name));
    const q = this.searchQuery.toLowerCase();
    return this.contacts.filter(c => c.name.toLowerCase().includes(q) || (c.organization||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  },

  handleContactSearch(value) {
    this.searchQuery = value; this.displayContacts();
  },

  async selectContact(contactId) {
    this.selectedContact = this.contacts.find(c => c.id === contactId);
    if (!this.selectedContact) return;

    // highlight selected contact in sidebar
    document.querySelectorAll('#contactList .comm-contact-item').forEach(el => {
      el.classList.remove('selected');
      if (el.dataset.contactId && parseInt(el.dataset.contactId) === contactId) {
        el.classList.add('selected');
      }
    });

    // show history area
    document.getElementById('contactList').style.display = 'none';
    document.getElementById('historyList').style.display = 'block';
    document.getElementById('selectedContactHeader').textContent = this.selectedContact.name;
    document.getElementById('selectedContactInfo').innerHTML = `
      <h3 style="margin:0 0 6px 0">${this.selectedContact.name}</h3>
      <div style="color:var(--text-light)">${this.selectedContact.organization || 'No organization'}</div>
    `;
    // set default summary to current date/time
    const summaryInput = document.getElementById('commSummary');
    if (summaryInput) {
      summaryInput.style.display = 'block';
      const now = new Date();
      summaryInput.value = `${now.toLocaleString()}`;
      summaryInput.disabled = false;
    }

    // enable editor
    if (this.useRTE && this.editor) { this.editor.enable(true); this.setEditorContent(''); this.editor.focus(); }
    else { const ta = document.getElementById('commNoteArea'); if (ta) { ta.disabled=false; ta.value=''; ta.focus(); } }

    this.currentNote = ''; this.lastTimestamp = null; this.currentNoteId = null;

    // toolbar button enabling
    ['btnInsertTimestamp','btnInsertDate','btnUploadFile','btnInsertMenu','btnClearNote','btnNewNote'].forEach(id => {
      const el = document.getElementById(id); if (el) el.disabled = false;
    });

    // load communications for contact (manifest)
    await this.loadContactCommunications();
  },

  deselectContact() {
    this.selectedContact = null; this.communications = []; this.currentNote = ''; this.lastTimestamp = null; this.currentNoteId = null;
    document.getElementById('contactList').style.display = 'block';
    document.getElementById('historyList').style.display = 'none';
    document.getElementById('selectedContactInfo').innerHTML = `<p style="color:var(--text-light)">Select a contact to start logging communications</p>`;
    const summary = document.getElementById('commSummary'); if (summary) summary.style.display = 'none';
    if (!this.useRTE) { const ta = document.getElementById('commNoteArea'); if (ta) { ta.disabled=true; ta.value=''; } } else if (this.editor) { this.editor.disable(); this.setEditorContent(''); }
    this.displayContacts(); this.closePreviousView();
  },

  async loadContactCommunications() {
    try {
      // ensure CommunicationsStorage available
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
    const historyEl = document.getElementById('historyItems');
    if (!historyEl) return;
    if (!this.communications || this.communications.length === 0) {
      historyEl.innerHTML = `<div style="padding:12px;color:var(--text-light)">No previous communications</div>`;
      return;
    }

    historyEl.innerHTML = this.communications.map(comm => `
      <div class="comm-history-item" data-comm-id="${comm.id}" onclick="CommunicationsTab.viewCommunication('${comm.id}')" style="padding:8px; margin-bottom:6px; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1">
          <div style="font-size:0.85em;color:var(--text-light)">${formatDate(comm.timestamp)}</div>
          <div style="font-weight:600">${comm.summary || 'No summary'}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${(window.currentUser && window.currentUser.isAdmin) ? `<button class="btn-sm btn-danger" onclick="event.stopPropagation(); CommunicationsTab.handleDeleteNoteClick('${comm.id}')">Delete</button>` : ''}
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
      if (prev) prev.innerHTML = comm.content || this._escapeHtml(comm.content || '');
      // highlight selected history item
      document.querySelectorAll('#historyItems .comm-history-item').forEach(el => el.classList.remove('selected'));
      const el = document.querySelector(`#historyItems .comm-history-item[data-comm-id="${commId}"]`);
      if (el) el.classList.add('selected');
    } catch (err) {
      console.error('Error loading communication', err);
      alert('Failed to load communication');
    }
  },

  async handleDeleteNoteClick(commId) {
    if (!confirm('Delete this note (it will be archived; only admins can view deleted notes). Continue?')) return;
    try {
      await CommunicationsStorage.archiveAndDeleteNote(this.selectedContact.id, commId, (window.currentUser && window.currentUser.email) || 'unknown');
      await this.loadContactCommunications();
      if (window.currentUser && window.currentUser.isAdmin) this._renderDeletedNotesSection?.();
      alert('Note archived (deleted).');
    } catch (err) {
      console.error('Archive/Delete failed', err);
      alert('Failed to archive/delete note: ' + (err.message || err));
    }
  },

  /* ---------- Utility / storage wait helper ---------- */

  async _waitForStorage(timeoutMs = 2000) {
    const start = Date.now();
    while (!window.CommunicationsStorage && (Date.now() - start) < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
    }
    return !!window.CommunicationsStorage;
  },

  /* ---------- get/set editor content, timeline rendering ---------- */

  getEditorContent() {
    if (this.useRTE && this.editor) return this.editor.root.innerHTML || '';
    const ta = document.getElementById('commNoteArea'); return ta ? ta.value : '';
  },

  setEditorContent(html) {
    if (this.useRTE && this.editor) {
      try {
        if (this.editor.clipboard && this.editor.clipboard.dangerouslyPasteHTML) this.editor.clipboard.dangerouslyPasteHTML(this.editor.getLength(), html || '');
        else this.editor.root.innerHTML = html || '';
      } catch (e) {
        this.editor.root.innerHTML = html || '';
      }
    } else {
      const ta = document.getElementById('commNoteArea'); if (ta) ta.value = this._stripHtml(html || '');
    }
    this.currentNote = html || '';
    if (typeof this.updateTimeline === 'function') this.updateTimeline();
  },

  _renderTimelineFromSavedContent(savedHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${savedHtml}</div>`, 'text/html');
    const rows = Array.from(doc.querySelectorAll('.note-row'));
    const timelineEl = document.getElementById('timelineContent');
    if (!timelineEl) return;
    let html = '';
    rows.forEach((row, idx) => {
      const tsEl = row.querySelector('.note-ts');
      const tsText = tsEl ? tsEl.textContent.trim() : '';
      html += `<div class="comm-timestamp">${idx === 0 ? this._escapeHtml(tsText) : '&nbsp;'}</div>`;
    });
    if (rows.length === 0) {
      const nowStr = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
      html = `<div class="comm-timestamp">${this._escapeHtml(nowStr)}</div>`;
    }
    timelineEl.innerHTML = html;
  },

  updateTimeline() {
    const content = this.getEditorContent();
    if (!content) { const t = document.getElementById('timelineContent'); if (t) t.innerHTML = ''; return; }
    let savedHtml = '';
    if (/<div class="note-row"/.test(content)) savedHtml = content; else {
      const lines = this._stripHtml(content).split('\n');
      savedHtml = lines.map((l, idx) => `<div class="note-row" data-line="${idx}"><span class="note-ts"></span><span class="note-text">${this._escapeHtml(l)}</span></div>`).join('');
    }
    this._renderTimelineFromSavedContent(savedHtml);
  },

  /* ---------- Note saving logic (Enter or autosave uses this) ---------- */

  _generateDateId() {
    const d = new Date(); const pad = n => String(n).padStart(2,'0');
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
    if (!this.selectedContact) { console.warn('No contact selected'); return; }
    const contentHtml = this.getEditorContent() || '';
    const plainText = this._stripHtml(contentHtml);
    const lines = plainText.split('\n');
    const nowTime = new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });

    const savedHtml = lines.map((line, idx) => {
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
    if (!noteId) { console.error('Cannot create NoteID'); return; }

    try {
      // Try saveNoteById, fallback to saveNoteSession
      if (typeof CommunicationsStorage?.saveNoteById === 'function') {
        await CommunicationsStorage.saveNoteById(this.selectedContact.id, noteId.split('_')[1], savedHtml, document.getElementById('commSummary')?.value || '');
      } else if (typeof CommunicationsStorage?.saveNoteSession === 'function') {
        await CommunicationsStorage.saveNoteSession(this.selectedContact.id, noteId, savedHtml, document.getElementById('commSummary')?.value || '');
      } else {
        throw new Error('No save method available in CommunicationsStorage');
      }
      this.lastSaveTime = new Date();
      this.currentNote = savedHtml;
      this._renderTimelineFromSavedContent(savedHtml);
      if (typeof this.loadContactCommunications === 'function') await this.loadContactCommunications();
    } catch (err) {
      console.error('Save failed', err);
      alert('Save failed: ' + (err.message || err));
    }
  },

  /* ---------- Simple utilities ---------- */

  _escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); },
  _stripHtml(html) { if (!html) return ''; const d = document.createElement('div'); d.innerHTML = html; return d.textContent || d.innerText || ''; },

  /* ---------- User settings helpers ---------- */

  async loadUserSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('userSettings') || '{}');
      this.googleDriveLink = s.googleDriveLink || this.googleDriveLink || null;
    } catch (e) { this.googleDriveLink = this.googleDriveLink || null; }
  },

  // For convenience – call to save googleDriveLink
  saveDriveLink(link) {
    this.googleDriveLink = link;
    const s = JSON.parse(localStorage.getItem('userSettings') || '{}');
    s.googleDriveLink = link;
    localStorage.setItem('userSettings', JSON.stringify(s));
  }

};

window.CommunicationsTab = CommunicationsTab;
