// src/components/messaging/MessageInput.jsx
import React, { useState, useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';

const MessageInput = ({ onSendMessage, isLoading = false }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;

    onSendMessage(message.trim());
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      <div className="flex items-end gap-2">
        {/* Bouton pièce jointe (à implémenter plus tard) */}
        <button
          type="button"
          className="p-2 text-gray-500 hover:text-gray-700 transition flex-shrink-0"
          title="Joindre un fichier (prochainement)"
          disabled
        >
          <Paperclip size={20} />
        </button>

        {/* Champ de texte */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder="Écrivez votre message... (Shift+Entrée pour nouvelle ligne)"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows="1"
          disabled={isLoading}
          maxLength={2000}
        />

        {/* Bouton envoyer */}
        <button
          type="submit"
          disabled={!message.trim() || isLoading}
          className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0"
          title="Envoyer (Entrée)"
        >
          <Send size={20} />
        </button>
      </div>

      {/* Compteur de caractères */}
      <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
        <span>Shift+Entrée pour nouvelle ligne, Entrée pour envoyer</span>
        <span>{message.length}/2000</span>
      </div>
    </form>
  );
};

export default MessageInput;