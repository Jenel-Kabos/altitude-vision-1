"use client";

// HOTFIX-INBOX-SECURITY-2 — aperçu isolé pour les pièces jointes HTML/SVG
// (contenu actif). Réutilise exactement le modèle de sécurité de
// SafeHtmlEmailViewer (DOMPurify + iframe `srcDoc` sandboxée, sans
// `allow-scripts` ni `allow-same-origin`) via la primitive partagée
// `sanitizeForSandboxedIframe` — jamais un `window.open` sur le Blob brut,
// jamais un `dangerouslySetInnerHTML` contre le DOM du dashboard.
import { useEffect, useRef } from 'react';
import { Download, X } from 'lucide-react';
import { sanitizeForSandboxedIframe } from '../../utils/sanitizeSandboxedHtml';

// Pour SVG, le profil DOMPurify dédié autorise les balises SVG mais
// `foreignObject` reste explicitement interdit (mandat §10/§18 : un
// `<foreignObject>` peut embarquer du HTML arbitraire) — sécurité avant
// fidélité de rendu (mandat §19).
const SVG_SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'foreignObject'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'formaction'],
  ALLOW_DATA_ATTR: false,
};

const PREVIEW_STYLE = `
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'DM Sans', sans-serif;
    font-size: 14px; line-height: 1.6; color: #1f2937;
    padding: 16px; box-sizing: border-box; overflow: auto; word-wrap: break-word;
  }
  img, svg { max-width: 100%; height: auto; }
`;

export default function SafeAttachmentPreview({
  filename, kind, content, loading, error, onClose, onDownload,
}) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const safeMarkup = typeof content === 'string'
    ? sanitizeForSandboxedIframe(content, kind === 'svg' ? SVG_SANITIZE_CONFIG : undefined)
    : '';

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${PREVIEW_STYLE}</style></head><body>${safeMarkup}</body></html>`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu sécurisé de ${filename}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="font-medium text-sm text-gray-700 truncate" title={filename}>{filename}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
              aria-label={`Télécharger l'aperçu de ${filename}`}
              title="Télécharger"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
              aria-label="Fermer l'aperçu"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {loading && (
            <p className="text-sm text-gray-500 p-4">Chargement de l&apos;aperçu sécurisé…</p>
          )}
          {!loading && error && (
            <p className="text-sm text-red-600 p-4">
              Aperçu indisponible pour ce fichier. Vous pouvez le télécharger.
            </p>
          )}
          {!loading && !error && (
            <iframe
              title={`Aperçu sécurisé de ${filename}`}
              srcDoc={srcDoc}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              data-testid="attachment-safe-frame"
              style={{
                width: '100%', height: '70vh', border: 'none', display: 'block',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
