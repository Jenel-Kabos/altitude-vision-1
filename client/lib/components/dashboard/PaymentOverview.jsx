"use client";

// Dette technique GL-B2 (Mission 9) — extrait de GestionLocativePage.jsx,
// markup et classes strictement identiques (aucun changement visuel).
// Montants calculés côté serveur (GET /api/paiements/stats) — jamais
// recalculés ici.

import React from "react";

const PaymentOverview = ({ paiementStats, colors }) => {
  const { BLUE, GREEN, RED } = colors;
  const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR')} F`;
  return (
    <>
      <div className="border border-gray-100 rounded-xl p-3 text-center">
        <p className="text-base font-extrabold" style={{ color: BLUE }}>{paiementStats ? fmt(paiementStats.totalAttendu) : '—'}</p>
        <p className="text-xs text-gray-400">Loyers attendus</p>
      </div>
      <div className="border border-gray-100 rounded-xl p-3 text-center">
        <p className="text-base font-extrabold" style={{ color: GREEN }}>{paiementStats ? fmt(paiementStats.totalEncaisse) : '—'}</p>
        <p className="text-xs text-gray-400">Loyers encaissés</p>
      </div>
      <div className="border border-gray-100 rounded-xl p-3 text-center">
        <p className="text-base font-extrabold" style={{ color: RED }}>{paiementStats ? fmt(paiementStats.totalImpaye) : '—'}</p>
        <p className="text-xs text-gray-400">Impayés (montant)</p>
      </div>
    </>
  );
};

export default PaymentOverview;
