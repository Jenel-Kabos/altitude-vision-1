"use client";

import React, { useState } from 'react';
import { Send, Lock } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '../../context/AuthContext';

// ─── Design tokens (cohérents avec PropertyDetailPage) ─────────
const GOLD      = '#C8872A';
const GOLD_PALE = 'rgba(200,135,42,0.08)';
const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const INK       = '#1A1612';
const INK_MID   = '#4A3F35';
const INK_SOFT  = '#8C7B6E';
const CREAM     = '#FAF8F5';

const FORM_CSS = `
  .cf-root {
    font-family: 'Jost', sans-serif;
  }

  /* ── Zone non connecté ── */
  .cf-guest {
    display: flex; align-items: center; gap: clamp(14px, 3vw, 20px);
    padding: clamp(16px, 3vw, 24px);
    background: ${CREAM};
    border: 1px solid rgba(200,135,42,0.18);
    border-radius: 2px;
  }
  .cf-guest-icon {
    width: clamp(36px, 5vw, 42px); height: clamp(36px, 5vw, 42px);
    border-radius: 1px;
    background: ${GOLD_PALE};
    border: 1px solid rgba(200,135,42,0.22);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .cf-guest-text {
    font-size: clamp(0.78rem, 2vw, 0.84rem);
    color: ${INK_SOFT}; line-height: 1.55;
  }
  .cf-guest-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: clamp(7px, 1.5vw, 9px) clamp(14px, 2.5vw, 20px);
    background: ${INK};
    color: #fff;
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.62rem, 1.4vw, 0.68rem);
    font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
    text-decoration: none; border-radius: 1px;
    transition: background 0.2s;
    white-space: nowrap; flex-shrink: 0;
  }
  .cf-guest-link:hover { background: #2D2520; }

  /* ── Formulaire connecté ── */
  .cf-form {
    background: #FDFCFA;
    border: 1px solid rgba(200,135,42,0.16);
    border-radius: 2px;
    padding: clamp(16px, 3.5vw, 24px);
  }
  .cf-inner {
    display: flex; align-items: flex-start;
    gap: clamp(10px, 2.5vw, 16px);
  }

  /* Avatar */
  .cf-avatar {
    width: clamp(34px, 5vw, 40px); height: clamp(34px, 5vw, 40px);
    border-radius: 50%; overflow: hidden; position: relative;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(200,135,42,0.22);
  }
  .cf-avatar-letter {
    width: clamp(34px, 5vw, 40px); height: clamp(34px, 5vw, 40px);
    border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1rem, 2.5vw, 1.2rem); font-weight: 600; color: #fff;
    background: linear-gradient(135deg, ${BLUE_DARK}, ${BLUE});
    box-shadow: 0 0 0 2px rgba(46,123,181,0.2);
  }

  /* Textarea */
  .cf-textarea-wrap { flex: 1; min-width: 0; }
  .cf-textarea {
    width: 100%;
    padding: clamp(10px, 2vw, 14px) clamp(12px, 2.5vw, 16px);
    border: 1px solid rgba(200,135,42,0.2);
    border-radius: 1px;
    background: ${CREAM};
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.84rem, 2vw, 0.90rem);
    color: ${INK}; line-height: 1.65;
    resize: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-sizing: border-box;
  }
  .cf-textarea::placeholder { color: ${INK_SOFT}; opacity: 0.7; }
  .cf-textarea:focus {
    outline: none;
    border-color: rgba(200,135,42,0.5);
    box-shadow: 0 0 0 3px rgba(200,135,42,0.08);
    background: #fff;
  }
  .cf-textarea:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Footer du formulaire */
  .cf-footer {
    display: flex; align-items: center;
    justify-content: space-between; flex-wrap: wrap;
    gap: 8px; margin-top: clamp(8px, 1.5vw, 12px);
  }
  .cf-counter {
    font-size: clamp(0.60rem, 1.2vw, 0.64rem);
    font-weight: 500; letter-spacing: 0.08em;
    color: ${INK_SOFT};
  }
  .cf-counter--warn { color: #C8872A; }
  .cf-counter--over { color: #DC2626; }

  /* Erreur */
  .cf-error {
    font-size: clamp(0.66rem, 1.4vw, 0.70rem);
    color: #DC2626; margin-top: 6px;
    display: flex; align-items: center; gap: 4px;
  }

  /* Bouton submit */
  .cf-submit {
    display: inline-flex; align-items: center; gap: 7px;
    padding: clamp(8px, 1.5vw, 10px) clamp(16px, 3vw, 22px);
    background: ${INK};
    color: rgba(200,135,42,0.9);
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.64rem, 1.4vw, 0.70rem);
    font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
    border: 1px solid rgba(200,135,42,0.25);
    border-radius: 1px; cursor: pointer;
    transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
    white-space: nowrap;
  }
  .cf-submit:hover:not(:disabled) {
    background: #2D2520;
    border-color: rgba(200,135,42,0.5);
    color: ${GOLD};
    transform: translateY(-1px);
  }
  .cf-submit:disabled {
    opacity: 0.4; cursor: not-allowed;
  }

  /* Filet déco */
  .cf-rule {
    height: 1px; width: 32px;
    background: linear-gradient(90deg, ${GOLD}, transparent);
    margin-bottom: 10px;
  }
`;

