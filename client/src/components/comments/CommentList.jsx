import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import { createComment, getComments, updateComment, deleteComment } from '../../services/commentService';

const GOLD      = '#C8872A';
const GOLD_PALE = 'rgba(200,135,42,0.08)';
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const INK       = '#1A1612';
const INK_MID   = '#4A3F35';
const INK_SOFT  = '#8C7B6E';
const CREAM     = '#FAF8F5';

const LIST_CSS = `
  .cl-root { font-family: 'Jost', sans-serif; }

  /* ── En-tête section ── */
  .cl-header {
    display: flex; align-items: center;
    gap: clamp(10px, 2vw, 14px);
    margin-bottom: clamp(18px, 3.5vw, 28px);
    padding-bottom: clamp(14px, 2.5vw, 20px);
    border-bottom: 1px solid rgba(200,135,42,0.14);
  }
  .cl-header-icon {
    width: clamp(34px, 5vw, 40px); height: clamp(34px, 5vw, 40px);
    border-radius: 1px;
    background: ${GOLD_PALE};
    border: 1px solid rgba(200,135,42,0.22);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .cl-header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.2rem, 3vw, 1.5rem);
    font-weight: 600; color: ${INK}; line-height: 1;
  }
  .cl-header-count {
    display: inline-flex; align-items: center;
    padding: 3px 9px;
    background: ${GOLD_PALE};
    border: 1px solid rgba(200,135,42,0.22);
    border-radius: 1px;
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.60rem, 1.3vw, 0.66rem);
    font-weight: 600; letter-spacing: 0.14em;
    color: ${GOLD}; margin-left: 10px;
  }

  /* ── Erreur submit ── */
  .cl-submit-error {
    font-size: clamp(0.68rem, 1.5vw, 0.72rem);
    color: #DC2626;
    margin-top: 8px; padding: 0 2px;
    overflow: hidden;
  }

  /* ── Skeleton ── */
  .cl-skeleton {
    display: flex; gap: clamp(10px, 2.5vw, 14px);
    padding: clamp(14px, 3vw, 20px);
    background: #FDFCFA;
    border: 1px solid rgba(200,135,42,0.10);
    border-radius: 2px;
    animation: cl-pulse 1.6s ease-in-out infinite;
  }
  @keyframes cl-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
  .cl-skeleton-avatar {
    width: clamp(34px, 5vw, 40px); height: clamp(34px, 5vw, 40px);
    border-radius: 50%; background: rgba(200,135,42,0.1); flex-shrink: 0;
  }
  .cl-skeleton-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .cl-skeleton-line {
    background: rgba(200,135,42,0.08); border-radius: 1px; height: 11px;
  }

  /* ── État vide ── */
  .cl-empty {
    text-align: center;
    padding: clamp(32px, 7vw, 56px) clamp(20px, 4vw, 40px);
    border: 1px dashed rgba(200,135,42,0.22);
    border-radius: 2px;
    background: ${GOLD_PALE};
  }
  .cl-empty-icon {
    width: clamp(40px, 6vw, 48px); height: clamp(40px, 6vw, 48px);
    border-radius: 1px;
    background: ${INK};
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto clamp(12px, 2vw, 16px);
  }
  .cl-empty-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.1rem, 3vw, 1.3rem);
    font-weight: 500; color: ${INK}; margin-bottom: 6px;
  }
  .cl-empty-sub {
    font-size: clamp(0.74rem, 1.8vw, 0.80rem);
    color: ${INK_SOFT}; line-height: 1.55;
  }

  /* ── Liste ── */
  .cl-list { display: flex; flex-direction: column; gap: clamp(8px, 1.5vw, 10px); }

  /* ── Pagination ── */
  .cl-pagination {
    display: flex; align-items: center; justify-content: center;
    gap: clamp(6px, 1.5vw, 10px);
    margin-top: clamp(16px, 3vw, 24px);
    padding-top: clamp(14px, 2.5vw, 20px);
    border-top: 1px solid rgba(200,135,42,0.12);
  }
  .cl-page-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: clamp(28px, 4vw, 34px); height: clamp(28px, 4vw, 34px);
    padding: 0 clamp(8px, 1.5vw, 12px);
    border: 1px solid rgba(200,135,42,0.2);
    border-radius: 1px;
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.60rem, 1.2vw, 0.66rem);
    font-weight: 600; letter-spacing: 0.1em;
    color: ${INK_SOFT}; background: #FDFCFA; cursor: pointer;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
  }
  .cl-page-btn:hover:not(:disabled) {
    border-color: rgba(200,135,42,0.45); color: ${GOLD}; background: ${GOLD_PALE};
  }
  .cl-page-btn--active {
    background: ${INK}; color: ${GOLD};
    border-color: transparent;
  }
  .cl-page-btn--active:hover { background: #2D2520; }
  .cl-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .cl-page-info {
    font-size: clamp(0.60rem, 1.2vw, 0.64rem);
    letter-spacing: 0.1em; color: ${INK_SOFT};
  }
`;

