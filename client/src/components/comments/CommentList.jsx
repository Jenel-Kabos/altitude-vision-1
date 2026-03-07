import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import { createComment, getComments, updateComment, deleteComment } from '../../services/commentService';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';

// ── Skeleton commentaire ──────────────────────────────────────
const CommentSkeleton = () => (
    <div className="animate-pulse flex gap-3 p-5 bg-white rounded-2xl border border-gray-100">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded-full w-1/4" />
            <div className="h-2 bg-gray-100 rounded-full w-1/6" />
            <div className="h-3 bg-gray-100 rounded-full w-full mt-3" />
            <div className="h-3 bg-gray-100 rounded-full w-4/5" />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
const CommentList = ({ targetType, targetId }) => {
    const [comments,      setComments]      = useState([]);
    const [totalComments, setTotalComments] = useState(0);
    const [loading,       setLoading]       = useState(true);
    const [isSubmitting,  setIsSubmitting]  = useState(false);
    const [submitError,   setSubmitError]   = useState('');
    const [page,          setPage]          = useState(1);

    useEffect(() => { fetchComments(); }, [targetType, targetId, page]);

    const fetchComments = async () => {
        try {
            setLoading(true);
            const data = await getComments(targetType, targetId, page);
            setComments(data.comments ?? []);
            setTotalComments(data.totalComments ?? 0);
        } catch {
            // silencieux — l'état vide s'affiche naturellement
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitComment = async (content) => {
        setIsSubmitting(true);
        setSubmitError('');
        try {
            const newComment = await createComment(targetType, targetId, content);
            setComments(prev => [newComment, ...prev]);
            setTotalComments(prev => prev + 1);
        } catch {
            setSubmitError('Erreur lors de la publication. Veuillez réessayer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditComment = async (commentId, content) => {
        const updated = await updateComment(commentId, content);
        setComments(prev => prev.map(c => c._id === commentId ? updated : c));
    };

    const handleDeleteComment = async (commentId) => {
        await deleteComment(commentId);
        setComments(prev => prev.filter(c => c._id !== commentId));
        setTotalComments(prev => prev - 1);
    };

    return (
        <div className="mt-10" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* En-tête */}
            <div className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${BLUE}12` }}>
                    <MessageCircle className="w-4 h-4" style={{ color: BLUE }} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    Commentaires
                    <span className="ml-2 text-sm font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${BLUE}12`, color: BLUE }}>
                        {totalComments}
                    </span>
                </h3>
            </div>

            {/* Formulaire */}
            <div className="mb-6">
                <CommentForm onSubmit={handleSubmitComment} isSubmitting={isSubmitting} />
                <AnimatePresence>
                    {submitError && (
                        <motion.p
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs text-red-500 mt-2 px-1 overflow-hidden"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            {submitError}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            {/* Liste */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <CommentSkeleton key={i} />)}
                </div>
            ) : comments.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="text-center py-14 rounded-3xl border border-dashed"
                    style={{ borderColor: `${BLUE}20`, backgroundColor: `${BLUE}03` }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
                        <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <p className="font-semibold text-gray-700 mb-1"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Aucun commentaire pour le moment
                    </p>
                    <p className="text-xs text-gray-400"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Soyez le premier à commenter !
                    </p>
                </motion.div>
            ) : (
                <motion.div className="space-y-3"
                    initial="hidden" animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
                    <AnimatePresence>
                        {comments.map(comment => (
                            <CommentItem
                                key={comment._id}
                                comment={comment}
                                onEdit={handleEditComment}
                                onDelete={handleDeleteComment}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
};

export default CommentList;