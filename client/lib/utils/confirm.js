/**
 * Promise-based confirm dialog — replaces window.confirm().
 * Usage: import confirm from '@/lib/utils/confirm'
 *        if (!await confirm('Supprimer ce bien ?', { danger: true })) return;
 */

export default function confirm(message, { title = 'Confirmer', danger = false } = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,0.55); backdrop-filter:blur(2px);
      display:flex; align-items:center; justify-content:center; padding:16px;
    `;

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'cv-title');
    dialog.setAttribute('aria-describedby', 'cv-msg');
    dialog.style.cssText = `
      background:#fff; border-radius:14px; padding:24px;
      width:100%; max-width:400px;
      box-shadow:0 20px 60px rgba(0,0,0,0.25);
      font-family:system-ui,sans-serif;
    `;

    const btnColor = danger ? '#ef4444' : '#2563eb';
    const btnHover = danger ? '#dc2626' : '#1d4ed8';
    const btnLabel = danger ? 'Supprimer' : 'Confirmer';

    dialog.innerHTML = `
      <h3 id="cv-title" style="font-size:16px;font-weight:700;color:#111827;margin:0 0 8px">${title}</h3>
      <p  id="cv-msg"   style="font-size:14px;color:#6b7280;margin:0 0 20px;line-height:1.55">${message}</p>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button id="cv-cancel"
          style="padding:8px 18px;border-radius:8px;border:none;background:#f1f5f9;color:#374151;font-size:14px;font-weight:500;cursor:pointer;transition:background 0.15s"
          onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
          Annuler
        </button>
        <button id="cv-confirm"
          style="padding:8px 18px;border-radius:8px;border:none;background:${btnColor};color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s"
          onmouseover="this.style.background='${btnHover}'" onmouseout="this.style.background='${btnColor}'">
          ${btnLabel}
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cleanup = (result) => { overlay.remove(); resolve(result); };

    dialog.querySelector('#cv-confirm').addEventListener('click', () => cleanup(true));
    dialog.querySelector('#cv-cancel').addEventListener('click',  () => cleanup(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });

    const onKey = (e) => {
      if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    dialog.querySelector('#cv-confirm').focus();
  });
}