let _clStylesInjected = false;
const injectClStyles = () => {
  if (_clStylesInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = LIST_CSS;
  document.head.appendChild(s);
  _clStylesInjected = true;
};

/* ── Skeleton ── */
const CommentSkeleton = () => (
  <div className="cl-skeleton">
    <div className="cl-skeleton-avatar" />
    <div className="cl-skeleton-body">
      <div className="cl-skeleton-line" style={{ width:'28%' }} />
      <div className="cl-skeleton-line" style={{ width:'14%', height:8 }} />
      <div className="cl-skeleton-line" style={{ width:'100%', marginTop:4 }} />
      <div className="cl-skeleton-line" style={{ width:'78%' }} />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════ */
const CommentList = ({ targetType, targetId }) => {
  injectClStyles();
  const [comments,      setComments]      = useState([]);
  const [totalComments, setTotalComments] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const [page,          setPage]          = useState(1);
  const PER_PAGE = 10;

  useEffect(() => { fetchComments(); }, [targetType, targetId, page]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await getComments(targetType, targetId, page);
      setComments(data.comments ?? []);
      setTotalComments(data.totalComments ?? 0);
    } catch { /* état vide naturel */ }
    finally { setLoading(false); }
  };

  const handleSubmitComment = async (content) => {
    setIsSubmitting(true); setSubmitError('');
    try {
      const newComment = await createComment(targetType, targetId, content);
      setComments(prev => [newComment, ...prev]);
      setTotalComments(prev => prev + 1);
    } catch { setSubmitError('Erreur lors de la publication. Veuillez réessayer.'); }
    finally { setIsSubmitting(false); }
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

  const totalPages = Math.ceil(totalComments / PER_PAGE);

  return (
    <div className="cl-root">

      {/* ── En-tête ── */}
      <div className="cl-header">
        <div className="cl-header-icon">
          <MessageSquare size={15} color={GOLD} />
        </div>
        <div>
          <span className="cl-header-title">
            Commentaires
          </span>
          <span className="cl-header-count">
            {totalComments}
          </span>
        </div>
      </div>

      {/* ── Formulaire ── */}
      <div style={{ marginBottom: 'clamp(18px, 3.5vw, 26px)' }}>
        <CommentForm onSubmit={handleSubmitComment} isSubmitting={isSubmitting} />
        <AnimatePresence>
          {submitError && (
            <motion.p
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
              exit={{ opacity:0, height:0 }}
              className="cl-submit-error">
              ⚠ {submitError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── Séparateur ── */}
      <div style={{
        height: '1px', marginBottom: 'clamp(14px, 2.5vw, 20px)',
        background: 'linear-gradient(to right, rgba(200,135,42,0.3), transparent)',
      }} />

      {/* ── Liste ── */}
      {loading ? (
        <div className="cl-list">
          {[1, 2, 3].map(i => <CommentSkeleton key={i} />)}
        </div>
      ) : comments.length === 0 ? (
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="cl-empty">
          <div className="cl-empty-icon">
            <MessageSquare size={18} color={`rgba(200,135,42,0.7)`} />
          </div>
          <p className="cl-empty-title">Aucun commentaire pour le moment</p>
          <p className="cl-empty-sub">
            Partagez votre avis sur ce bien immobilier.
          </p>
        </motion.div>
      ) : (
        <>
          <motion.div className="cl-list"
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
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

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="cl-pagination">
              <button
                className="cl-page-btn"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}>
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…'
                    ? <span key={`sep-${i}`} className="cl-page-info">…</span>
                    : <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`cl-page-btn${p === page ? ' cl-page-btn--active' : ''}`}>
                        {p}
                      </button>
                )}

              <button
                className="cl-page-btn"
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}>
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommentList;