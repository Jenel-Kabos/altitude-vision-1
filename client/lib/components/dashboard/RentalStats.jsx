"use client";

// Dette technique GL-B2 (Mission 9) — extrait de GestionLocativePage.jsx,
// markup et classes strictement identiques (aucun changement visuel).

import React from "react";
import { RefreshCw } from "lucide-react";

const RentalStats = ({ rentalStats, contratsActifs, loyersMensuel, onRefresh, colors }) => {
  const { BLUE, GREEN, GOLD, RED } = colors;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {[
        ['Biens gérés',     rentalStats.total || 0,       BLUE],
        ['Vacants',         rentalStats.vacant || 0,      GREEN],
        ['Publiés',         rentalStats.published || 0,   '#7C3AED'],
        ['Maintenance',     rentalStats.maintenance || 0, GOLD],
        ['Impayés',         rentalStats.overduePayments || 0, RED],
        ['Paiements partiels',rentalStats.partialPayments || 0, GOLD],
        [`Contrats ≤ ${rentalStats.contractAlertWindowDays || 30}j`,rentalStats.expiringContracts || 0, '#7C3AED'],
        ['Contrats expirés', rentalStats.expiredContracts || 0, RED],
        ['Sorties bloquées',rentalStats.blockingInspections || 0, '#7C3AED'],
        ['Contrats actifs', contratsActifs,            GREEN],
      ].map(([l,v,c])=>(
        <div key={l} className="text-center">
          <p className="text-xl font-extrabold" style={{color:c}}>{v}</p>
          <p className="text-xs text-gray-400">{l}</p>
        </div>
      ))}
      {loyersMensuel > 0 && (
        <div className="text-center border-l border-gray-100 pl-4">
          <p className="text-sm font-extrabold" style={{color:GREEN}}>{Number(loyersMensuel).toLocaleString('fr-FR')}</p>
          <p className="text-xs text-gray-400">FCFA/mois</p>
        </div>
      )}
      <button onClick={onRefresh} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-all"><RefreshCw size={16}/></button>
    </div>
  );
};

export default RentalStats;
