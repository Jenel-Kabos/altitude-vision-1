// server/controllers/exportController.js
const User           = require('../models/User');
const Locataire      = require('../models/Locataire');
const Proprietaire   = require('../models/Proprietaire');
const QuoteRequest   = require('../models/QuoteRequest');
const ContactMessage = require('../models/ContactMessage');
const { logAction, buildAuteur } = require('../services/actionLogService');

// ── Helpers ───────────────────────────────────────────────────

const splitName = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { prenom: parts[0], nom: '' };
  const nom    = parts.pop();
  const prenom = parts.join(' ');
  return { prenom, nom };
};

const normalizePhone = (tel = '') => {
  if (!tel) return '';
  const digits = tel.replace(/[\s\-().+]/g, '');
  if (digits.startsWith('242') && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 9)   return `+242${digits.slice(1)}`;
  if (digits.length === 9)                              return `+242${digits}`;
  if (digits.startsWith('00242'))                       return `+${digits.slice(2)}`;
  return tel.startsWith('+') ? tel : `+${digits}`;
};

const escCsv = (v) => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

const buildDateFilter = (dateDebut, dateFin, field = 'createdAt') => {
  if (!dateDebut && !dateFin) return {};
  const f = {};
  if (dateDebut) f.$gte = new Date(dateDebut);
  if (dateFin)   f.$lte = new Date(new Date(dateFin).setHours(23, 59, 59, 999));
  return { [field]: f };
};

// ── Collect contacts ──────────────────────────────────────────

const collectContacts = async ({ source, dateDebut, dateFin, ville, scopeUserIds = null }) => {
  const all = [];
  const sources = (source === 'tous' || !source)
    ? ['proprietaires', 'locataires', 'clients', 'devis', 'contacts']
    : source.split(',').map(s => s.trim());

  if (sources.includes('proprietaires')) {
    const filter = { ...buildDateFilter(dateDebut, dateFin), ...(scopeUserIds ? { user: { $in: scopeUserIds } } : {}) };
    if (ville) filter.ville = new RegExp(ville, 'i');
    const docs = await Proprietaire.find(filter).select('nom prenom email telephone ville createdAt').lean();
    docs.forEach(d => all.push({
      prenom: d.prenom || '',
      nom:    d.nom    || '',
      email:  (d.email || '').toLowerCase().trim(),
      phone:  d.telephone || '',
      source: 'Propriétaire',
      ville:  d.ville || '',
      date:   d.createdAt,
    }));
  }

  if (sources.includes('locataires')) {
    const filter = { ...buildDateFilter(dateDebut, dateFin), ...(scopeUserIds ? { user: { $in: scopeUserIds } } : {}) };
    if (ville) filter.ville = new RegExp(ville, 'i');
    const docs = await Locataire.find(filter).select('nom prenom email telephone ville createdAt').lean();
    docs.forEach(d => all.push({
      prenom: d.prenom || '',
      nom:    d.nom    || '',
      email:  (d.email || '').toLowerCase().trim(),
      phone:  d.telephone || '',
      source: 'Locataire',
      ville:  d.ville || '',
      date:   d.createdAt,
    }));
  }

  if (sources.includes('clients')) {
    const filter = {
      role:   { $in: ['User', 'Client', 'Proprietaire'] },
      status: { $ne: 'Supprimé' },
      ...buildDateFilter(dateDebut, dateFin),
      ...(scopeUserIds ? { _id: { $in: scopeUserIds } } : {}),
    };
    const docs = await User.find(filter).select('name email phone createdAt').lean();
    docs.forEach(d => {
      const { prenom, nom } = splitName(d.name || '');
      all.push({
        prenom,
        nom,
        email:  (d.email || '').toLowerCase().trim(),
        phone:  d.phone || '',
        source: 'Client inscrit',
        ville:  '',
        date:   d.createdAt,
      });
    });
  }

  // Ces sources historiques n'ont aucune attribution tenant fiable. Elles
  // sont donc exclues d'un export tenant-scopé plutôt que diffusées globales.
  if (sources.includes('devis') && !scopeUserIds) {
    const filter = { ...buildDateFilter(dateDebut, dateFin) };
    const docs = await QuoteRequest.find(filter).select('name email phone createdAt').lean();
    docs.forEach(d => {
      const { prenom, nom } = splitName(d.name || '');
      all.push({
        prenom,
        nom,
        email:  (d.email || '').toLowerCase().trim(),
        phone:  d.phone || '',
        source: 'Demande devis',
        ville:  '',
        date:   d.createdAt,
      });
    });
  }

  if (sources.includes('contacts') && !scopeUserIds) {
    const filter = { ...buildDateFilter(dateDebut, dateFin, 'submittedAt') };
    const docs = await ContactMessage.find(filter).select('name email submittedAt').lean();
    docs.forEach(d => {
      const { prenom, nom } = splitName(d.name || '');
      all.push({
        prenom,
        nom,
        email:  (d.email || '').toLowerCase().trim(),
        phone:  '',
        source: 'Formulaire contact',
        ville:  '',
        date:   d.submittedAt || d.createdAt,
      });
    });
  }

  // Déduplique par email (garde la première occurrence la plus récente)
  const map = new Map();
  const sorted = all.sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const c of sorted) {
    const key = c.email || `${c.prenom}-${c.nom}-${c.source}`;
    if (!map.has(key)) map.set(key, c);
  }
  return Array.from(map.values());
};

