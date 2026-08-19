'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Mail, Phone, Clock, ArrowUpRight, Users, Handshake, Zap } from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const currentYear = new Date().getFullYear();

// UI-WEB-FOOTER-1 — Palette réutilisée telle quelle depuis le reste du site
// public (jamais inventée pour ce composant) : `#0A0C0F`/`#E8E4DC`/
// `rgba(232,228,220,0.45)` sont les tokens du fond sombre premium déjà
// utilisé par WhyChooseUs.jsx (section "Pourquoi nous choisir" de l'accueil),
// eux-mêmes cohérents avec le `rgba(9,11,14,...)` du Header.jsx. `GOLD`/
// `BLUE` sont les constantes déjà nommées ainsi dans Header.jsx.
const GOLD = '#C8960C';
const BLUE = '#2E7BB5';
const INK = '#0A0C0F';
const PAPER = '#E8E4DC';
const MUTED = 'rgba(232,228,220,0.45)';
const FAINT = 'rgba(232,228,220,0.6)';

const LINKS_POLES = [
  { to: '/immobilier',            label: 'Altimmo',       sub: 'Immobilier',    color: BLUE },
  { to: '/evenementiel',          label: 'Mila Events',   sub: 'Événementiel',  color: '#D42B2B' },
  { to: '/communication',         label: 'Altcom',        sub: 'Communication', color: GOLD },
  { to: '/trouve-ta-commission',  label: 'Ma Commission', sub: 'Apporteurs d’affaires', color: GOLD },
];

// UI-WEB-FOOTER-1 — "Confidentialité" ajouté : route réelle et déjà
// existante (`/politique-confidentialite`) mais jusqu'ici jamais liée depuis
// le footer. "FAQ" n'a volontairement pas été ajoutée : aucune route `/faq`
// n'existe dans le projet (vérifié par audit du dossier `app/`) — conforme
// au mandat, une route absente n'est jamais inventée.
const LINKS_INFO = [
  { to: '/contact',                label: 'Contact'              },
  { to: '/actualites',             label: 'Actualités'           },
  { to: '/mentions-legales',       label: 'Mentions légales'     },
  { to: '/politique-confidentialite', label: 'Confidentialité'   },
  { to: '/signaler-un-litige',     label: 'Signaler un problème' },
];

const SOCIALS = [
  { href: 'https://www.facebook.com/profile.php?id=61558493665509', icon: FaFacebook, label: 'Facebook'  },
  { href: 'https://www.instagram.com/immoaltitudevision/',           icon: FaInstagram, label: 'Instagram' },
  { href: 'https://wa.me/242068002151',                              icon: FaWhatsapp,  label: 'WhatsApp'  },
];

const CONTACT_ITEMS = [
  { icon: MapPin, lines: ['Rue Mfoa n°24, Poto-Poto', 'Derrière Canal Olympia', 'Brazzaville, Congo'] },
  { icon: Mail,   lines: ['contact@altitudevision.agency'], href: 'mailto:contact@altitudevision.agency' },
  { icon: Phone,  lines: ['+242 06 800 21 51'], href: 'tel:+242068002151' },
];

// UI-WEB-FOOTER-1 — horaires réels, repris tels quels de AltimmoContact.jsx
// (mêmes coordonnées/téléphone déjà partagés par ce footer) — jamais
// inventés. MilaContact.jsx affiche des horaires légèrement différents
// propres au pôle événementiel ; un footer global ne peut refléter qu'un
// seul jeu d'horaires, celui du pôle dont les coordonnées sont déjà
// affichées ici est retenu (choix documenté dans UI_WEB_FOOTER1_REPORT.md).
const HORAIRES = [
  { day: 'Lun. – Ven.', time: '8h00 – 18h00' },
  { day: 'Samedi',      time: '9h00 – 14h00' },
  { day: 'Dimanche',    time: 'Fermé' },
];

// UI-WEB-FOOTER-1 — 3 des 6 promesses déjà publiées et validées par
// WhyChooseUs.jsx (section "Pourquoi nous choisir" de l'accueil), reprises
// avec un libellé raccourci — jamais une nouvelle promesse commerciale
// inventée pour ce seul composant.
const TRUST_POINTS = [
  { icon: Users,     title: 'Accompagnement personnalisé', color: BLUE },
  { icon: Handshake, title: 'Transparence & confiance',     color: GOLD },
  { icon: Zap,       title: 'Rapidité & efficacité',        color: '#D42B2B' },
];

