(function(window){
  if (!window || !document) return;
  var NoteEditor = (function(){
    function injectScript(src){ return new Promise(function(resolve, reject){
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });}
    function injectCSS(href){ if (!document.querySelector('link[href="' + href + '"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
    }}

    function init(opts){
      opts = opts || {};
      var containerId = opts.containerId || 'note-editor';
      var contactId = opts.contactId || null;
      var sessionKey = opts.sessionKey || null; // persistent key for the current note session
      var endpoints = opts.endpoints || { saveNote: '/api/notes/session', fetchNote: '/api/notes/session/:key', upload: '/api/uploads' };

      // vendor paths (adjustable)
      var cssQuill = opts.cssQuill || '/css/quill.snow.css';
      var jsQuill = opts.jsQuill || '/js/quill.js';
      var jsRte = opts.jsRte || '/js/rte.js';
      var jsMarked = opts.jsMarked || '/js/marked.min.js';
      var jsTurndown = opts.jsTurndown || '/js/turndown.min.js';
      var jsDOMPurify = opts.jsDOMPurify || '/js/dompurify.min.js';

      injectCSS(cssQuill);
      var chain = Promise.resolve();
      [jsQuill, jsRte, jsMarked, jsTurndown, jsDOMPurify].forEach(function(p){
        chain = chain.then(function(){ return injectScript(p); }).catch(function(e){ console.warn('Load failed', p, e); });
      });

      var rte = null;
      var autosaveMs = opts.autosaveMs || 2000;
      var autosaveTimer = null;
      var saving = false;

      chain.then(function(){
        window.NoteRTE = window.NoteRTE || {};
        window.NoteRTE.uploadUrl = endpoints.upload;

        rte = window.NoteRTE.create(containerId, {
          theme: 'snow',
          uploadHandler: function(file){
            var form = new FormData(); form.append('file', file);
            return fetch(endpoints.upload, { method: 'POST', body: form }).then(function(res){
              if (!res.ok) throw new Error('Upload failed');
              return res.json();
            });
          },
          onChange: function(){ scheduleAutosave(); }
        });

        if (sessionKey) fetchSessionToEditor(sessionKey);

        function scheduleAutosave(){
          if (autosaveTimer) clearTimeout(autosaveTimer);
          autosaveTimer = setTimeout(saveNow, autosaveMs);
        }

        function saveNow(){
          if (saving) { scheduleAutosave(); return; }
          saving = true;
          var html = rte.getHtml();
          var markdown = (window.TurndownService) ? (new window.TurndownService()).turndown(html) : rte.quill.getText();
          var payload = { contactId: contactId, sessionKey: sessionKey, html: html, markdown: markdown, updatedAt: new Date().toISOString() };

          // use fetch to send to endpoint; endpoint should update (overwrite) by sessionKey
          var url = endpoints.saveNote;
          fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function(res){
              if (!res.ok) throw new Error('Save failed: ' + res.status);
              return res.json();
            }).then(function(json){
              if (json && json.sessionKey) sessionKey = json.sessionKey;
              saving = false;
            }).catch(function(err){
              console.error('Save failed', err); saving = false;
            });
        }

        NoteEditor.saveNow = saveNow;
      });

      // helper to fetch and paste session content into editor
      function fetchSessionToEditor(key){
        var fetchUrl = endpoints.fetchNote.replace(':key', key);
        fetch(fetchUrl).then(function(res){
          if (!res.ok) { console.warn('No session content'); return; }
          return res.json();
        }).then(function(note){
          if (!note) return;
          var htmlToSet = note.html || (window.marked ? window.marked(note.markdown || '') : (note.markdown || ''));
          // wait until rte is created
          var attempt = 0;
          var waitForRTE = setInterval(function(){
            if (NoteEditor.getRte) {
              var rteInst = NoteEditor.getRte();
              if (rteInst && rteInst.quill) {
                rteInst.quill.clipboard.dangerouslyPasteHTML(htmlToSet);
                clearInterval(waitForRTE);
              }
            }
            attempt++;
            if (attempt > 20) clearInterval(waitForRTE);
          }, 150);
        }).catch(function(e){ console.warn('Failed to fetch session', e); });
      }
    }

    return { init: init, saveNow: function(){} };
  })();

  window.NoteEditor = NoteEditor;
})(window);
