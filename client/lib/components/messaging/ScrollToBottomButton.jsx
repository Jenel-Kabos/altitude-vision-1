// src/components/messaging/ScrollToBottomButton.jsx
// Créez ce fichier dans votre dossier messaging
import React from 'react';
import { ChevronDown } from 'lucide-react';
import './ScrollToBottomButton.css';

/**
 * Bouton flottant pour revenir aux messages non lus
 * S'affiche uniquement quand l'utilisateur a scrollé vers le haut et qu'il y a de nouveaux messages
 */
const ScrollToBottomButton = ({ show, unreadCount, onClick }) => {
    if (!show) return null;

    return (
        <button
            className="scroll-to-bottom-btn"
            onClick={onClick}
            aria-label={`${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''} message${unreadCount > 1 ? 's' : ''}`}
        >
            <div className="scroll-btn-content">
                <ChevronDown size={20} />
                {unreadCount > 0 && (
                    <span className="unread-badge">{unreadCount}</span>
                )}
            </div>
            {unreadCount > 0 && (
                <span className="scroll-btn-text">
                    {unreadCount} nouveau{unreadCount > 1 ? 'x' : ''} message{unreadCount > 1 ? 's' : ''}
                </span>
            )}
        </button>
    );
};

export default ScrollToBottomButton;