// src/hooks/useSmartScroll.js
// Créez ce fichier dans votre projet
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer le scroll intelligent dans la messagerie
 * - Scroll automatique uniquement pour les nouveaux messages
 * - Affiche une flèche quand l'utilisateur scroll vers le haut
 * - Permet de revenir au dernier message non lu
 */
export const useSmartScroll = (messages, currentUserId) => {
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const previousMessagesLengthRef = useRef(0);
    const isUserScrollingRef = useRef(false);
    const lastScrollPositionRef = useRef(0);

    // Détecter si l'utilisateur a scrollé manuellement vers le haut
    const handleScroll = useCallback(() => {
        if (!containerRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

        lastScrollPositionRef.current = scrollTop;

        // Si l'utilisateur n'est pas en bas, marquer qu'il scroll manuellement
        if (!isAtBottom) {
            isUserScrollingRef.current = true;
            
            // Compter les messages non lus (envoyés par d'autres)
            const unreadMessages = messages.filter((msg, index) => {
                // Vérifier si le message est après la position visible actuelle
                const msgElement = containerRef.current?.children[index];
                if (!msgElement) return false;
                
                const msgTop = msgElement.offsetTop;
                const visibleBottom = scrollTop + clientHeight;
                
                return msgTop > visibleBottom && msg.sender?._id !== currentUserId;
            });
            
            setUnreadCount(unreadMessages.length);
            setShowScrollButton(true);
        } else {
            isUserScrollingRef.current = false;
            setShowScrollButton(false);
            setUnreadCount(0);
        }
    }, [messages, currentUserId]);

    // Scroll automatique uniquement pour les nouveaux messages
    useEffect(() => {
        const currentLength = messages.length;
        const previousLength = previousMessagesLengthRef.current;

        // Vérifier s'il y a un nouveau message
        if (currentLength > previousLength && currentLength > 0) {
            const newMessage = messages[currentLength - 1];
            const isMyMessage = newMessage.sender?._id === currentUserId;

            // Scroll automatique si :
            // 1. C'est mon propre message OU
            // 2. L'utilisateur est déjà en bas (n'a pas scrollé vers le haut)
            if (isMyMessage || !isUserScrollingRef.current) {
                scrollToBottom('smooth');
                setShowScrollButton(false);
                setUnreadCount(0);
            } else {
                // Nouveau message d'un autre utilisateur et je ne suis pas en bas
                setUnreadCount(prev => prev + 1);
                setShowScrollButton(true);
            }
        }

        previousMessagesLengthRef.current = currentLength;
    }, [messages, currentUserId]);

    // Fonction pour scroller en bas
    const scrollToBottom = useCallback((behavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
            isUserScrollingRef.current = false;
            setShowScrollButton(false);
            setUnreadCount(0);
        }
    }, []);

    // Scroll initial (au chargement)
    useEffect(() => {
        if (messages.length > 0 && previousMessagesLengthRef.current === 0) {
            setTimeout(() => scrollToBottom('auto'), 100);
        }
    }, [messages.length, scrollToBottom]);

    return {
        messagesEndRef,
        containerRef,
        showScrollButton,
        unreadCount,
        scrollToBottom,
        handleScroll
    };
};

export default useSmartScroll;