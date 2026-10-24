// Small native replacements for toast notifications and text prompts.
// Shared with the map editor (td-editor), which loads this file directly.

// Show a short notification. kind: 'ok' | 'error' | 'info'
function toast(text, kind = 'info') {
    let holder = document.getElementById('toasts');
    if (!holder) {
        holder = document.createElement('div');
        holder.id = 'toasts';
        holder.setAttribute('role', 'status');
        holder.setAttribute('aria-live', 'polite');
        document.body.append(holder);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    holder.append(el);
    setTimeout(() => el.remove(), 3000);
}

// Modal dialog with a textarea. Resolves to the entered text, or null if cancelled.
// With readOnly, shows the value with a Copy button instead.
function textDialog({ title, value = '', placeholder = '', confirmLabel = 'OK', readOnly = false }) {
    return new Promise((resolve) => {
        const dlg = document.createElement('dialog');
        dlg.className = 'td-dialog';
        dlg.innerHTML = `
            <form method="dialog">
                <h2></h2>
                <textarea rows="6" spellcheck="false"></textarea>
                <div class="dialog-buttons">
                    <button value="cancel" type="submit" class="dialog-cancel">${readOnly ? 'Close' : 'Cancel'}</button>
                    <button value="ok" type="submit" class="dialog-ok"></button>
                </div>
            </form>`;
        dlg.querySelector('h2').textContent = title;
        const area = dlg.querySelector('textarea');
        area.value = value;
        area.placeholder = placeholder;
        area.readOnly = readOnly;
        const ok = dlg.querySelector('.dialog-ok');
        ok.textContent = readOnly ? 'Copy' : confirmLabel;
        ok.addEventListener('click', (e) => {
            if (readOnly) {
                e.preventDefault();
                copyText(area.value, area);
                return;
            }
            if (!area.value.trim()) {
                e.preventDefault();
                area.focus();
            }
        });
        dlg.addEventListener('close', () => {
            resolve(dlg.returnValue === 'ok' && !readOnly ? area.value.trim() : null);
            dlg.remove();
        });
        document.body.append(dlg);
        dlg.showModal();
        if (readOnly) area.select();
        else area.focus();
    });
}

// Copy text, falling back to leaving it selected for a manual copy.
function copyText(str, area) {
    const done = () => toast('Copied to clipboard', 'ok');
    const fallback = () => {
        area.select();
        toast('Select all and copy the text', 'info');
    };
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(str).then(done, fallback);
    } else {
        fallback();
    }
}