// ── GET /api/export/contacts ──────────────────────────────────
exports.getContacts = async (req, res) => {
  try {
    const { source, dateDebut, dateFin, ville, requireEmail, requirePhone } = req.query;
    let contacts = await collectContacts({ source, dateDebut, dateFin, ville, scopeUserIds: req.tenantScopeUserIds || [] });

    if (requireEmail === '1')      contacts = contacts.filter(c => c.email);
    if (requirePhone === '1')      contacts = contacts.filter(c => c.phone);
    if (requireEmail === '1' && requirePhone === '1') {
      contacts = contacts.filter(c => c.email && c.phone);
    }

    res.json({
      status:  'success',
      total:   contacts.length,
      data:    { contacts: contacts.slice(0, 200) },
    });
  } catch (err) {
    console.error('[Export] getContacts:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── GET /api/export/contacts/stats ────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { source, dateDebut, dateFin, ville, requireEmail, requirePhone } = req.query;
    let contacts = await collectContacts({ source, dateDebut, dateFin, ville, scopeUserIds: req.tenantScopeUserIds || [] });

    if (requireEmail === '1')                               contacts = contacts.filter(c => c.email);
    if (requirePhone === '1')                               contacts = contacts.filter(c => c.phone);
    if (requireEmail === '1' && requirePhone === '1')       contacts = contacts.filter(c => c.email && c.phone);

    const parSource = {
      proprietaires: contacts.filter(c => c.source === 'Propriétaire').length,
      locataires:    contacts.filter(c => c.source === 'Locataire').length,
      clients:       contacts.filter(c => c.source === 'Client inscrit').length,
      devis:         contacts.filter(c => c.source === 'Demande devis').length,
      contacts:      contacts.filter(c => c.source === 'Formulaire contact').length,
    };

    const parVille = {};
    contacts.forEach(c => {
      if (c.ville) parVille[c.ville] = (parVille[c.ville] || 0) + 1;
    });

    res.json({
      status: 'success',
      data: {
        total:        contacts.length,
        avecEmail:    contacts.filter(c => c.email).length,
        avecTelephone:contacts.filter(c => c.phone).length,
        avecLesDeux:  contacts.filter(c => c.email && c.phone).length,
        parSource,
        parVille,
      },
    });
  } catch (err) {
    console.error('[Export] getStats:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── GET /api/export/contacts/csv ──────────────────────────────
exports.exportCsv = async (req, res) => {
  try {
    const { source, dateDebut, dateFin, ville, format = 'standard', requireEmail, requirePhone } = req.query;
    let contacts = await collectContacts({ source, dateDebut, dateFin, ville, scopeUserIds: req.tenantScopeUserIds || [] });

    if (requireEmail === '1')                         contacts = contacts.filter(c => c.email);
    if (requirePhone === '1')                         contacts = contacts.filter(c => c.phone);
    if (requireEmail === '1' && requirePhone === '1') contacts = contacts.filter(c => c.email && c.phone);

    let csv = '﻿'; // BOM
    let filename;

    if (format === 'facebook') {
      // Colonnes exactes requises par Facebook Custom Audiences
      csv += 'email,phone,fn,ln,country,ct\n';
      csv += contacts.map(c => [
        escCsv(c.email),
        escCsv(normalizePhone(c.phone)),
        escCsv(c.prenom),
        escCsv(c.nom),
        escCsv('CG'),   // Code pays Congo
        escCsv(c.ville || 'Brazzaville'),
      ].join(',')).join('\n');
      filename = `facebook-audience-${Date.now()}.csv`;

    } else if (format === 'google') {
      // Colonnes exactes requises par Google Ads Customer Match
      csv += 'Email Address,Phone Number,First Name,Last Name\n';
      csv += contacts.map(c => [
        escCsv(c.email),
        escCsv(normalizePhone(c.phone)),
        escCsv(c.prenom),
        escCsv(c.nom),
      ].join(',')).join('\n');
      filename = `google-customer-match-${Date.now()}.csv`;

    } else if (format === 'whatsapp') {
      csv += 'Téléphone\n';
      csv += contacts
        .filter(c => c.phone)
        .map(c => escCsv(normalizePhone(c.phone)))
        .join('\n');
      filename = `whatsapp-contacts-${Date.now()}.csv`;

    } else {
      // Format standard
      csv += 'Prénom,Nom,Email,Téléphone,Source,Ville,Date inscription\n';
      csv += contacts.map(c => [
        escCsv(c.prenom),
        escCsv(c.nom),
        escCsv(c.email),
        escCsv(c.phone),
        escCsv(c.source),
        escCsv(c.ville),
        escCsv(c.date ? new Date(c.date).toLocaleDateString('fr-FR') : ''),
      ].join(',')).join('\n');
      filename = `contacts-altitudevision-${Date.now()}.csv`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

    // Log non-bloquant
    logAction({
      action:      'Export contacts marketing',
      description: `${contacts.length} contacts exportés au format ${format}`,
      module:      'Dashboard',
      typeAction:  'GÉNÉRATION_PDF',
      auteur:      buildAuteur(req.user),
      req,
    });

  } catch (err) {
    console.error('[Export] exportCsv:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
