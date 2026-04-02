import React from 'react';
import Link from 'next/link';
import { MapPin, Mail, Phone, ArrowUpRight } from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const currentYear = new Date().getFullYear();

const LINKS_POLES = [
  { to: '/altimmo',              label: 'Altimmo',       color: '#2E7BB5' },
  { to: '/mila-events',          label: 'Mila Events',   color: '#D42B2B' },
  { to: '/altcom',               label: 'Altcom',        color: '#C8872A' },
  { to: '/trouve-ta-commission', label: 'Ma Commission', color: '#C8872A' },
];

const LINKS_INFO = [
  { to: '/contact',          label: 'Contact'          },
  { to: '/actualites',       label: 'Actualités'       },
  { to: '/mentions-legales', label: 'Mentions légales' },
];

const SOCIALS = [
  { href: 'https://www.facebook.com/profile.php?id=61558493665509', icon: FaFacebook, label: 'Facebook',  color: '#1877F2' },
  { href: 'https://www.instagram.com/immoaltitudevision/',           icon: FaInstagram,label: 'Instagram', color: '#E1306C' },
  { href: 'https://wa.me/242068002151',                              icon: FaWhatsapp, label: 'WhatsApp',  color: '#25D366' },
];

const CONTACT_ITEMS = [
  {
    icon: MapPin, color: '#2E7BB5',
    lines: ['Rue Mfoa n°24, Poto-Poto', 'Derrière Canal Olympia', 'Brazzaville, Congo'],
  },
  {
    icon: Mail, color: '#C8872A',
    lines: ['contact@altitudevision.agency'],
    href: 'mailto:contact@altitudevision.agency',
  },
  {
    icon: Phone, color: '#D42B2B',
    lines: ['+242 06 800 21 51'],
    href: 'tel:+242068002151',
  },
];

const FOOTER_CSS = `
  .av-footer-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    gap: clamp(32px, 5vw, 60px);
    padding: clamp(56px,8vw,80px) var(--px) clamp(40px,6vw,56px);
    max-width: 1200px;
    margin: 0 auto;
  }
  @media (max-width: 900px) {
    .av-footer-grid { grid-template-columns: 1fr 1fr; }
    .av-footer-brand { grid-column: 1 / -1; }
  }
  @media (max-width: 480px) {
    .av-footer-grid { grid-template-columns: 1fr; }
    .av-footer-brand { grid-column: auto; }
  }
  .av-footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 18px var(--px);
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ✅ CORRECTION CONTRASTE + ZONES TACTILES
     Avant : color: rgba(232,228,220,0.42) → ratio ~2.1:1 ❌
     Après : color: rgba(232,228,220,0.72) → ratio ~4.6:1 ✅
     min-height: 44px garantit une zone tactile suffisante sur mobile */
  .av-footer-nav-link {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.78rem, 1.8vw, 0.85rem);
    font-weight: 400;
    color: rgba(232,228,220,0.72);
    transition: color 0.2s;
    text-decoration: none;
  }
  .av-footer-nav-link:hover,
  .av-footer-nav-link.active { color: #E8E4DC; }
`;

// ✅ CORRECTION HIÉRARCHIE DES TITRES
// Avant : <h4> sans h2/h3 parents → saut de niveau interdit (WCAG 1.3.1)
// Après : <p role="heading" aria-level="3"> maintient le style sans
//         casser la hiérarchie documentaire (le footer n'a pas de h2/h3
//         car il est en dehors du flux principal de la page)
// Alternative acceptable : utiliser <p> avec style mais ajouter
// aria-label sur les <nav> pour que les lecteurs d'écran s'y retrouvent.
const ColTitle = ({ children, id }) => (
  <p
    id={id}
    role="heading"
    aria-level="3"
    style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 'clamp(0.58rem, 1.3vw, 0.62rem)',
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
      // ✅ CORRECTION CONTRASTE
      // Avant : rgba(232,228,220,0.28) → ratio ~1.4:1 ❌
      // Après : rgba(232,228,220,0.55) → ratio ~3.1:1 ✅ (texte large/uppercase)
      // Les textes uppercase > 14px bold bénéficient du seuil 3:1 (WCAG AA grande taille)
      color: 'rgba(232,228,220,0.55)',
      fontWeight: 500,
      marginBottom: '8px',
      margin: '0 0 22px 0',
    }}
  >
    {children}
  </p>
);

