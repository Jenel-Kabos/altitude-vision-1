"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Shield, Settings } from 'lucide-react';
import BackButton from '../components/navigation/BackButton';

const BLUE      = '#2E7BB5';
const BLUE_DARK = '#1A5A8A';
const GOLD      = '#C8960C';

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
            style={{ background: '#F8F8F8' }}>

            <div className="container mx-auto max-w-lg relative z-10">

                {/* Retour */}
                <BackButton
                    fallbackHref="/mon-compte"
                    label="Retour à mon compte"
                    className="mb-8"
                />

                {/* Card */}
                <div style={{
                    background:   '#FFFFFF',
                    border:       '1px solid rgba(17,24,39,0.08)',
                    borderRadius: '28px',
                    overflow:     'hidden',
                    boxShadow:    '0 8px 32px rgba(0,0,0,0.08)',
                }}>

                    {/* ── Hero ── */}
                    <div className="relative px-8 py-12 text-center overflow-hidden"
                        style={{ borderBottom: '1px solid rgba(17,24,39,0.08)' }}>

                        {/* Ligne déco top */}
                        <div className="absolute top-0 left-0 right-0 h-px"
                            style={{ background: `linear-gradient(to right, transparent, ${BLUE}60, transparent)` }} />

                        {/* Avatar */}
                        <div className="relative inline-block mb-5">
                            <div className="relative w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center mx-auto"
                                style={{
                                    background: user?.photo
                                        ? 'transparent'
                                        : `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})`,
                                    boxShadow: `0 0 0 3px rgba(46,123,181,0.2), 0 8px 32px rgba(0,0,0,0.5)`,
                                }}>
                                {user?.photo
                                    ? <Image src={user.photo} alt={user.name}
                                        fill unoptimized className="object-cover" />
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
                        <h1 className="mt-4"
                            style={{
                                color:      '#111827',
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
            background: '#F9FAFB',
            border:     '1px solid rgba(17,24,39,0.06)',
        }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}15`, color: iconColor }}>
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider font-semibold mb-0.5"
                style={{ color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
                {label}
            </p>
            <p className="text-sm font-medium truncate"
                style={{ color: '#111827', fontFamily: "'DM Sans', sans-serif" }}>
                {value}
            </p>
        </div>
    </div>
);

export default ProfilePage;
