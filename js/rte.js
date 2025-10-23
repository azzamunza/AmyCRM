(function(window){
  if (!window || !document) return;
  var NoteRTE = {};

  function $el(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function(k){
      if (k === 'class') el.className = attrs[k];
      else if (k === 'innerHTML') el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    return el;
  }

  NoteRTE.create = function(containerId, options){
    options = options || {};
    if (!window.Quill) throw new Error('Quill not loaded. Load js/quill.js before rte.js');
    var container = document.getElementById(containerId);
    if (!container) throw new Error('Container #' + containerId + ' not found');

    container.innerHTML = '';
    var toolbar = $el('div', { class: 'note-rte-toolbar' });
    var editor = $el('div', { class: 'note-rte-editor' });
    container.appendChild(toolbar);
    container.appendChild(editor);

    // Toolbar configuration
    var toolbarOptions = [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image', 'clean'],
      ['insertFile']
    ];

    // Quill instance
    var quill = new Quill(editor, {
      theme: options.theme || 'snow',
      modules: {
        toolbar: {
          container: toolbarOptions,
          handlers: {
            'insertFile': function() {
              var input = document.createElement('input');
              input.type = 'file';
              input.style.display = 'none';
              document.body.appendChild(input);
              input.addEventListener('change', function(e){
                var file = input.files[0];
                if (!file) { input.remove(); return; }
                var uploadHandler = options.uploadHandler || NoteRTE.defaultUploadHandler;
                uploadHandler(file).then(function(result){
                  var sel = quill.getSelection(true);
                  var index = sel ? sel.index : quill.getLength();
                  // Insert filename text with link
                  quill.insertText(index, result.filename, { link: result.url });
                  quill.setSelection(index + result.filename.length, 0);
                  if (options.onFileInsert) options.onFileInsert(result);
                }).catch(function(err){
                  console.error('File upload failed', err);
                  if (options.onFileUploadError) options.onFileUploadError(err);
                }).finally(function(){
                  input.remove();
                });
              });
              input.click();
            }
          }
        }
      }
    });

    // Add a visible Attach button so users can click it
    var fileButton = document.createElement('button');
    fileButton.type = 'button';
    fileButton.innerText = 'Attach';
    fileButton.className = 'ql-insertFile';
    toolbar.appendChild(fileButton);

    var changeTimer = null;
    quill.on('text-change', function(delta, oldDelta, source){
      if (options.onChange) {
        if (changeTimer) clearTimeout(changeTimer);
        changeTimer = setTimeout(function(){
          options.onChange({
            html: quill.root.innerHTML,
            text: quill.getText(),
            delta: quill.getContents()
          });
        }, options.changeDebounce || 250);
      }
    });

    function getHtml() { return quill.root.innerHTML; }
    function getMarkdown() {
      if (window.TurndownService) {
        var turndown = new window.TurndownService();
        return turndown.turndown(getHtml());
      } else {
        return quill.getText();
      }
    }

    function destroy() { container.innerHTML = ''; }

    return {
      quill: quill,
      getHtml: getHtml,
      getMarkdown: getMarkdown,
      destroy: destroy
    };
  };

  NoteRTE.defaultUploadHandler = function(file){
    return new Promise(function(resolve, reject){
      var url = (window.NoteRTE && window.NoteRTE.uploadUrl) || '/api/uploads';
      var form = new FormData();
      form.append('file', file);
      fetch(url, { method: 'POST', body: form }).then(function(res){
        if (!res.ok) throw new Error('Upload failed: ' + res.status);
        return res.json();
      }).then(function(json){
        resolve(json); // expected { url, filename }
      }).catch(reject);
    });
  };

  window.NoteRTE = NoteRTE;
})(window);
