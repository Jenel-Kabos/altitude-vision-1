import api from './api';

// REPORTING-1 — pur wrapper HTTP autour de /api/reporting/*. Aucune
// décision métier ici : le backend seul décide de quels domaines sont
// disponibles et de la source de chaque KPI.

export const getExecutiveReport = async (params = {}) => (await api.get('/reporting/executive', { params })).data.data.report;
export const getDomainReport = async (domain, params = {}) => (await api.get(`/reporting/domains/${domain}`, { params })).data.data.report;

// Passe par l'instance axios authentifiée (Authorization requis côté
// serveur) puis déclenche un téléchargement local — un simple <a href>
// n'enverrait pas le token.
export const downloadReportExport = async (format, params = {}) => {
  const res = await api.get(`/reporting/export/${format}`, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `centre-pilotage.${format}`;
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