const FOOTER_CSS = `
  .av-footer-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1.1fr;
    gap: clamp(32px, 5vw, 72px);
    padding: clamp(56px,8vw,120px) var(--px) clamp(40px,6vw,64px);
    max-width: 1400px;
    margin: 0 auto;
  }
  @media (min-width: 1920px) {
    .av-footer-grid { max-width: 1600px; gap: 90px; }
    .av-footer-bottom { max-width: 1600px; }
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
    max-width: 1400px;
    margin: 0 auto;
  }
  .av-footer-nav-link {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(0.78rem, 1.1vw, 1rem);
    font-weight: 400;
    color: ${FAINT};
    transition: color 0.2s, transform 0.2s;
    text-decoration: none;
  }
  .av-footer-nav-link:hover,
  .av-footer-nav-link.active { color: ${GOLD}; transform: translateX(2px); }
  .av-footer-nav-link:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; border-radius: 4px; }
`;

// Même convention d'accessibilité que la version précédente : un footer vit
// hors du flux h1/h2 de la page, `role="heading"` maintient une hiérarchie
// annonçable sans imposer un niveau de titre incohérent avec le contenu
// principal.
const ColTitle = ({ children, id }) => (
  <p
    id={id}
    role="heading"
    aria-level="3"
    style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 'clamp(0.6rem, 0.9vw, 0.8rem)',
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color: GOLD,
      fontWeight: 600,
      margin: '0 0 22px 0',
    }}
  >
    {children}
  </p>
);

