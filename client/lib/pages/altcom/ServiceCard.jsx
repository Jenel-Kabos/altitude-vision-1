"use client";
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Send, ArrowRight } from 'lucide-react';
import { GOLD, GOLD_DARK } from './altcomData';

const ServiceCard = ({ service, onQuote, index }) => {
    const Icon = service.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -6 }}
            className="group relative rounded-2xl flex flex-col h-full overflow-hidden"
            style={{
                background:   '#FFFFFF',
                border:       `1px solid ${service.color}20`,
                boxShadow:    '0 2px 12px rgba(0,0,0,0.06)',
                transition:   'all 0.4s ease',
            }}
        >
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ backgroundColor: service.color }} />

            {/* Image */}
            {service.images?.[0] && (
                <div className="relative h-44 overflow-hidden flex-shrink-0">
                    <Image src={service.images[0]} alt={service.title} fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0"
                        style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(13,17,24,0.92) 100%)' }} />
                    <div className="absolute top-4 left-4 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${service.color}CC`, boxShadow: `0 4px 12px ${service.color}50` }}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                </div>
            )}

            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
                {/* Radial hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ background: `radial-gradient(circle at 30% 50%, ${service.color}08, transparent 70%)` }} />

                <span style={{ display: 'inline-block', fontSize: '0.64rem', fontWeight: 700, padding: '3px 9px', borderRadius: '40px', marginBottom: '10px', background: `${service.color}12`, color: service.color, fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 1 }}>
                    {service.stat}
                </span>

                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '1rem', color: '#111827', marginBottom: '8px', lineHeight: 1.35, position: 'relative', zIndex: 1, transition: 'color 0.2s' }}
                    className="group-hover:text-[#A06820]">
                    {service.title}
                </h3>
                <p style={{ color: '#6B7280', fontSize: '0.83rem', lineHeight: 1.7, marginBottom: '18px', flex: 1, position: 'relative', zIndex: 1, fontFamily: "'DM Sans', sans-serif" }}>
                    {service.shortDesc}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 1, marginTop: 'auto' }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => onQuote(service.title)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm"
                        style={{ background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`, boxShadow: `0 4px 16px ${GOLD}30`, fontFamily: "'DM Sans', sans-serif", border: 'none', cursor: 'pointer' }}>
                        <Send className="w-4 h-4" /> Demander un devis
                    </motion.button>
                    <Link href={service.route}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all"
                        style={{ color: service.color, fontFamily: "'DM Sans', sans-serif" }}>
                        Détails du service
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
};

export default ServiceCard;
