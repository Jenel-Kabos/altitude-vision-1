// src/pages/altcom/ServiceCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, ArrowRight } from 'lucide-react';
import { GOLD, GOLD_DARK } from './altcomData';

const ServiceCard = ({ service, onQuote, index }) => {
    const navigate = useNavigate();
    const Icon = service.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ y: -6 }}
            className="group relative bg-white rounded-3xl p-7 border flex flex-col h-full transition-all duration-500 hover:shadow-xl overflow-hidden"
            style={{ borderColor: `${service.color}20` }}
        >
            <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: service.color }} />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at 30% 50%,${service.color}08,transparent 70%)` }} />

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 relative z-10"
                style={{ backgroundColor: `${service.color}15`, border: `1px solid ${service.color}25` }}>
                <Icon className="w-6 h-6" style={{ color: service.color }} />
            </div>

            <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3 relative z-10"
                style={{ backgroundColor: `${service.color}12`, color: service.color, fontFamily: "'Outfit',sans-serif" }}>
                {service.stat}
            </span>

            <h3 className="font-bold text-gray-900 text-lg mb-2 relative z-10 transition-colors duration-200 group-hover:text-[#C8872A]"
                style={{ fontFamily: "'Outfit',sans-serif" }}>
                {service.title}
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-5 flex-1 relative z-10"
                style={{ fontFamily: "'Outfit',sans-serif" }}>
                {service.shortDesc}
            </p>

            <div className="space-y-2.5 relative z-10 mt-auto">
                <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => onQuote(service.title)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm transition-all"
                    style={{ background: `linear-gradient(135deg,${GOLD_DARK},${GOLD})`, boxShadow: `0 4px 16px ${GOLD}30`, fontFamily: "'Outfit',sans-serif" }}>
                    <Send className="w-4 h-4" /> Demander un devis
                </motion.button>
                <button onClick={() => navigate(service.route)}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold transition-all group-hover:gap-3"
                    style={{ color: service.color, fontFamily: "'Outfit',sans-serif" }}>
                    Détails du service
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    );
};

export default ServiceCard;