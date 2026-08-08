// REPORTING-1 (Phase 7) — Export du rapport exécutif. Réutilise les helpers
// PDF déjà brandés (pdfService.js, exportés additivement pour ce sprint) —
// aucune mise en page dupliquée. L'échappement CSV suit la même convention
// RFC 4180 que exportController.js (utilitaire générique, pas une règle
// métier — non importé pour éviter de coupler ce module au domaine export
// marketing, qui n'a aucun rapport fonctionnel avec le reporting).
const { newDoc, pdfToBuffer, addHeader, addFooter, sectionTitle, infoLine, fmt } = require('../pdfService');

const escCsv = (v) => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

// Aplatit les KPI scalaires de chaque DomainReport en lignes {domaine,
// indicateur, valeur} — ignore les tableaux/objets imbriqués (pipeline,
// listes détaillées) qui n'ont pas de sens en export tabulaire plat.
function flattenKpis(executiveReport) {
  const rows = [];
  Object.entries(executiveReport.domains).forEach(([domain, entry]) => {
    if (entry.status !== 'ok') { rows.push({ domain, indicateur: 'Erreur', valeur: entry.error }); return; }
    const kpis = entry.data.kpis || entry.data.portfolio || entry.data;
    Object.entries(kpis).forEach(([key, value]) => {
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        rows.push({ domain, indicateur: key, valeur: value });
      }
    });
  });
  return rows;
}

function buildCsv(executiveReport) {
  const rows = flattenKpis(executiveReport);
  let csv = '﻿'; // BOM — cohérence avec exportController.js (ouverture Excel/LibreOffice correcte des accents)
  csv += 'Domaine,Indicateur,Valeur\n';
  csv += rows.map((r) => [escCsv(r.domain), escCsv(r.indicateur), escCsv(r.valeur)].join(',')).join('\n');
  return csv;
}

async function buildPdf(executiveReport) {
  const doc = newDoc();
  const bufferPromise = pdfToBuffer(doc);
  addHeader(doc, 'CENTRE DE PILOTAGE — RAPPORT EXÉCUTIF', new Date(executiveReport.generatedAt).toLocaleString('fr-FR'));
  Object.entries(executiveReport.domains).forEach(([domain, entry]) => {
    sectionTitle(doc, domain.toUpperCase());
    if (entry.status !== 'ok') { infoLine(doc, 'Statut', `Indisponible (${entry.error})`); return; }
    const kpis = entry.data.kpis || entry.data.portfolio || entry.data;
    Object.entries(kpis).forEach(([key, value]) => {
      if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        infoLine(doc, key, typeof value === 'number' && /minor/i.test(key) ? fmt(value / 100) : String(value));
      }
    });
  });
  addFooter(doc);
  return bufferPromise;
}

module.exports = { buildCsv, buildPdf, flattenKpis };
