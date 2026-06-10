// client/lib/services/exportMarketingService.js
import api from './api';

const toQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) q.set(k, v);
  });
  return q.toString();
};

export const getExportStats = async (params = {}) => {
  const res = await api.get(`/export/contacts/stats?${toQuery(params)}`);
  return res.data?.data || {};
};

export const downloadExportCsv = async (params = {}) => {
  const res = await api.get(`/export/contacts/csv?${toQuery(params)}`, { responseType: 'blob' });

  const format   = params.format || 'standard';
  const ts       = Date.now();
  const names    = {
    facebook:  `facebook-audience-${ts}.csv`,
    google:    `google-customer-match-${ts}.csv`,
    whatsapp:  `whatsapp-contacts-${ts}.csv`,
    standard:  `contacts-altitudevision-${ts}.csv`,
  };

  const url  = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href  = url;
  link.setAttribute('download', names[format] || `export-${ts}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
