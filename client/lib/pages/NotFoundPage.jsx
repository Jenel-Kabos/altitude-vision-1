'use client';

import React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Calendar, Briefcase } from "lucide-react";
import { motion } from "framer-motion";

const NotFoundPage = () => {

  const floatVariant = {
    animate: {
      y: [0, -10, 0, 10, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        repeatType: "loop",
        ease: "easeInOut",
      },
    },
  };

  const pulseVariant = {
    animate: {
      scale: [1, 1.05, 1.1, 1.05, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        repeatType: "loop",
        ease: "easeInOut",
      },
    },
  };

  const textVariant = {
    hidden: { y: 20, opacity: 0 },
    visible: (delay = 0) => ({
      y: 0,
      opacity: 1,
      transition: { delay, duration: 0.6, ease: "easeOut" },
    }),
  };

  const poles = [
    { to: "/altimmo",     label: "Altimmo",     sub: "Immobilier",    icon: Building2, color: "#2E7BB5", bg: "rgba(46,123,181,0.08)",  border: "rgba(46,123,181,0.18)" },
    { to: "/mila-events", label: "Mila Events", sub: "Événementiel",  icon: Calendar,  color: "#D42B2B", bg: "rgba(212,43,43,0.08)",   border: "rgba(212,43,43,0.18)"  },
    { to: "/altcom",      label: "Altcom",      sub: "Communication", icon: Briefcase, color: "#C8872A", bg: "rgba(200,135,42,0.08)",  border: "rgba(200,135,42,0.18)" },
  ];

  return (
    <>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0A0C0F",
        textAlign: "center",
        padding: "clamp(40px, 8vw, 80px) clamp(16px, 5vw, 40px)",
        fontFamily: "'DM Sans', sans-serif",
      }}>

        {/* --- Illustration flottante --- */}
        <motion.img
          src="https://illustrations.popsy.co/gray/error-404.svg"
          alt="Page non trouvée"
          style={{ width: "clamp(180px, 40vw, 320px)", marginBottom: "clamp(24px, 4vw, 40px)", opacity: 0.9 }}
          variants={floatVariant}
          animate="animate"
        />

        {/* --- Titre 404 --- */}
        <motion.h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(5rem, 18vw, 10rem)",
            fontWeight: 300,
            color: "#C8872A",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            marginBottom: "8px",
          }}
          initial="hidden"
          animate="visible"
          custom={0}
          variants={textVariant}
        >
          404
        </motion.h1>

        {/* --- Sous-titre --- */}
        <motion.h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
            fontWeight: 300,
            color: "#E8E4DC",
            marginBottom: "clamp(10px, 2vw, 16px)",
          }}
          initial="hidden"
          animate="visible"
          custom={0.2}
          variants={textVariant}
        >
          Oups ! Cette page est introuvable.
        </motion.h2>

        {/* --- Description --- */}
        <motion.p
          style={{
            fontSize: "clamp(0.875rem, 2vw, 1rem)",
            color: "rgba(232,228,220,0.42)",
            fontWeight: 300,
            maxWidth: "440px",
            lineHeight: 1.7,
            marginBottom: "clamp(28px, 5vw, 44px)",
          }}
          initial="hidden"
          animate="visible"
          custom={0.4}
          variants={textVariant}
        >
          Il semble que vous soyez perdu... La page que vous cherchez n'existe
          pas ou a été déplacée.
        </motion.p>

        {/* --- Bouton retour pulsant --- */}
        <motion.div
          variants={pulseVariant}
          animate="animate"
          style={{ display: "inline-block", marginBottom: "clamp(36px, 6vw, 56px)" }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "clamp(11px, 2vw, 14px) clamp(22px, 4vw, 30px)",
              background: "#C8872A",
              color: "#0A0C0F",
              fontWeight: 600,
              fontSize: "clamp(0.72rem, 1.6vw, 0.82rem)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              borderRadius: "40px",
              textDecoration: "none",
              minHeight: "44px",
              boxShadow: "0 4px 20px rgba(200,135,42,0.35)",
            }}
          >
            <ArrowLeft size={16} />
            Retour à l'accueil
          </Link>
        </motion.div>

        {/* --- Séparateur --- */}
        <div style={{
          width: "clamp(200px, 40vw, 320px)",
          height: "1px",
          background: "linear-gradient(to right, transparent, rgba(200,135,42,0.3), transparent)",
          marginBottom: "clamp(28px, 5vw, 44px)",
        }} />

        {/* --- Raccourcis pôles --- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            width: "100%",
            maxWidth: "520px",
          }}
        >
          {poles.map(({ to, label, sub, icon: Icon, color, bg, border }) => (
            <Link
              key={to}
              href={to}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                padding: "18px 12px",
                borderRadius: "14px",
                border: `1px solid ${border}`,
                background: bg,
                textDecoration: "none",
                transition: "transform 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: bg,
                border: `1px solid ${border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={16} style={{ color }} aria-hidden="true" />
              </div>
              <div>
                <p style={{ color: "#E8E4DC", fontWeight: 500, fontSize: "0.85rem", marginBottom: "2px" }}>{label}</p>
                <p style={{ color: "rgba(232,228,220,0.35)", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>{sub}</p>
              </div>
            </Link>
          ))}
        </motion.div>

      </div>
    </>
  );
};

export default NotFoundPage;