const Footer = () => (
  <footer style={{ background: INK, borderTop: `1px solid rgba(232,228,220,0.06)` }} aria-label="Pied de page Altitude-Vision">
    <style>{FOOTER_CSS}</style>

    {/* Ligne dégradée haute — même motif que Header.jsx/WhyChooseUs.jsx */}
    <div style={{
      height: '1px',
      background: `linear-gradient(to right, transparent, rgba(200,150,12,0.35), rgba(46,123,181,0.18), transparent)`,
    }} />

    <div className="av-footer-grid">

      {/* ── Marque ── */}
      <div className="av-footer-brand">
        {/* HOTFIX-WEB-FOOTER-LOGO-1 — logo officiel fourni par l'utilisateur
            (`/images/Logo_Altitude_Vision.png`), utilisé tel quel (non
            redessiné, couleurs/proportions inchangées). Fond réellement
            transparent (alpha vérifié pixel par pixel — pas un carré blanc/
            noir), donc aucun badge/fond artificiel n'est nécessaire pour le
            faire ressortir sur le footer sombre : l'ancien traitement
            (badge dégradé or + icône Mountain, ajouté en UI-WEB-FOOTER-1
            uniquement pour pallier l'absence de logo exploitable) est
            supprimé. Le fichier contenant déjà "ALTITUDE VISION" +
            "AGENCE DE COMMUNICATION & COURTAGE" en tant qu'image, le
            wordmark texte séparé qui répétait la même information juste en
            dessous est retiré pour éviter une répétition visuelle ; le nom
            reste accessible via `alt`/`aria-label`. */}
        <Link href="/" style={{ textDecoration: 'none', display: 'block', marginBottom: '20px' }} aria-label="Accueil Altitude-Vision">
          <Image
            src="/images/Logo_Altitude_Vision.png"
            alt="Altitude Vision — Agence de Communication & Courtage"
            width={220}
            height={220}
            style={{ height: 'clamp(64px, 7vw, 84px)', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </Link>

        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 'clamp(0.78rem, 1.1vw, 0.95rem)',
          color: MUTED,
          lineHeight: 1.8,
          fontWeight: 300,
          maxWidth: '360px',
          margin: '18px 0 28px',
        }}>
          Agence multidisciplinaire au service de vos ambitions. Immobilier, événementiel et communication réunis en une seule vision.
        </p>

        {/* 3 blocs de confiance */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {TRUST_POINTS.map(({ icon: Icon, title, color }) => (
            <li key={title} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                background: `${color}15`, border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={14} style={{ color }} aria-hidden="true" />
              </span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: PAPER, fontWeight: 400 }}>
                {title}
              </span>
            </li>
          ))}
        </ul>

        {/* Réseaux sociaux — 44×44px min pour zones tactiles */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SOCIALS.map(({ href, icon: Icon, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Suivre Altitude-Vision sur ${label}`}
              style={{
                width: 'clamp(36px, 3vw, 44px)',
                height: 'clamp(36px, 3vw, 44px)',
                borderRadius: '10px',
                border: '1px solid rgba(232,228,220,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: FAINT,
                background: 'rgba(232,228,220,0.04)',
                transition: '0.25s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${GOLD}18`;
                e.currentTarget.style.borderColor = `${GOLD}55`;
                e.currentTarget.style.color = GOLD;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(232,228,220,0.04)';
                e.currentTarget.style.borderColor = 'rgba(232,228,220,0.12)';
                e.currentTarget.style.color = FAINT;
              }}
            >
              <Icon size={16} />
            </a>
          ))}
        </div>
      </div>

      {/* ── Nos pôles ── */}
      <nav aria-labelledby="footer-poles-title">
        <ColTitle id="footer-poles-title">Nos Pôles</ColTitle>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {LINKS_POLES.map(({ to, label, sub, color }) => (
            <li key={to}>
              <Link href={to} className="av-footer-nav-link" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1px', minHeight: '44px', justifyContent: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden="true" />
                  {label}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'rgba(232,228,220,0.32)', paddingLeft: '12px' }}>{sub}</span>
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
                <ArrowUpRight size={13} style={{ color: GOLD, opacity: 0.85, flexShrink: 0 }} aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Contactez-nous ── */}
      <div>
        <ColTitle id="footer-contact-title">Contactez-nous</ColTitle>
        <address style={{ fontStyle: 'normal', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          {CONTACT_ITEMS.map(({ icon: Icon, lines, href }, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px',
                background: 'rgba(200,150,12,0.1)', border: '1px solid rgba(200,150,12,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
              }}>
                <Icon size={13} style={{ color: GOLD }} aria-hidden="true" />
              </div>
              <div>
                {lines.map((line, j) =>
                  href && j === 0 ? (
                    <a
                      key={j}
                      href={href}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 'clamp(0.75rem, 1.1vw, 0.92rem)',
                        color: PAPER,
                        fontWeight: 400,
                        lineHeight: 1.6,
                        transition: '0.2s',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = GOLD; }}
                      onMouseLeave={e => { e.currentTarget.style.color = PAPER; }}
                    >
                      {line}
                    </a>
                  ) : (
                    <p key={j} style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 'clamp(0.75rem, 1.1vw, 0.92rem)',
                      color: MUTED,
                      fontWeight: 300,
                      lineHeight: 1.6,
                      margin: 0,
                    }}>
                      {line}
                    </p>
                  )
                )}
              </div>
            </div>
          ))}
        </address>

        {/* Horaires — données réelles (AltimmoContact.jsx) */}
        <div style={{ borderTop: '1px solid rgba(232,228,220,0.08)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Clock size={13} style={{ color: GOLD }} aria-hidden="true" />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: FAINT, fontWeight: 500 }}>
              Horaires
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {HORAIRES.map(({ day, time }) => (
              <li key={day} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem' }}>
                <span style={{ color: MUTED, fontWeight: 300 }}>{day}</span>
                <span style={{ color: PAPER, fontWeight: 400 }}>{time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>

    {/* Séparateur */}
    <div style={{ borderTop: '1px solid rgba(232,228,220,0.07)', margin: '0 var(--px)' }} />

    {/* Bottom bar */}
    <div className="av-footer-bottom">
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 'clamp(0.68rem, 1.1vw, 0.82rem)',
        color: FAINT,
        fontWeight: 300,
        margin: 0,
      }}>
        © {currentYear} Altitude-Vision. Tous droits réservés.
      </p>
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 'clamp(0.68rem, 1.1vw, 0.82rem)',
        color: FAINT,
        fontWeight: 300,
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        margin: 0,
      }}>
        Fait avec <span style={{ color: '#D42B2B' }} aria-hidden="true">♥</span>
        <span>amour</span> à Brazzaville
      </p>
    </div>
  </footer>
);

export default Footer;
