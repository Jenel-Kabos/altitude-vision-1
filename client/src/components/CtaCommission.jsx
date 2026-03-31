import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// ─── Design tokens (cohérents avec la charte Altimmo) ──────────
const GOLD     = '#C8872A';
const INK      = '#1A1612';
const INK_SOFT = '#8C7B6E';
const CREAM    = '#FAF8F5';

/* ═══════════════════════════════════════════════════════════════
   CSS — animation-first, mobile-first
   Effets :
   · Grille de points dorés en mouvement (drift)
   · Halo radial pulsant (breathe)
   · Numéro "30%" décoratif flottant
   · Shimmer animé sur le bouton principal
   · Ligne d'accent dorée en tête de bloc
   · Animation d'entrée au scroll (fade + slide)
═══════════════════════════════════════════════════════════════ */
const CTA_CSS = `
  @keyframes cta-drift {
    0%   { transform: translateX(0) translateY(0); }
    100% { transform: translateX(32px) translateY(32px); }
  }
  @keyframes cta-breathe {
    0%,100% { opacity: 0.65; transform: scale(1); }
    50%      { opacity: 1;    transform: scale(1.1); }
  }
  @keyframes cta-float {
    0%,100% { transform: translateY(-50%) translateX(0); }
    50%      { transform: translateY(-52%) translateX(-5px); }
  }
  @keyframes cta-pulse-dot {
    0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 0 0 rgba(200,135,42,0.45); }
    50%     { opacity:.8; transform:scale(1.35); box-shadow:0 0 0 6px rgba(200,135,42,0); }
  }
  @keyframes cta-shimmer {
    0%       { left: -100%; }
    40%,100% { left: 160%;  }
  }
  @keyframes cta-enter {
    from { opacity:0; transform:translateY(18px); }
    to   { opacity:1; transform:translateY(0); }
  }

  /* ── Conteneur global ── */
  .cta-outer {
    font-family: 'Jost', sans-serif;
  }

  /* ── Bloc principal ── */
  .cta-wrap {
    position: relative;
    background: ${INK};
    border-radius: 2px;
    overflow: hidden;
    padding: clamp(28px, 5.5vw, 56px) clamp(20px, 5vw, 56px);
    display: grid;
    grid-template-columns: 1fr auto;
    gap: clamp(24px, 4vw, 56px);
    align-items: center;
    animation: cta-enter 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }
  @media (max-width: 680px) {
    .cta-wrap { grid-template-columns: 1fr; gap: 26px; }
  }

  /* ── Fond décoratif ── */
  .cta-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }

  .cta-dots {
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, rgba(200,135,42,0.16) 1px, transparent 1px);
    background-size: 30px 30px;
    animation: cta-drift 22s linear infinite;
  }
  .cta-diag {
    position: absolute; inset: 0;
    background: linear-gradient(130deg,
      transparent 0%, transparent 58%,
      rgba(200,135,42,0.04) 58%, rgba(200,135,42,0.04) 100%
    );
  }
  .cta-halo {
    position: absolute; top: -100px; right: -100px;
    width: 420px; height: 420px; border-radius: 50%;
    background: radial-gradient(circle, rgba(200,135,42,0.13) 0%, transparent 68%);
    animation: cta-breathe 4.5s ease-in-out infinite;
  }

  /* ── Ligne accent haut ── */
  .cta-accent-line {
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(to right, transparent, ${GOLD}, rgba(200,135,42,0.25), transparent);
  }

  /* ── Numéro décoratif ── */
  .cta-deco-num {
    position: absolute;
    right: clamp(12px, 3vw, 40px);
    top: 50%; transform: translateY(-50%);
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(72px, 13vw, 156px);
    font-weight: 700;
    color: rgba(200,135,42,0.055);
    line-height: 1; user-select: none; pointer-events: none;
    letter-spacing: -0.04em;
    animation: cta-float 6.5s ease-in-out infinite;
  }

  /* ── Contenu gauche ── */
  .cta-left { position: relative; z-index: 2; }

  .cta-eyebrow {
    display: inline-flex; align-items: center; gap: 10px;
    margin-bottom: clamp(10px, 2vw, 16px);
  }
  .cta-eyebrow-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: ${GOLD}; flex-shrink: 0;
    animation: cta-pulse-dot 2.2s ease-in-out infinite;
  }
  .cta-eyebrow-text {
    font-size: clamp(0.58rem, 1.2vw, 0.64rem);
    font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase;
    color: ${GOLD};
  }

  .cta-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.75rem, 4.5vw, 3rem);
    font-weight: 600; line-height: 1.08;
    color: #F5F2EE; letter-spacing: -0.01em;
    margin-bottom: clamp(8px, 1.8vw, 14px);
  }
  .cta-title em { font-style: italic; color: ${GOLD}; }

  .cta-rule {
    width: 34px; height: 1px;
    background: linear-gradient(to right, ${GOLD}, transparent);
    margin-bottom: clamp(10px, 2vw, 16px);
  }

  .cta-body {
    font-size: clamp(0.82rem, 1.8vw, 0.92rem);
    font-weight: 300; line-height: 1.75;
    color: rgba(245,242,238,0.52);
    max-width: 520px;
  }
  .cta-body strong {
    font-weight: 500;
    color: rgba(245,242,238,0.88);
  }

  /* ── Stats inline ── */
  .cta-stats {
    display: flex; gap: 18px; flex-wrap: wrap;
    align-items: center;
    margin-top: clamp(14px, 2.5vw, 22px);
  }
  .cta-stat { display: flex; flex-direction: column; gap: 2px; }
  .cta-stat-val {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(1.25rem, 2.8vw, 1.65rem);
    font-weight: 600; color: ${GOLD}; line-height: 1;
  }
  .cta-stat-lbl {
    font-size: clamp(0.56rem, 1.1vw, 0.60rem);
    font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(245,242,238,0.28);
  }
  .cta-stat-sep {
    width: 1px; height: 32px;
    background: rgba(200,135,42,0.2);
    align-self: center;
  }

  /* ── Colonne droite ── */
  .cta-right {
    position: relative; z-index: 2;
    display: flex; flex-direction: column;
    align-items: center; gap: 12px;
    flex-shrink: 0;
  }
  @media (max-width: 680px) {
    .cta-right { align-items: flex-start; }
  }

  /* Pill "programme actif" */
  .cta-guarantee {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px;
    border: 1px solid rgba(200,135,42,0.2);
    border-radius: 1px;
    background: rgba(200,135,42,0.05);
  }
  .cta-guarantee-dot {
    width: 5px; height: 5px; border-radius: 50%; background: #22C55E; flex-shrink: 0;
  }
  .cta-guarantee-text {
    font-size: clamp(0.56rem, 1.1vw, 0.60rem);
    font-weight: 400; letter-spacing: 0.10em;
    color: rgba(245,242,238,0.36); text-transform: uppercase; white-space: nowrap;
  }

  /* ── Bouton principal ── */
  .cta-btn-link {
    display: inline-flex; align-items: center; gap: 9px;
    padding: clamp(13px, 2.2vw, 17px) clamp(20px, 3.5vw, 30px);
    background: ${GOLD};
    color: ${INK};
    font-family: 'Jost', sans-serif;
    font-size: clamp(0.68rem, 1.4vw, 0.75rem);
    font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase;
    text-decoration: none; border-radius: 1px;
    position: relative; overflow: hidden; white-space: nowrap;
    transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s;
  }
  .cta-btn-link::before {
    content: ''; position: absolute; inset: 0;
    background: rgba(255,255,255,0); transition: background 0.22s;
  }
  .cta-btn-link:hover::before { background: rgba(255,255,255,0.12); }
  .cta-btn-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(200,135,42,0.5);
  }
  .cta-btn-link:active { transform: translateY(0); }
  /* Shimmer */
  .cta-btn-link::after {
    content: ''; position: absolute;
    top: 0; left: -100%; width: 55%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
    transform: skewX(-20deg);
    animation: cta-shimmer 3.8s ease-in-out infinite;
  }
  .cta-btn-icon { transition: transform 0.22s; flex-shrink: 0; }
  .cta-btn-link:hover .cta-btn-icon { transform: translateX(3px); }

  /* ── Lien secondaire ── */
  .cta-sub-link {
    font-size: clamp(0.58rem, 1.1vw, 0.62rem);
    font-weight: 400; letter-spacing: 0.10em;
    color: rgba(200,135,42,0.45);
    text-decoration: none; text-transform: uppercase;
    text-align: center; transition: color 0.2s;
  }
  .cta-sub-link:hover { color: ${GOLD}; }
`;

