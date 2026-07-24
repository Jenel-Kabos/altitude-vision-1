// server/utils/regexEscape.js
//
// Échappement systématique des métacaractères regex avant construction d'un
// `new RegExp(...)` à partir d'une entrée utilisateur — évite l'injection de
// motifs regex arbitraires et le ReDoS (backtracking catastrophique) sur les
// routes de recherche publiques (audit filtrage Altimmo).

function escapeRegex(value) {
  return String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
