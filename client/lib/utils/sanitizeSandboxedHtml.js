// HOTFIX-INBOX-SECURITY-2 — primitive de sanitization partagée par tout
// contenu destiné à être rendu dans une iframe sandboxée sans
// `allow-scripts`/`allow-same-origin` (SafeHtmlEmailViewer pour le corps
// d'email, SafeAttachmentPreview pour les pièces jointes HTML/SVG).
// Extraite depuis SafeHtmlEmailViewer.jsx pour éviter la duplication de la
// configuration DOMPurify entre les deux consommateurs — même config, même
// comportement, un seul endroit à maintenir.
import DOMPurify from 'dompurify';

export const SANDBOXED_HTML_SANITIZE_CONFIG = {
  ADD_TAGS: ['style'],
  FORCE_BODY: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'formaction'],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeForSandboxedIframe(rawHtml, extraConfig) {
  const hook = (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  };
  DOMPurify.addHook('afterSanitizeAttributes', hook);
  try {
    return DOMPurify.sanitize(rawHtml || '', extraConfig || SANDBOXED_HTML_SANITIZE_CONFIG);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', hook);
  }
}
