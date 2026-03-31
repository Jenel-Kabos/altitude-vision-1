import React, { useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const GOLD      = '#C8872A';
const GOLD_PALE = 'rgba(200,135,42,0.08)';
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const INK       = '#1A1612';
const INK_MID   = '#4A3F35';
const INK_SOFT  = '#8C7B6E';
const CREAM     = '#FAF8F5';

const ITEM_CSS = `
  .ci-root {
    font-family: 'Jost', sans-serif;
    display: flex; gap: clamp(10px, 2.5vw, 14px);
    padding: clamp(14px, 3vw, 20px);
    background: #FDFCFA;
    border: 1px solid rgba(200,135,42,0.12);
    border-radius: 2px;
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative;
  }
  .ci-root:hover {
    border-color: rgba(200,135,42,0.28);
    box-shadow: 0 4px 18px rgba(200,135,42,0.06);
  }

  /* Accent latéral gauche au hover */
  .ci-root::before {
    content: '';
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom, transparent, ${GOLD}, transparent);
    opacity: 0; transition: opacity 0.3s;
    border-radius: 2px 0 0 2px;
  }
  .ci-root:hover::before { opacity: 1; }

  /* Avatar */
  .ci-avatar-img {
    width: clamp(34px, 5vw, 40px); height: clamp(34px, 5vw, 40px);
    border-radius: 50%; object-fit: cover; flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(200,135,42,0.2);
  }
  .ci-avatar-letter {
    width: clamp(34px, 5vw, 40px); height: clamp(34px, 5vw, 40px);
    border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(0.95rem, 2.5vw, 1.1rem); font-weight: 600; color: #fff;
    box-shadow: 0 0 0 2px rgba(46,123,181,0.22);
  }

  /* Corps */
  .ci-body { flex: 1; min-width: 0; }
  .ci-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 8px;
    margin-bottom: 2px;
  }
  .ci-author {
    font-size: clamp(0.80rem, 2vw, 0.86rem);
    font-weight: 600; color: ${INK}; line-height: 1.2;
  }
  .ci-deleted-tag {
    font-size: clamp(0.60rem, 1.2vw, 0.64rem);
    font-weight: 400; color: ${INK_SOFT};
    margin-left: 6px; font-style: italic;
  }
  .ci-meta {
    font-size: clamp(0.60rem, 1.2vw, 0.64rem);
    color: ${INK_SOFT}; letter-spacing: 0.04em; margin-top: 2px;
  }
  .ci-edited {
    font-style: italic; margin-left: 6px; opacity: 0.7;
  }

  /* Actions */
  .ci-actions { display: flex; gap: 2px; flex-shrink: 0; }
  .ci-btn-edit {
    width: clamp(26px, 4vw, 30px); height: clamp(26px, 4vw, 30px);
    border-radius: 1px; border: 1px solid transparent;
    background: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, border-color 0.2s; color: ${GOLD};
  }
  .ci-btn-edit:hover {
    background: ${GOLD_PALE};
    border-color: rgba(200,135,42,0.3);
  }
  .ci-btn-delete {
    width: clamp(26px, 4vw, 30px); height: clamp(26px, 4vw, 30px);
    border-radius: 1px; border: 1px solid transparent;
    background: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, border-color 0.2s; color: ${INK_SOFT};
  }
  .ci-btn-delete:hover {
    background: rgba(220,38,38,0.06);
    border-color: rgba(220,38,38,0.25);
    color: #DC2626;
  }
  .ci-btn-delete:disabled { opacity: 0.35; cursor: not-allowed; }

  /* Contenu texte */
  .ci-content {
    font-size: clamp(0.84rem, 2vw, 0.90rem);
    line-height: 1.72; color: ${INK_MID};
    white-space: pre-wrap; margin-top: clamp(6px, 1.2vw, 8px);
  }

  /* Mode édition */
  .ci-edit-wrap { margin-top: clamp(8px, 1.5vw, 12px); }
  .ci-edit-textarea {
    width: 100%;
    padding: clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px);
    border: 1px solid rgba(200,135,42,0.25);
    border-radius: 1px;
    background: ${CREAM};
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.82rem, 2vw, 0.88rem);
    color: ${INK}; line-height: 1.65; resize: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-sizing: border-box;
  }
  .ci-edit-textarea:focus {
    outline: none;
    border-color: rgba(200,135,42,0.5);
    box-shadow: 0 0 0 3px rgba(200,135,42,0.08);
    background: #fff;
  }
  .ci-edit-error {
    font-size: clamp(0.62rem, 1.3vw, 0.66rem);
    color: #DC2626; margin-top: 5px;
  }
  .ci-edit-actions {
    display: flex; gap: 8px; margin-top: clamp(6px, 1.2vw, 10px);
  }
  .ci-btn-save {
    display: inline-flex; align-items: center; gap: 5px;
    padding: clamp(5px, 1vw, 7px) clamp(12px, 2vw, 16px);
    background: ${INK}; color: ${GOLD};
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.60rem, 1.2vw, 0.66rem);
    font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
    border: 1px solid rgba(200,135,42,0.25); border-radius: 1px; cursor: pointer;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }
  .ci-btn-save:hover {
    background: #2D2520;
    border-color: rgba(200,135,42,0.5);
    color: #E8A84B;
  }
  .ci-btn-cancel {
    display: inline-flex; align-items: center; gap: 5px;
    padding: clamp(5px, 1vw, 7px) clamp(12px, 2vw, 16px);
    background: transparent; color: ${INK_SOFT};
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.60rem, 1.2vw, 0.66rem);
    font-weight: 500; letter-spacing: 0.10em; text-transform: uppercase;
    border: 1px solid rgba(26,22,18,0.14); border-radius: 1px; cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }
  .ci-btn-cancel:hover { border-color: rgba(26,22,18,0.3); color: ${INK}; }
`;

let _ciStylesInjected = false;
const injectCiStyles = () => {
  if (_ciStylesInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = ITEM_CSS;
  document.head.appendChild(s);
  _ciStylesInjected = true;
};

const CommentItem = ({ comment, onEdit, onDelete }) => {
  injectCiStyles();
  const { user } = useAuth();
  const [isEditing,   setIsEditing]   = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting,  setIsDeleting]  = useState(false);
  const [editError,   setEditError]   = useState('');

  const author        = comment.author ?? null;
  const authorId      = author?._id ?? null;
  const authorName    = author?.name ?? 'Utilisateur supprimé';
  const authorAvatar  = author?.avatar ?? null;
  const authorInitial = authorName[0]?.toUpperCase() ?? 'U';

  const isAuthor  = user && authorId && authorId === user.id;
  const isAdmin   = user?.role === 'Admin';
  const canEdit   = isAuthor;
  const canDelete = isAuthor || isAdmin;

  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr }); }
    catch { return ''; }
  })();

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) { setIsEditing(false); return; }
    setEditError('');
    try { await onEdit(comment._id, editContent); setIsEditing(false); }
    catch { setEditError('Erreur lors de la modification.'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    setIsDeleting(true);
    try { await onDelete(comment._id); }
    catch { setIsDeleting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22 }}
      className="ci-root">

      {/* Avatar */}
      {authorAvatar
        ? <img src={authorAvatar} alt={authorName} className="ci-avatar-img" />
        : <div className="ci-avatar-letter"
            style={{ background: author
              ? `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`
              : 'rgba(140,123,110,0.5)' }}>
            {authorInitial}
          </div>
      }

      {/* Corps */}
      <div className="ci-body">
        <div className="ci-header">
          <div>
            <span className="ci-author">
              {authorName}
              {!author && <span className="ci-deleted-tag">(compte supprimé)</span>}
            </span>
            <p className="ci-meta">
              {timeAgo}
              {comment.isEdited && <span className="ci-edited">· modifié</span>}
            </p>
          </div>

          {/* Boutons action */}
          {!isEditing && (canEdit || canDelete) && (
            <div className="ci-actions">
              {canEdit && (
                <button onClick={() => setIsEditing(true)} className="ci-btn-edit" title="Modifier" aria-label="Modifier">
                  <Edit2 size={12} />
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} disabled={isDeleting} className="ci-btn-delete" title="Supprimer" aria-label="Supprimer">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Contenu ou mode édition */}
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div key="edit"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="ci-edit-wrap">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={3}
                className="ci-edit-textarea"
              />
              {editError && <p className="ci-edit-error">⚠ {editError}</p>}
              <div className="ci-edit-actions">
                <button onClick={handleEdit} className="ci-btn-save">
                  <Check size={11} /> Enregistrer
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditContent(comment.content); setEditError(''); }}
                  className="ci-btn-cancel">
                  <X size={11} /> Annuler
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.p key="content"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="ci-content">
              {comment.content}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default CommentItem;