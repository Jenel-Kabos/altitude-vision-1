/**
 * Minimal toast utility — no React context needed, works in any client component.
 * Usage: import toast from '@/lib/utils/toast'
 *        toast.success('Bien enregistré')  /  toast.error('Erreur')  /  toast.info('...')
 */

const COLORS = {
  success: '#22c55e',
  error:   '#ef4444',
  info:    '#3b82f6',
  warning: '#f59e0b',
};

function showToast(message, type = 'info', duration = 4000) {
  if (typeof document === 'undefined') return;
  const container = getContainer();
  const color = COLORS[type] || COLORS.info;

  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText = `
    display:flex; align-items:center; gap:10px;
    background:#1a1d23; color:#f1f5f9;
    border-left:3px solid ${color};
    padding:12px 16px; border-radius:8px;
    font-family:system-ui,sans-serif; font-size:14px; line-height:1.4;
    box-shadow:0 4px 24px rgba(0,0,0,0.35);
    max-width:420px; word-break:break-word; white-space:pre-line;
    opacity:0; transform:translateX(16px);
    transition:opacity 0.22s,transform 0.22s;
    pointer-events:none;
  `;

  const dot = document.createElement('span');
  dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;`;
  el.appendChild(dot);
  el.appendChild(document.createTextNode(message));
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  });

  const hide = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(16px)';
    setTimeout(() => el.remove(), 260);
  };
  setTimeout(hide, duration);
}

function getContainer() {
  let c = document.getElementById('av-toast-root');
  if (!c) {
    c = document.createElement('div');
    c.id = 'av-toast-root';
    c.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:99999;
      display:flex; flex-direction:column; gap:8px; pointer-events:none;
    `;
    document.body.appendChild(c);
  }
  return c;
}

const toast = (msg, type, dur) => showToast(msg, type, dur);
toast.success = (msg) => showToast(msg, 'success');
toast.error   = (msg) => showToast(msg, 'error');
toast.info    = (msg) => showToast(msg, 'info');
toast.warning = (msg) => showToast(msg, 'warning');

export default toast;