let _ctaStylesInjected = false;
const injectCtaStyles = () => {
  if (_ctaStylesInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = CTA_CSS;
  document.head.appendChild(s);
  _ctaStylesInjected = true;
};

const CtaCommission = () => {
  injectCtaStyles();

  return (
    <div className="cta-outer">
      <div className="cta-wrap">

        {/* ── Fond décoratif ── */}
        <div className="cta-bg">
          <div className="cta-dots" />
          <div className="cta-diag" />
          <div className="cta-halo" />
        </div>

        {/* Ligne accent */}
        <div className="cta-accent-line" />

        {/* Numéro déco flottant */}
        <div className="cta-deco-num" aria-hidden="true">30%</div>

        {/* ── Colonne gauche ── */}
        <div className="cta-left">

          <div className="cta-eyebrow">
            <div className="cta-eyebrow-dot" />
            <span className="cta-eyebrow-text">Programme partenaire · Altimmo</span>
          </div>

          <h2 className="cta-title">
            Devenez <em>Apporteur<br />d'Affaires</em>
          </h2>

          <div className="cta-rule" />

          <p className="cta-body">
            Vous connaissez quelqu'un qui veut vendre ou louer un bien ?
            Référez-le-nous et <strong>touchez 30% de notre commission</strong>
            sur chaque transaction conclue. Sans contrainte, sans engagement.
          </p>

          {/* Stats */}
          <div className="cta-stats">
            <div className="cta-stat">
              <span className="cta-stat-val">30%</span>
              <span className="cta-stat-lbl">De commission</span>
            </div>
            <div className="cta-stat-sep" />
            <div className="cta-stat">
              <span className="cta-stat-val">0 FCFA</span>
              <span className="cta-stat-lbl">Investissement</span>
            </div>
            <div className="cta-stat-sep" />
            <div className="cta-stat">
              <span className="cta-stat-val">24h</span>
              <span className="cta-stat-lbl">Validation</span>
            </div>
          </div>

        </div>

        {/* ── Colonne droite ── */}
        <div className="cta-right">

          <div className="cta-guarantee">
            <div className="cta-guarantee-dot" />
            <span className="cta-guarantee-text">Programme actif</span>
          </div>

          <Link to="/trouve-ta-commission" className="cta-btn-link">
            Estimer mes gains
            <ArrowRight size={13} className="cta-btn-icon" aria-hidden="true" />
          </Link>

          <Link to="/altimmo#contact" className="cta-sub-link">
            En savoir plus →
          </Link>

        </div>

      </div>
    </div>
  );
};

export default CtaCommission;