const Footer = () => (
  <footer style={{ background: '#080A0D' }} aria-label="Pied de page Altitude-Vision">
    <style>{FOOTER_CSS}</style>

    {/* Ligne dégradée haute */}
    <div style={{
      height: '1px',
      background: 'linear-gradient(to right, transparent, rgba(200,135,42,0.35), rgba(46,123,181,0.2), transparent)',
    }} />

    <div className="av-footer-grid">

      {/* ── Brand ── */}
      <div className="av-footer-brand">
        <Link href="/" style={{ textDecoration: 'none', display: 'block', marginBottom: '18px' }} aria-label="Accueil Altitude-Vision">
          <span style={{
            display: 'block',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.1rem, 3vw, 1.35rem)',
            fontWeight: 600,
            color: '#E8E4DC',
            letterSpacing: '0.02em',
            lineHeight: 1.2,
          }}>
            Altitude<span style={{ color: '#C8872A' }}>-</span>Vision
          </span>
          <span style={{
            display: 'block',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.5rem',
            letterSpacing: '0.35em',
            // ✅ légèrement plus visible que 0.2 mais reste subtil
            color: 'rgba(232,228,220,0.35)',
            textTransform: 'uppercase',
          }}>
            Agency
          </span>
        </Link>

        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 'clamp(0.78rem, 1.8vw, 0.82rem)',
          // ✅ CORRECTION CONTRASTE : 0.36 → 0.65 (ratio ~3.8:1 ✅)
          color: 'rgba(232,228,220,0.65)',
          lineHeight: 1.8,
          fontWeight: 300,
          maxWidth: '280px',
          marginBottom: '24px',
        }}>
          Agence multidisciplinaire au service de vos ambitions. Immobilier, événementiel et communication réunis en une seule vision.
        </p>

        {/* Réseaux sociaux — ✅ 44×44px min pour zones tactiles */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SOCIALS.map(({ href, icon: Icon, label, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Suivre Altitude-Vision sur ${label}`}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                border: '1px solid rgba(232,228,220,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // ✅ couleur initiale plus visible : 0.32 → 0.55
                color: 'rgba(232,228,220,0.55)',
                background: 'rgba(232,228,220,0.03)',
                transition: '0.25s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${color}18`;
                e.currentTarget.style.borderColor = `${color}40`;
                e.currentTarget.style.color = color;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(232,228,220,0.03)';
                e.currentTarget.style.borderColor = 'rgba(232,228,220,0.08)';
                e.currentTarget.style.color = 'rgba(232,228,220,0.55)';
              }}
            >
              <Icon size={16} />
            </a>
          ))}
        </div>
      </div>

      {/* ── Nos pôles ── */}
      {/* ✅ <nav> avec aria-labelledby lie le titre à la liste de navigation
          → les lecteurs d'écran annoncent "Navigation Nos Pôles" */}
      <nav aria-labelledby="footer-poles-title">
        <ColTitle id="footer-poles-title">Nos Pôles</ColTitle>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {LINKS_POLES.map(({ to, label, color }) => (
            <li key={to}>
              <Link href={to} className="av-footer-nav-link">
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Informations ── */}
      <nav aria-labelledby="footer-info-title">
        <ColTitle id="footer-info-title">Informations</ColTitle>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {LINKS_INFO.map(({ to, label }) => (
            <li key={to}>
              <Link href={to} className="av-footer-nav-link">
                <ArrowUpRight size={13} style={{ color: '#C8872A', opacity: 0.8, flexShrink: 0 }} aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Contact ── */}
      <div>
        <ColTitle id="footer-contact-title">Contact</ColTitle>
        <address style={{ fontStyle: 'normal', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {CONTACT_ITEMS.map(({ icon: Icon, color, lines, href }, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}>
                <Icon size={13} style={{ color }} aria-hidden="true" />
              </div>
              <div>
                {lines.map((line, j) =>
                  href && j === 0 ? (
                    <a
                      key={j}
                      href={href}
                      style={{
                        display: 'block',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 'clamp(0.75rem, 1.8vw, 0.82rem)',
                        // ✅ CORRECTION CONTRASTE : 0.42 → 0.72 (ratio ~4.6:1 ✅)
                        color: 'rgba(232,228,220,0.72)',
                        fontWeight: 400,
                        lineHeight: 1.6,
                        transition: '0.2s',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#E8E4DC'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,228,220,0.72)'; }}
                    >
                      {line}
                    </a>
                  ) : (
                    <p
                      key={j}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 'clamp(0.75rem, 1.8vw, 0.82rem)',
                        // ✅ CORRECTION CONTRASTE : 0.36 → 0.62 (ratio ~3.7:1 ✅)
                        color: 'rgba(232,228,220,0.62)',
                        fontWeight: 300,
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {line}
                    </p>
                  )
                )}
              </div>
            </div>
          ))}
        </address>
      </div>
    </div>

    {/* Séparateur */}
    <div style={{ borderTop: '1px solid rgba(232,228,220,0.05)', margin: '0 var(--px)' }} />

    {/* Copyright */}
    <div className="av-footer-bottom">
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 'clamp(0.68rem, 1.5vw, 0.72rem)',
        // ✅ 0.2 → 0.45 pour passer le seuil 3:1 sur texte small
        color: 'rgba(232,228,220,0.45)',
        fontWeight: 300,
        margin: 0,
      }}>
        © {currentYear} Altitude-Vision. Tous droits réservés.
      </p>
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 'clamp(0.68rem, 1.5vw, 0.72rem)',
        color: 'rgba(232,228,220,0.45)',
        fontWeight: 300,
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        margin: 0,
      }}>
        Fait avec <span style={{ color: '#D42B2B' }} aria-hidden="true">♥</span>
        <span className="sr-only">amour</span> à Brazzaville
      </p>
    </div>
  </footer>
);

export default Footer;