// modules/quill-editor.js
// Small Quill wrapper module that initializes Quill with a proper toolbar DOM and registers custom handlers.
// Exposes: QuillEditor.init(options), .getHTML(), .setHTML(html), .onChange(cb), .insertImage(url), .promptLink(), .openCalendar(), .destroy()
//
// Usage example:
//   await QuillEditor.init({
//     editorSelector: '#commEditor',
//     toolbarSelector: '#quill-toolbar',
//     cssPath: 'css/quill.css',
//     jsPath: 'js/quill.js',
//     showTimeline: true
//   });
//   QuillEditor.onChange(html => { /* ... */ });
//
// NOTE: this module expects the toolbar DOM to include standard quill button elements (ql-bold, ql-link, etc.)
//       and accepts a few custom button classes (ql-insertEmoji, ql-insertCalendar, ql-insertFile, ql-insertTable, ql-save).

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
        showTimeline: true
      }, opts);

      // Ensure CSS and JS exist (load if not present)
      await this._ensureCss(this._opts.cssPath);
      await this._ensureScript(this._opts.jsPath);

      // Wait for DOM toolbar/editor elements to exist
      const editorEl = document.querySelector(this._opts.editorSelector);
      const toolbarEl = document.querySelector(this._opts.toolbarSelector);
      if (!editorEl) throw new Error('Quill editor container not found: ' + this._opts.editorSelector);
      if (!toolbarEl) throw new Error('Quill toolbar container not found: ' + this._opts.toolbarSelector);

      // Initialize Quill with toolbar DOM container so the snow css applies
      this._quill = new Quill(this._opts.editorSelector, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: toolbarEl,
            handlers: {
              // handlers are registered below as well
            }
          }
        }
      });

      // Register built-in + custom handlers
      this._registerHandlers(toolbarEl);

      // wire change event
      this._quill.on('text-change', () => {
        const html = this.getHTML();
        this._listeners.forEach(cb => {
          try { cb(html); } catch(e) { console.error(e); }
        });
      });

      // make sure editor content area scrolls (in case CSS missing)
      const qlEditor = editorEl.querySelector('.ql-editor');
      if (qlEditor) qlEditor.style.overflowY = 'auto';

      // Timeline setting: show/hide timeline container if provided
      if (typeof this._opts.showTimeline !== 'undefined') {
        const timeline = document.querySelector('.comm-timeline');
        if (timeline) timeline.style.display = this._opts.showTimeline ? '' : 'none';
      }

      return this._quill;
    },

    _registerHandlers(toolbarEl) {
      const tm = this._quill.getModule('toolbar');
      // custom handlers will be called by toolbar buttons by class name (e.g., .ql-insertEmoji)
      // add event listeners directly to toolbar buttons for any custom actions
      if (!toolbarEl) return;

      // helper to attach button handler by class
      const attach = (className, handler) => {
        const btn = toolbarEl.querySelector('.' + className);
        if (btn) btn.addEventListener('click', (e) => {
          e.preventDefault();
          handler.call(this, e);
        });
      };

      attach('ql-insertEmoji', () => this._handlerInsertEmoji());
      attach('ql-insertCalendar', () => this._handlerOpenCalendar());
      attach('ql-insertFile', () => this._handlerInsertFile());
      attach('ql-insertTable', () => this._handlerInsertTable());
      attach('ql-save', () => { if (typeof this._opts.onSave === 'function') this._opts.onSave(); });

      // If link button should behave specially when no selection, we can override
      const linkBtn = toolbarEl.querySelector('.ql-link');
      if (linkBtn) {
        linkBtn.addEventListener('click', (e) => {
          // Defer to default Quill dialog if selection present
          const range = this._quill.getSelection();
          if (!range || range.length === 0) {
            e.preventDefault();
            // custom prompt
            const url = prompt('Enter URL', 'https://');
            if (!url) return;
            const text = prompt('Link text', url) || url;
            const insertAt = (this._quill.getSelection(true) || { index: this._quill.getLength() }).index;
            this._quill.insertText(insertAt, text, { link: url });
            this._quill.setSelection(insertAt + text.length);
          } // else leave default behaviour
        });
      }
    },

    _handlerInsertEmoji() {
      const emoji = prompt('Insert emoji (paste, or type)');
      if (!emoji) return;
      const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
      this._quill.insertText(range.index, emoji, 'user');
      this._quill.setSelection(range.index + emoji.length);
    },

    _handlerOpenCalendar() {
      // expose hook for external calendar modal or implement simple prompt here
      if (typeof this._opts.onOpenCalendar === 'function') {
        this._opts.onOpenCalendar();
        return;
      }
      // fallback: simple prompt to insert a google calendar link
      const title = prompt('Event title', '');
      if (!title) return;
      const start = prompt('Start (YYYY-MM-DD HH:MM)', '');
      const end = prompt('End (YYYY-MM-DD HH:MM)', '');
      const startIso = start ? new Date(start).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z' : '';
      const endIso = end ? new Date(end).toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z' : '';
      const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${startIso}/${endIso}`, sf:'true', output:'xml' });
      const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
      const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
      this._quill.insertText(range.index, `📅 ${title} `, 'user');
      this._quill.insertText(range.index + title.length + 2, `Add to Google Calendar: ${url}`, 'user');
    },

    _handlerInsertFile() {
      if (typeof this._opts.onInsertFile === 'function') {
        this._opts.onInsertFile();
        return;
      }
      // fallback: prompt for a file URL
      const url = prompt('Enter file URL', '');
      if (!url) return;
      const text = prompt('File text', url) || url;
      const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
      this._quill.insertText(range.index, `${text} - ${url}`, 'user');
    },

    _handlerInsertTable() {
      if (typeof this._opts.onInsertTable === 'function') { this._opts.onInsertTable(); return; }
      const rows = parseInt(prompt('Rows', '2')) || 2;
      const cols = parseInt(prompt('Cols', '2')) || 2;
      let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
      for (let r=0;r<rows;r++){
        tableHtml += '<tr>';
        for (let c=0;c<cols;c++) tableHtml += '<td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>';
        tableHtml += '</tr>';
      }
      tableHtml += '</table><p></p>';
      const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
      if (this._quill.clipboard && this._quill.clipboard.dangerouslyPasteHTML) {
        this._quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
      } else {
        this._quill.insertText(range.index, this._stripHtml(tableHtml), 'user');
      }
    },

    getHTML() {
      if (!this._quill) return '';
      return this._quill.root.innerHTML;
    },

    setHTML(html) {
      if (!this._quill) return;
      if (this._quill.clipboard && this._quill.clipboard.dangerouslyPasteHTML) {
        this._quill.clipboard.dangerouslyPasteHTML(0, html);
      } else {
        this._quill.root.innerHTML = html;
      }
    },

    onChange(cb) {
      if (typeof cb === 'function') this._listeners.push(cb);
    },

    destroy() {
      if (this._quill) {
        this._quill = null;
        this._listeners = [];
      }
    },

    _ensureCss(path) {
      return new Promise((resolve) => {
        // if already loaded resolve
        if ([...document.styleSheets].some(s => s.href && s.href.includes(path))) return resolve();
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = path;
        link.onload = () => resolve();
        link.onerror = () => {
          console.warn('Could not load CSS', path);
          resolve(); // we don't fail hard
        };
        document.head.appendChild(link);
      });
    },

    _ensureScript(path) {
      return new Promise((resolve, reject) => {
        if ([...document.scripts].some(s => s.src && s.src.includes(path))) return resolve();
        const s = document.createElement('script');
        s.src = path;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load script ' + path));
        document.body.appendChild(s);
      });
    },

    _stripHtml(html) {
      const d = document.createElement('div');
      d.innerHTML = html;
      return d.textContent || d.innerText || '';
    }
  };

  global.QuillEditor = QuillEditor;
})(window);
