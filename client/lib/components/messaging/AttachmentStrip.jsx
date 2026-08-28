"use client";

// INBOX-PRO-2 — extraction compacte du bloc pièces jointes qui vivait
// inline dans MessageDetail (InternalMessagingPage.jsx). Endpoints
// authentifiés/scopés côté serveur — INCHANGÉ, mandat §22.
//
// HOTFIX-INBOX-SECURITY-2 — les pièces jointes HTML/SVG (contenu actif,
// voir attachmentSecurity.js) ne passent plus par `previewInternalMailAttachment`
// (window.open sur un Blob brut — une URL blob: hérite de l'origine du
// dashboard, ce n'est pas une origine opaque : du JS dans un tel document
// aurait accès à localStorage, donc au JWT). Elles sont sanitizées
// (DOMPurify) et rendues dans une iframe sandboxée isolée
// (SafeAttachmentPreview, même modèle de sécurité que SafeHtmlEmailViewer).
// Tous les autres types (image, PDF, etc.) conservent leur comportement
// historique exact, inchangé.
import { useState } from 'react';
import {
  Download, Eye, FileArchive, FileAudio, FileSpreadsheet, FileText, FileType, FileVideo,
  Image as ImageIcon, Paperclip,
} from 'lucide-react';
import {
  previewInternalMailAttachment,
  fetchInternalMailAttachmentContent,
  downloadInternalMailAttachment,
} from '../../services/messageService';
import { isActiveAttachmentContent, getActiveAttachmentKind } from '../../utils/attachmentSecurity';
import { getAttachmentCategory } from '../../utils/attachmentPresentation';
import SafeAttachmentPreview from './SafeAttachmentPreview';

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

// INBOX-2 — icône présentationnelle uniquement (voir attachmentPresentation.js).
const ICON_BY_CATEGORY = {
  IMAGE: ImageIcon,
  PDF: FileType,
  OFFICE_WORD: FileText,
  OFFICE_SHEET: FileSpreadsheet,
  OFFICE_SLIDE: FileType,
  ARCHIVE: FileArchive,
  AUDIO: FileAudio,
  VIDEO: FileVideo,
  TEXT: FileText,
  UNKNOWN: FileText,
};

export default function AttachmentStrip({ attachments }) {
  const [preview, setPreview] = useState(null);

  if (!attachments?.length) return null;

  const closePreview = () => setPreview(null);

  const openActivePreview = async (att) => {
    const kind = getActiveAttachmentKind(att);
    setPreview({
      filename: att.filename, kind, content: '', loading: true, error: false, downloadEndpoint: att.downloadEndpoint,
    });
    try {
      const text = await fetchInternalMailAttachmentContent(att.previewEndpoint);
      setPreview((prev) => (prev ? { ...prev, content: text, loading: false } : prev));
    } catch {
      setPreview((prev) => (prev ? { ...prev, loading: false, error: true } : prev));
    }
  };

  const handleVoir = (att) => {
    if (isActiveAttachmentContent(att)) {
      openActivePreview(att);
      return;
    }
    previewInternalMailAttachment(att.previewEndpoint);
  };

  const handleTelecharger = (att) => {
    if (isActiveAttachmentContent(att)) {
      downloadInternalMailAttachment(att.downloadEndpoint, att.filename);
      return;
    }
    previewInternalMailAttachment(att.downloadEndpoint);
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" />
        Pièces jointes · {attachments.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, index) => {
          const Icon = ICON_BY_CATEGORY[getAttachmentCategory(att)] || FileText;
          return (
            <div
              key={att.previewEndpoint || index}
              className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            >
              <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="font-medium text-gray-700 truncate max-w-[140px]" title={att.filename}>{att.filename}</span>
              <span className="text-gray-400 whitespace-nowrap">{formatFileSize(att.size)}</span>
              {att.canPreview && (
                <>
                  <button
                    type="button"
                    onClick={() => handleVoir(att)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="Voir"
                    aria-label={`Voir ${att.filename}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTelecharger(att)}
                    className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                    title="Télécharger"
                    aria-label={`Télécharger ${att.filename}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {preview && (
        <SafeAttachmentPreview
          filename={preview.filename}
          kind={preview.kind}
          content={preview.content}
          loading={preview.loading}
          error={preview.error}
          onClose={closePreview}
          onDownload={() => downloadInternalMailAttachment(preview.downloadEndpoint, preview.filename)}
        />
      )}
    </div>
  );
}
