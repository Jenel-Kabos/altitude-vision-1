import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { MapPin, Mail, Phone, ArrowUpRight } from 'lucide-react';
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';

const currentYear = new Date().getFullYear();

// ─────────────────────────────────────────────────────────────
// Données
// ─────────────────────────────────────────────────────────────
const LINKS_POLES = [
    { to: '/altimmo',     label: 'Altimmo',             color: '#2E7BB5' },
    { to: '/mila-events', label: 'Mila Events',          color: '#D42B2B' },
    { to: '/altcom',      label: 'Altcom',               color: '#C8872A' },
    { to: '/trouve-ta-commission', label: 'Ma Commission', color: '#C8872A' },
];

const LINKS_INFO = [
    { to: '/contact',         label: 'Contact'         },
    { to: '/actualites',      label: 'Actualités'      },
    { to: '/mentions-legales',label: 'Mentions légales' },
];

const SOCIALS = [
    {
        href:  'https://www.facebook.com/profile.php?id=61558493665509',
        icon:  FaFacebook,
        label: 'Facebook',
        hover: '#1877F2',
    },
    {
        href:  'https://www.instagram.com/immoaltitudevision/',
        icon:  FaInstagram,
        label: 'Instagram',
        hover: '#E1306C',
    },
    {
        href:  'https://wa.me/242068002151',
        icon:  FaWhatsapp,
        label: 'WhatsApp',
        hover: '#25D366',
    },
];

// ─────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────
const Footer = () => {
    return (
        <footer style={{ background: '#0D1117' }}>

            {/* Ligne dorée haut */}
            <div className="h-px"
                style={{ background: 'linear-gradient(to right, transparent, #C8872A, #2E7BB5, transparent)' }} />

            <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-14">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

                    {/* ── Col 1 — Brand ───────────────────── */}
                    <div className="lg:col-span-1">
                        <Link to="/" className="inline-block mb-5">
                            <img
                                src="/logo.png"
                                alt="Altitude-Vision"
                                className="h-14 object-contain"
                            />
                        </Link>
                        <p className="text-white/50 text-sm leading-relaxed mb-6"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Agence multidisciplinaire au service de vos ambitions. Immobilier, événementiel et communication réunis en une seule vision.
                        </p>

                        {/* Réseaux sociaux */}
                        <div className="flex gap-3">
                            {SOCIALS.map(({ href, icon: Icon, label, hover }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-white/50 transition-all duration-300 hover:scale-110 hover:border-transparent group"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.backgroundColor = hover;
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                    }}
                                >
                                    <Icon size={15} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* ── Col 2 — Nos pôles ───────────────── */}
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Nos Pôles
                        </h4>
                        <ul className="space-y-3">
                            {LINKS_POLES.map(({ to, label, color }) => (
                                <li key={to}>
                                    <NavLink
                                        to={to}
                                        className="group flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors duration-200"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}
                                    >
                                        <span
                                            className="w-1 h-1 rounded-full flex-shrink-0 transition-all duration-200 group-hover:w-3"
                                            style={{ backgroundColor: color }}
                                        />
                                        {label}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ── Col 3 — Informations ────────────── */}
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Informations
                        </h4>
                        <ul className="space-y-3">
                            {LINKS_INFO.map(({ to, label }) => (
                                <li key={to}>
                                    <NavLink
                                        to={to}
                                        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors duration-200 group"
                                        style={{ fontFamily: "'Outfit', sans-serif" }}
                                    >
                                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-1 group-hover:ml-0 transition-all duration-200"
                                            style={{ color: '#C8872A' }} />
                                        {label}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ── Col 4 — Contact ─────────────────── */}
                    <div>
                        <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            Contact
                        </h4>
                        <address className="not-italic space-y-4">
                            {[
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
                            ].map(({ icon: Icon, color, lines, href }, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                        style={{ backgroundColor: `${color}18` }}>
                                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                                    </div>
                                    <div>
                                        {lines.map((line, j) =>
                                            href && j === 0 ? (
                                                <a key={j} href={href}
                                                    className="block text-sm text-white/50 hover:text-white transition-colors duration-200"
                                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                                                    {line}
                                                </a>
                                            ) : (
                                                <p key={j} className="text-sm text-white/50"
                                                    style={{ fontFamily: "'Outfit', sans-serif" }}>
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
            </div>

            {/* Séparateur */}
            <div className="border-t border-white/5" />

            {/* Copyright */}
            <div className="container mx-auto px-4 sm:px-6 max-w-6xl py-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-white/25 text-xs"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        © {currentYear} Altitude-Vision. Tous droits réservés.
                    </p>
                    <div className="flex items-center gap-1 text-white/25 text-xs"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <span>Fait avec</span>
                        <span style={{ color: '#D42B2B' }}>♥</span>
                        <span>à Brazzaville</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;