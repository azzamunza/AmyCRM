    async init() {
        console.log('Initializing Communications tab (init)...');

        // Local Quill assets paths (relative to site root)
        const cssPath = 'css/quill.css';
        const jsPath = 'js/quill.js';

        // Ensure RTE (loads local build or falls back)
        if (typeof this._ensureRTE === 'function') {
            await this._ensureRTE(cssPath, jsPath);
        } else {
            // If helper missing, attempt to show textarea fallback
            console.warn('_ensureRTE helper not found; using textarea fallback.');
            this.useRTE = false;
            const editorDiv = document.getElementById('commEditor');
            const ta = document.getElementById('commNoteArea');
            if (editorDiv) editorDiv.style.display = 'none';
            if (ta) ta.style.display = 'block';
        }

        // Require encryption to be ready before loading private data
        if (!window.EncryptionService || !EncryptionService.isReady()) {
            const cList = document.getElementById('contactList');
            if (cList) {
                cList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--danger);">
                        Encryption not initialized. Please refresh the page.
                    </div>
                `;
            }
            return;
        }

        // Load initial data and UI wiring
        await this.loadContacts();
        await this.loadUserSettings();
        this.displayContacts();
        this.updateTimeline();
        await this.loadIcons();

        // Wire fallback textarea events if Quill wasn't initialized
        if (!this.useRTE) {
            const ta = document.getElementById('commNoteArea');
            if (ta) {
                ta.style.display = 'block';
                ta.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.handleEnterSave?.();
                    }
                });
                ta.addEventListener('input', () => {
                    this.currentNote = ta.value;
                    this.updateTimeline();
                });
            }
        } else {
            // If Quill is present, ensure Enter triggers save (without breaking default)
            try {
                if (this.editor && this.editor.keyboard && typeof this.editor.keyboard.addBinding === 'function') {
                    this.editor.keyboard.addBinding({ key: 13 }, (range, context) => {
                        // Trigger save but allow newline behavior
                        this.handleEnterSave?.().catch(err => console.error('Enter save failed', err));
                        return true;
                    });
                }
            } catch (e) {
                console.warn('Failed to attach Enter binding to Quill keyboard', e);
            }
        }

        // Ensure toolbar buttons are in the correct initial state
        ['btnInsertTimestamp','btnInsertDate','btnUploadFile','btnInsertMenu','btnClearNote','btnNewNote'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = !this.selectedContact;
        });

        console.log('Communications tab initialized.');
    }
