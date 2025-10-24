// QuillEditor wrapper - updated to accept customButtonSelectors and attach event listeners
(function(global){
  const QuillEditor = {
    _quill: null,
    _listeners: [],
    _opts: null,

    async init(opts = {}) {
      this._opts = Object.assign({
        editorSelector: '#commEditor',
        toolbarSelector: '#quill-toolbar',
        cssPath: 'css/quill.css',
        jsPath: 'js/quill.js',
        showTimeline: true,
        customButtonSelectors: {} // e.g. { insertEmoji: '.btn-insert-emoji', save: '.btn-save' }
      }, opts);

      await this._ensureCss(this._opts.cssPath);
      await this._ensureScript(this._opts.jsPath);

      const editorEl = document.querySelector(this._opts.editorSelector);
      const toolbarEl = document.querySelector(this._opts.toolbarSelector);
      if (!editorEl) throw new Error('Quill editor container not found: ' + this._opts.editorSelector);
      if (!toolbarEl) throw new Error('Quill toolbar container not found: ' + this._opts.toolbarSelector);

      // Initialize Quill with the toolbar DOM
      this._quill = new Quill(this._opts.editorSelector, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarEl
            // do not pass empty handlers object here to avoid warnings
          }
        }
      });

      // Attach custom handlers to customButtonSelectors if provided
      this._registerCustomHandlers(toolbarEl, this._opts.customButtonSelectors);

      // wire change event
      this._quill.on('text-change', () => {
        const html = this.getHTML();
        this._listeners.forEach(cb => {
          try { cb(html); } catch(e) { console.error(e); }
        });
      });

      // make editor scrollable
      const qlEditor = editorEl.querySelector('.ql-editor');
      if (qlEditor) qlEditor.style.overflowY = 'auto';

      // timeline visibility
      if (typeof this._opts.showTimeline !== 'undefined') {
        const timeline = document.querySelector('.comm-timeline');
        if (timeline) timeline.style.display = this._opts.showTimeline ? '' : 'none';
      }

      return this._quill;
    },

    _registerCustomHandlers(toolbarEl, selectors) {
      // selectors is object like { insertEmoji: '.btn-insert-emoji', ... }
      if (!toolbarEl || !selectors) return;

      const attach = (name, selector, handler) => {
        if (!selector) return;
        const btn = toolbarEl.querySelector(selector);
        if (btn) btn.addEventListener('click', (e) => {
          e.preventDefault();
          handler.call(this, e);
        });
      };

      attach('insertEmoji', selectors.insertEmoji, () => this._handlerInsertEmoji());
      attach('insertCalendar', selectors.insertCalendar, () => {
        if (typeof this._opts.onOpenCalendar === 'function') this._opts.onOpenCalendar();
        else this._handlerOpenCalendar();
      });
      attach('insertFile', selectors.insertFile, () => {
        if (typeof this._opts.onInsertFile === 'function') this._opts.onInsertFile();
        else this._handlerInsertFile();
      });
      attach('insertTable', selectors.insertTable, () => {
        if (typeof this._opts.onInsertTable === 'function') this._opts.onInsertTable();
        else this._handlerInsertTable();
      });
      attach('save', selectors.save, () => {
        if (typeof this._opts.onSave === 'function') this._opts.onSave();
      });

      // Also attach image button to Quill's built-in handler by listening to .ql-image (Quill provides behavior)
      // Link button: Quill handles it. We leave default behavior.
    },

    _handlerInsertEmoji() {
      const emoji = prompt('Insert emoji (paste or type):', '😀');
      if (!emoji) return;
      const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
      this._quill.insertText(range.index, emoji, 'user');
      this._quill.setSelection(range.index + emoji.length);
    },

    _handlerOpenCalendar() {
      if (typeof this._opts.onOpenCalendar === 'function') { this._opts.onOpenCalendar(); return; }
      const title = prompt('Event title', '');
      if (!title) return;
      const start = prompt('Start (YYYY-MM-DD HH:MM)', '');
      const end = prompt('End (YYYY-MM-DD HH:MM)', '');
      const startIso = start ? new Date(start).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z' : '';
      const endIso = end ? new Date(end).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z' : '';
      const params = new URLSearchParams({ action:'TEMPLATE', text:title, dates:`${startIso}/${endIso}`, sf:'true', output:'xml' });
      const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
      const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
      this._quill.insertText(range.index, `📅 ${title} `, 'user');
      this._quill.insertText(range.index + title.length + 2, `Add to Google Calendar: ${url}`, 'user');
    },

    _handlerInsertFile() {
      if (typeof this._opts.onInsertFile === 'function') { this._opts.onInsertFile(); return; }
      const url = prompt('Enter file URL', '');
      if (!url) return;
      const text = prompt('File text', url) || url;
      const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
      this._quill.insertText(range.index, `${text} - ${url}`, 'user');
    },

    _handlerInsertTable() { const rows = parseInt(prompt('Rows', '2')) || 2; const cols = parseInt(prompt('Cols', '2')) || 2; let tableHtml = '<table style="width:100%;border-collapse:collapse;">'; for (let r=0;r<rows;r++){ tableHtml += '<tr>'; for (let c=0;c<cols;c++) tableHtml += '<td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>'; tableHtml += '</tr>'; } tableHtml += '</table><p></p>'; const range = this._quill.getSelection(true) || { index:this._quill.getLength() }; if (this._quill.clipboard && this._quill.clipboard.dangerouslyPasteHTML) this._quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml); else this._quill.insertText(range.index, this._stripHtml(tableHtml), 'user'); },

    getHTML() { return this._quill ? this._quill.root.innerHTML : ''; },
    setHTML(html) { if (!this._quill) return; if (this._quill.clipboard && this._quill.clipboard.dangerouslyPasteHTML) this._quill.clipboard.dangerouslyPasteHTML(0, html); else this._quill.root.innerHTML = html; },

    onChange(cb) { if (typeof cb === 'function') this._listeners.push(cb); },

    destroy() { this._quill = null; this._listeners = []; },

    _ensureCss(path) { return new Promise((resolve) => { if ([...document.styleSheets].some(s => s.href && s.href.includes(path))) return resolve(); const link = document.createElement('link'); link.rel='stylesheet'; link.href=path; link.onload = () => resolve(); link.onerror = () => { console.warn('Could not load CSS', path); resolve(); }; document.head.appendChild(link); }); },

    _ensureScript(path) { return new Promise((resolve, reject) => { if ([...document.scripts].some(s => s.src && s.src.includes(path))) return resolve(); const s=document.createElement('script'); s.src = path; s.defer=true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load script ' + path)); document.body.appendChild(s); }); },

    _stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || d.innerText || ''; }
  };

  global.QuillEditor = QuillEditor;
})(window);
