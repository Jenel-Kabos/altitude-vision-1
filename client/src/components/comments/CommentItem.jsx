// src/components/comments/CommentItem.jsx
import React, { useState } from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const CommentItem = ({ comment, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = user && comment.author._id === user.id;
  const isAdmin = user && user.role === 'Admin';
  const canDelete = isAuthor || isAdmin;

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false);
      return;
    }

    try {
      await onEdit(comment._id, editContent);
      setIsEditing(false);
    } catch (error) {
      alert('Erreur lors de la modification du commentaire');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(comment._id);
    } catch (error) {
      alert('Erreur lors de la suppression du commentaire');
      setIsDeleting(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
    locale: fr
  });

  return (
    <div className="flex gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition">
      {/* Avatar */}
      {comment.author.avatar ? (
        <img
          src={comment.author.avatar}
          alt={comment.author.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
          {comment.author.name?.[0]?.toUpperCase() || 'U'}
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-800">{comment.author.name}</p>
            <p className="text-xs text-gray-500">
              {timeAgo}
              {comment.isEdited && ' (modifié)'}
            </p>
          </div>

          {/* Actions */}
          {!isEditing && (isAuthor || isAdmin) && (
            <div className="flex gap-2">
              {isAuthor && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-700 p-1"
                  title="Modifier"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mode édition */}
        {isEditing ? (
          <div className="mt-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows="3"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                <Check size={14} />
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                className="flex items-center gap-1 bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
              >
                <X size={14} />
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-gray-700 whitespace-pre-wrap">{comment.content}</p>
        )}
      </div>
    </div>
  );
};

export default CommentItem;