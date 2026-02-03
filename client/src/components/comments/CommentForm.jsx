// src/components/comments/CommentForm.jsx
import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const CommentForm = ({ onSubmit, isSubmitting = false }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Le commentaire ne peut pas être vide');
      return;
    }

    if (content.length < 3) {
      setError('Le commentaire doit contenir au moins 3 caractères');
      return;
    }

    if (content.length > 1000) {
      setError('Le commentaire ne peut pas dépasser 1000 caractères');
      return;
    }

    setError('');
    onSubmit(content);
    setContent('');
  };

  if (!user) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600 mb-4">
          Vous devez être connecté pour commenter
        </p>
        
        <a
          href="/login"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Se connecter
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
        
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Écrivez votre commentaire..."
            rows="3"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
          
          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}
          
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-gray-500">
              {content.length}/1000 caractères
            </span>
            
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Send size={18} />
              {isSubmitting ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default CommentForm;