let _cfStylesInjected = false;
const injectCfStyles = () => {
  if (_cfStylesInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = FORM_CSS;
  document.head.appendChild(s);
  _cfStylesInjected = true;
};

const CommentForm = ({ onSubmit, isSubmitting = false }) => {
  injectCfStyles();
  const { user } = useAuth();
  const [content,  setContent]  = useState('');
  const [error,    setError]    = useState('');

  const MAX = 1000;
  const pct = content.length / MAX;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) { setError('Le commentaire ne peut pas être vide.'); return; }
    if (content.length < 3) { setError('Minimum 3 caractères requis.'); return; }
    if (content.length > MAX) { setError(`Maximum ${MAX} caractères.`); return; }
    setError('');
    onSubmit(content);
    setContent('');
  };

  /* ── Non connecté ── */
  if (!user) {
    return (
      <div className="cf-root">
        <div className="cf-guest">
          <div className="cf-guest-icon">
            <Lock size={15} color={GOLD} />
          </div>
          <p className="cf-guest-text">
            Connectez-vous pour laisser un commentaire sur ce bien.
          </p>
          <a href="/login" className="cf-guest-link">
            Se connecter
          </a>
        </div>
      </div>
    );
  }

  const counterClass = pct >= 1
    ? 'cf-counter cf-counter--over'
    : pct >= 0.85
    ? 'cf-counter cf-counter--warn'
    : 'cf-counter';

  return (
    <div className="cf-root">
      <form onSubmit={handleSubmit} className="cf-form">
        <div className="cf-rule" />
        <div className="cf-inner">
          {/* Avatar */}
          {user.avatar
            ? <span className="cf-avatar"><Image src={user.avatar} alt={user.name} fill unoptimized className="object-cover" /></span>
            : <div className="cf-avatar-letter">{user.name?.[0]?.toUpperCase() || 'U'}</div>
          }

          {/* Champ + footer */}
          <div className="cf-textarea-wrap">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Partagez votre avis sur ce bien…"
              rows={3}
              className="cf-textarea"
              disabled={isSubmitting}
            />

            {error && <p className="cf-error">⚠ {error}</p>}

            <div className="cf-footer">
              <span className={counterClass}>
                {content.length} / {MAX}
              </span>
              <button
                type="submit"
                className="cf-submit"
                disabled={isSubmitting || !content.trim() || content.length > MAX}>
                <Send size={12} aria-hidden="true" />
                {isSubmitting ? 'Envoi…' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CommentForm;