// src/components/comments/CommentList.jsx
import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import { createComment, getComments, updateComment, deleteComment } from '../../services/commentService';

const CommentList = ({ targetType, targetId }) => {
  const [comments, setComments] = useState([]);
  const [totalComments, setTotalComments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchComments();
  }, [targetType, targetId, page]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await getComments(targetType, targetId, page);
      setComments(data.comments);
      setTotalComments(data.totalComments);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (content) => {
    setIsSubmitting(true);
    try {
      const newComment = await createComment(targetType, targetId, content);
      setComments([newComment, ...comments]);
      setTotalComments(totalComments + 1);
    } catch (error) {
      alert('Erreur lors de la création du commentaire');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId, content) => {
    try {
      const updatedComment = await updateComment(commentId, content);
      setComments(comments.map(c => c._id === commentId ? updatedComment : c));
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments(comments.filter(c => c._id !== commentId));
      setTotalComments(totalComments - 1);
    } catch (error) {
      throw error;
    }
  };

  return (
    <div className="mt-12">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="text-blue-600" size={28} />
        <h3 className="text-2xl font-bold text-gray-800">
          Commentaires ({totalComments})
        </h3>
      </div>

      {/* Formulaire */}
      <div className="mb-6">
        <CommentForm onSubmit={handleSubmitComment} isSubmitting={isSubmitting} />
      </div>

      {/* Liste des commentaires */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Chargement des commentaires...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Aucun commentaire pour le moment</p>
          <p className="text-gray-400 text-sm mt-2">Soyez le premier à commenter !</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              onEdit={handleEditComment}
              onDelete={handleDeleteComment}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentList;