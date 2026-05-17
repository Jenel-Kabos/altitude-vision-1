"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Shield, ArrowLeft, Settings } from 'lucide-react';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8872A';

const ROLE_LABELS = {
    Admin:         'Administrateur',
    Collaborateur: 'Collaborateur',
    Proprietaire:  'Propriétaire',
    Client:        'Client',
    Prestataire:   'Prestataire',
    User:          'Membre',
};

const ProfilePage = () => {
    const { user } = useAuth();

    const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Membre';

    return (
        <div className="min-h-screen py-16 px-4"
            style={{ background: 'linear-gradient(135deg, #0D1117 0%, #0e1e30 60%, #0D1117 100%)' }}>

            {/* Halo décoratif */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 right-1/3 w-96 h-96 rounded-full blur-[120px] opacity-8"
                    style={{ background: BLUE }} />
                <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px] opacity-5"
                    style={{ background: GOLD }} />
            </div>

            <div className="container mx-auto max-w-lg relative z-10">

                {/* Retour */}
                <Link href="/"
                    className="inline-flex items-center gap-2 mb-8 text-sm transition-all"
                    style={{ color: 'rgba(232,228,220,0.4)', fontFamily: "'DM Sans', sans-serif" }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(232,228,220,0.8)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(232,228,220,0.4)'}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour à l'accueil
                </Link>

                {/* Card */}
                <div style={{
                    background:    'rgba(10,12,15,0.85)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border:        '1px solid rgba(232,228,220,0.07)',
                    borderRadius:  '28px',
                    overflow:      'hidden',
                    boxShadow:     '0 32px 80px rgba(0,0,0,0.6)',
                }}>

                    {/* ── Hero ── */}
                    <div className="relative px-8 py-12 text-center overflow-hidden"
                        style={{ borderBottom: '1px solid rgba(232,228,220,0.06)' }}>

                        {/* Ligne déco top */}
                        <div className="absolute top-0 left-0 right-0 h-px"
                            style={{ background: `linear-gradient(to right, transparent, ${BLUE}60, transparent)` }} />

                        {/* Avatar */}
                        <div className="relative inline-block mb-5">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center mx-auto"
                                style={{
                                    background: user?.photo
                                        ? 'transparent'
                                        : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    boxShadow: `0 0 0 3px rgba(46,123,181,0.2), 0 8px 32px rgba(0,0,0,0.5)`,
                                }}>
                                {user?.photo
                                    ? <img src={user.photo} alt={user.name}
                                        className="w-full h-full object-cover" />
                                    : <User className="w-11 h-11 text-white opacity-80" />
                                }
                            </div>

                            {/* Badge rôle */}
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                                style={{
                                    background:    `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    color:         '#fff',
                                    fontFamily:    "'DM Sans', sans-serif",
                                    letterSpacing: '0.04em',
                                    boxShadow:     `0 2px 12px ${BLUE}50`,
                                }}>
                                {roleLabel}
                            </div>
                        </div>

                        {/* Nom */}
                        <h1 className="mt-4 text-white"
                            style={{
                                fontFamily: "'Cormorant Garamond', serif",
                                fontSize:   '1.9rem',
                                fontWeight: 700,
                                lineHeight: 1.2,
                            }}>
                            {user?.name || 'Mon Profil'}
                        </h1>

                        {/* Séparateur doré */}
                        <div className="h-px w-10 rounded-full mx-auto mt-3"
                            style={{ background: `linear-gradient(to right, ${BLUE}, ${GOLD})` }} />
                    </div>

                    {/* ── Infos ── */}
                    <div className="px-7 py-7 space-y-3">

                        {/* Email */}
                        {user?.email && (
                            <InfoRow
                                icon={<Mail className="w-4 h-4" />}
                                iconColor={BLUE}
                                label="Email"
                                value={user.email}
                            />
                        )}

                        {/* Téléphone */}
                        {user?.phone && (
                            <InfoRow
                                icon={<Phone className="w-4 h-4" />}
                                iconColor='#22C55E'
                                label="Téléphone"
                                value={user.phone}
                            />
                        )}

                        {/* Rôle */}
                        <InfoRow
                            icon={<Shield className="w-4 h-4" />}
                            iconColor={GOLD}
                            label="Rôle"
                            value={roleLabel}
                        />

                        {/* CTA */}
                        <div className="pt-4">
                            <Link href="/mon-compte"
                                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-medium text-sm transition-all"
                                style={{
                                    background:    `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    color:         '#fff',
                                    fontFamily:    "'DM Sans', sans-serif",
                                    letterSpacing: '0.04em',
                                    boxShadow:     `0 4px 20px ${BLUE}35`,
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                <Settings className="w-4 h-4" />
                                Gérer mon compte
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Ligne d'info réutilisable ─────────────────────────────────
const InfoRow = ({ icon, iconColor, label, value }) => (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all"
        style={{
            background: 'rgba(232,228,220,0.03)',
            border:     '1px solid rgba(232,228,220,0.05)',
        }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}15`, color: iconColor }}>
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider font-semibold mb-0.5"
                style={{ color: 'rgba(232,228,220,0.3)', fontFamily: "'DM Sans', sans-serif" }}>
                {label}
            </p>
            <p className="text-sm font-medium truncate"
                style={{ color: 'rgba(232,228,220,0.85)', fontFamily: "'DM Sans', sans-serif" }}>
                {value}
            </p>
        </div>
    </div>
);

export default ProfilePage;