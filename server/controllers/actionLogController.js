// server/controllers/actionLogController.js
const ActionLog = require('../models/ActionLog');
// ERP-CORE-1 (Phase 7) — filtre additif par organisation : ActionLog ne
// stocke aucune référence à OrgUnit (et n'en a pas besoin), donc jamais une
// seconde jointure inventée — on réutilise organizationService.
// getScopeUserIds (ORGANIZATION-1, déjà agrégé) pour résoudre l'unité en un
// ensemble d'utilisateurs, puis on post-filtre sur `auteur.id`, exactement
// le même schéma déjà appliqué au pipeline CRM par reportingService.js.
const { getScopeUserIds } = require('../services/organizationService');

// ── GET /api/action-logs ──────────────────────────────────────
exports.getLogs = async (req, res) => {
  try {
    const {
      page      = 1,
      limit     = 50,
      module:   mod,
      typeAction,
      auteurId,
      orgUnitId,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const filter = {};
    if (mod)        filter.module     = mod;
    if (typeAction) filter.typeAction = typeAction;
    if (auteurId)   filter['auteur.id'] = auteurId;
    if (orgUnitId) {
      const scopeUserIds = await getScopeUserIds(orgUnitId).catch(() => null);
      // Résolution en échec ou unité vide : ne renvoie jamais tout
      // silencieusement — un $in sur un tableau vide ne matche rien,
      // jamais une approximation qui montrerait des logs hors périmètre.
      filter['auteur.id'] = { $in: [...(scopeUserIds || [])] };
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo)   filter.date.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { action:      re },
        { description: re },
        { 'auteur.nom':  re },
        { 'auteur.email': re },
        { 'cible.nom':   re },
      ];
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await ActionLog.countDocuments(filter);
    const logs  = await ActionLog.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      status:  'success',
      results: logs.length,
      total,
      page:    parseInt(page),
      pages:   Math.ceil(total / parseInt(limit)),
      data:    { logs },
    });
  } catch (err) {
    console.error('[ActionLog] getLogs:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── GET /api/action-logs/stats ────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const [byModule, byType, byDay, total] = await Promise.all([
      ActionLog.aggregate([
        { $match: { date: { $gte: since } } },
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),
      ActionLog.aggregate([
        { $match: { date: { $gte: since } } },
        { $group: { _id: '$typeAction', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]),
      ActionLog.aggregate([
        { $match: { date: { $gte: since } } },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ActionLog.countDocuments({ date: { $gte: since } }),
    ]);

    res.json({
      status: 'success',
      data:   { total, byModule, byType, byDay },
    });
  } catch (err) {
    console.error('[ActionLog] getStats:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── GET /api/action-logs/recent ───────────────────────────────
exports.getRecent = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const logs = await ActionLog.find({})
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ status: 'success', data: { logs } });
  } catch (err) {
    console.error('[ActionLog] getRecent:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── GET /api/action-logs/export ───────────────────────────────
exports.exportCsv = async (req, res) => {
  try {
    const {
      module: mod,
      typeAction,
      dateFrom,
      dateTo,
    } = req.query;

    const filter = {};
    if (mod)        filter.module     = mod;
    if (typeAction) filter.typeAction = typeAction;
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo)   filter.date.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const logs = await ActionLog.find(filter).sort({ date: -1 }).limit(5000).lean();

    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(';') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const header = ['Date', 'Module', 'Type', 'Action', 'Description', 'Auteur', 'Email', 'Rôle', 'Cible', 'IP'].join(';');
    const rows = logs.map(l => [
      l.date ? new Date(l.date).toLocaleString('fr-FR') : '',
      l.module     || '',
      l.typeAction || '',
      l.action     || '',
      l.description || '',
      l.auteur?.nom   || '',
      l.auteur?.email || '',
      l.auteur?.role  || '',
      l.cible?.nom || l.cible?.id || '',
      l.metadata?.ip || '',
    ].map(escape).join(';'));

    const csv = '﻿' + [header, ...rows].join('\n'); // BOM for Excel

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="historique_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[ActionLog] exportCsv:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
