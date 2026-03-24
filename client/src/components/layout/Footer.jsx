import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { MapPin, Mail, Phone, ArrowUpRight } from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const currentYear = new Date().getFullYear();

const LINKS_POLES = [
  { to: '/altimmo',             label: 'Altimmo',        color: '#2E7BB5' },
  { to: '/mila-events',         label: 'Mila Events',    color: '#D42B2B' },
  { to: '/altcom',              label: 'Altcom',         color: '#C8872A' },
  { to: '/trouve-ta-commission', label: 'Ma Commission', color: '#C8872A' },
];

const LINKS_INFO = [
  { to: '/contact',           label: 'Contact'          },
  { to: '/actualites',        label: 'Actualités'       },
  { to: '/mentions-legales',  label: 'Mentions légales' },
];

const SOCIALS = [
  {
    href:  'https://www.facebook.com/profile.php?id=61558493665509',
    icon:  FaFacebook,
    label: 'Facebook',
    color: '#1877F2',
  },
  {
    href:  'https://www.instagram.com/immoaltitudevision/',
    icon:  FaInstagram,
    label: 'Instagram',
    color: '#E1306C',
  },
  {
    href:  'https://wa.me/242068002151',
    icon:  FaWhatsapp,
    label: 'WhatsApp',
    color: '#25D366',
  },
];

const CONTACT_ITEMS = [
  {
    icon: MapPin,
    color: '#2E7BB5',
    lines: ['Rue Mfoa n°24, Poto-Poto', 'Derrière Canal Olympia', 'Brazzaville, Congo'],
  },
  {
    icon: Mail,
    color: '#C8872A',
    lines: ['contact@altitudevision.agency'],
    href: 'mailto:contact@altitudevision.agency',
  },
  {
    icon: Phone,
    color: '#D42B2B',
    lines: ['+242 06 800 21 51'],
    href: 'tel:+242068002151',
  },
];

const Footer = () => {
  return (
    <footer style={{ background: '#080A0D' }}>

      {/* Ligne dégradée haute */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(to right, transparent, rgba(200,135,42,0.35), rgba(46,123,181,0.2), transparent)',
      }} />

      <div style={{
        maxWidth: '1200px', margin: '0 auto',
        padding: '80px 48px 56px',
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
        gap: '60px',
      }}>

        {/* ── Col 1 — Brand ── */}
        <div>
          <Link to="/" style={{ textDecoration: 'none', display: 'block', marginBottom: '20px' }}>
            <span style={{
              display: 'block',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '1.35rem',
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
              color: 'rgba(232,228,220,0.2)',
              textTransform: 'uppercase',
              marginTop: '2px',
            }}>
              Agency
            </span>
          </Link>

          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.82rem',
            color: 'rgba(232,228,220,0.38)',
            lineHeight: 1.8,
            fontWeight: 300,
            maxWidth: '260px',
            marginBottom: '28px',
          }}>
            Agence multidisciplinaire au service de vos ambitions. Immobilier, événementiel et communication réunis en une seule vision.
          </p>

          {/* Réseaux sociaux */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {SOCIALS.map(({ href, icon: Icon, label, color }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                style={{
                  width: '36px', height: '36px',
                  borderRadius: '10px',
                  border: '1px solid rgba(232,228,220,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(232,228,220,0.35)',
                  background: 'rgba(232,228,220,0.03)',
                  transition: '0.25s', cursor: 'pointer',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${color}18`;
                  e.currentTarget.style.borderColor = `${color}40`;
                  e.currentTarget.style.color = color;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(232,228,220,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(232,228,220,0.08)';
                  e.currentTarget.style.color = 'rgba(232,228,220,0.35)';
                }}
              >
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>

        {/* ── Col 2 — Nos pôles ── */}
        <div>
          <h4 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.62rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(232,228,220,0.3)',
            fontWeight: 400,
            marginBottom: '24px',
          }}>
            Nos Pôles
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {LINKS_POLES.map(({ to, label, color }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.85rem',
                    fontWeight: 300,
                    color: 'rgba(232,228,220,0.45)',
                    textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: '0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E8E4DC'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,228,220,0.45)'; }}
                >
                  <span style={{
                    width: '4px', height: '4px',
                    borderRadius: '50%', background: color,
                    flexShrink: 0, transition: '0.2s',
                  }} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Col 3 — Informations ── */}
        <div>
          <h4 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.62rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(232,228,220,0.3)',
            fontWeight: 400,
            marginBottom: '24px',
          }}>
            Informations
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {LINKS_INFO.map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.85rem',
                    fontWeight: 300,
                    color: 'rgba(232,228,220,0.45)',
                    textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: '0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E8E4DC'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,228,220,0.45)'; }}
                >
                  <ArrowUpRight
                    size={12}
                    style={{ color: '#C8872A', flexShrink: 0, opacity: 0.7 }}
                  />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Col 4 — Contact ── */}
        <div>
          <h4 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.62rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(232,228,220,0.3)',
            fontWeight: 400,
            marginBottom: '24px',
          }}>
            Contact
          </h4>
          <address style={{ fontStyle: 'normal', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {CONTACT_ITEMS.map(({ icon: Icon, color, lines, href }, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '28px', height: '28px',
                  borderRadius: '8px',
                  background: `${color}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '1px',
                }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <div>
                  {lines.map((line, j) =>
                    href && j === 0 ? (
                      <a key={j} href={href} style={{
                        display: 'block',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.82rem',
                        color: 'rgba(232,228,220,0.45)',
                        fontWeight: 300,
                        textDecoration: 'none',
                        transition: '0.2s',
                        lineHeight: 1.6,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#E8E4DC'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(232,228,220,0.45)'; }}
                      >
                        {line}
                      </a>
                    ) : (
                      <p key={j} style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.82rem',
                        color: 'rgba(232,228,220,0.38)',
                        fontWeight: 300,
                        lineHeight: 1.6,
                      }}>
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
      <div style={{
        borderTop: '1px solid rgba(232,228,220,0.05)',
        margin: '0 48px',
      }} />

      {/* Copyright */}
      <div style={{
        maxWidth: '1200px', margin: '0 auto',
        padding: '20px 48px',
        display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '10px',
      }}>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.72rem',
          color: 'rgba(232,228,220,0.2)',
          fontWeight: 300,
        }}>
          © {currentYear} Altitude-Vision. Tous droits réservés.
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.72rem',
          color: 'rgba(232,228,220,0.2)',
          fontWeight: 300,
          display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          Fait avec <span style={{ color: '#D42B2B' }}>♥</span> à Brazzaville
        </p>
      </div>
    </footer>
  );
};

export default Footer;