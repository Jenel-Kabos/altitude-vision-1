import React, { useState } from 'react';
import { Edit2, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';

const CommentItem = ({ comment, onEdit, onDelete }) => {
    const { user }    = useAuth();
    const [isEditing,  setIsEditing]  = useState(false);
    const [editContent,setEditContent]= useState(comment.content);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editError,  setEditError]  = useState('');

    // ✅ FIX : author peut être null (commentaire d'un user supprimé)
    const author   = comment.author ?? null;
    const authorId = author?._id   ?? null;
    const authorName   = author?.name   ?? 'Utilisateur supprimé';
    const authorAvatar = author?.avatar ?? null;
    const authorInitial= authorName[0]?.toUpperCase() ?? 'U';

    const isAuthor = user && authorId && authorId === user.id;
    const isAdmin  = user && user.role === 'Admin';
    const canEdit  = isAuthor;
    const canDelete= isAuthor || isAdmin;

    const timeAgo = (() => {
        try {
            return formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr });
        } catch {
            return '';
        }
    })();

    const handleEdit = async () => {
        if (!editContent.trim() || editContent === comment.content) {
            setIsEditing(false);
            return;
        }
        setEditError('');
        try {
            await onEdit(comment._id, editContent);
            setIsEditing(false);
        } catch {
            setEditError('Erreur lors de la modification.');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Supprimer ce commentaire ?')) return;
        setIsDeleting(true);
        try {
            await onDelete(comment._id);
        } catch {
            setIsDeleting(false);
        }
    };

    const focusIn  = e => { e.target.style.borderColor = BLUE; e.target.style.boxShadow = `0 0 0 3px ${BLUE}15`; };
    const focusOut = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex gap-3 p-5 bg-white rounded-2xl border border-gray-100 hover:shadow-sm transition-all duration-200"
            style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* Avatar */}
            {authorAvatar ? (
                <img src={authorAvatar} alt={authorName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm" />
            ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm"
                    style={{ background: author ? `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` : '#9CA3AF' }}>
                    {authorInitial}
                </div>
            )}

            {/* Contenu */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="font-semibold text-gray-900 text-sm leading-tight">
                            {authorName}
                            {!author && (
                                <span className="ml-2 text-xs font-normal text-gray-400">(compte supprimé)</span>
                            )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {timeAgo}
                            {comment.isEdited && (
                                <span className="ml-1.5 italic">· modifié</span>
                            )}
                        </p>
                    </div>

                    {/* Boutons action */}
                    {!isEditing && (canEdit || canDelete) && (
                        <div className="flex gap-1 flex-shrink-0">
                            {canEdit && (
                                <button onClick={() => setIsEditing(true)}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                                    title="Modifier" style={{ color: BLUE }}>
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {canDelete && (
                                <button onClick={handleDelete} disabled={isDeleting}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-40"
                                    title="Supprimer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Mode édition */}
                <AnimatePresence mode="wait">
                    {isEditing ? (
                        <motion.div key="edit"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="mt-3">
                            <textarea value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:outline-none focus:bg-white resize-none transition-all"
                                style={{ fontFamily: "'Outfit', sans-serif" }}
                                onFocus={focusIn} onBlur={focusOut} />
                            {editError && (
                                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />{editError}
                                </p>
                            )}
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleEdit}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold text-white text-xs transition-all hover:opacity-90"
                                    style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`, fontFamily: "'Outfit', sans-serif" }}>
                                    <Check className="w-3.5 h-3.5" />
                                    Enregistrer
                                </button>
                                <button onClick={() => { setIsEditing(false); setEditContent(comment.content); setEditError(''); }}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold text-gray-600 text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                    <X className="w-3.5 h-3.5" />
                                    Annuler
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.p key="content"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {comment.content}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default CommentItem;