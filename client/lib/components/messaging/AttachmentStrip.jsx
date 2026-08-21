"use client";

// INBOX-PRO-2 — extraction compacte du bloc pièces jointes qui vivait
// inline dans MessageDetail (InternalMessagingPage.jsx). Mêmes actions
// (voir/télécharger via `previewInternalMailAttachment`, endpoint
// authentifié/scopé côté serveur — INCHANGÉ, mandat §22), présentation en
// bande plutôt qu'en grands blocs.
import { Download, Eye, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { previewInternalMailAttachment } from '../../services/messageService';

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

export default function AttachmentStrip({ attachments }) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5" />
        Pièces jointes · {attachments.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att, index) => {
          const isImage = att.mimetype?.startsWith('image/');
          const Icon = isImage ? ImageIcon : FileText;
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
                    onClick={() => previewInternalMailAttachment(att.previewEndpoint)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="Voir"
                    aria-label={`Voir ${att.filename}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => previewInternalMailAttachment(att.downloadEndpoint)}
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
    </div>
  );
}
