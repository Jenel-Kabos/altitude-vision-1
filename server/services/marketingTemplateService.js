// MARKETING-AUTOMATION-1 (Phase 6) — Modèles de messages : versionnement,
// rendu de variables, prévisualisation. Substitution `{{variable}}` simple
// et volontairement non-Turing-complète (pas de logique conditionnelle) —
// un message marketing n'a jamais besoin de plus, et ça évite toute
// injection de code côté template.
const MarketingTemplate = require('../models/MarketingTemplate');

class TemplateError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.name = 'TemplateError'; this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, statusCode) => { throw new TemplateError(code, message, statusCode); };

function render(text, variables = {}) {
  return (text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match
  ));
}

function renderTemplate(template, variables = {}) {
  return { subject: render(template.subject, variables), body: render(template.body, variables) };
}

// Crée une nouvelle version d'une famille de modèle. Si une version 'active'
// existe déjà pour cette famille, elle est archivée (jamais supprimée) et
// remplacée — jamais une édition en place d'un document déjà potentiellement
// référencé par un MarketingSend passé (voir modèle, `previousVersion`).
async function createTemplateVersion({ family, name, channel, subject, body, variables, actor } = {}) {
  if (!family || !name || !channel || !body) fail('TEMPLATE_FIELDS_REQUIRED', 'family, name, channel et body sont requis.', 422);
  const previous = await MarketingTemplate.findOne({ family, status: 'active' }).sort({ version: -1 });
  const template = await MarketingTemplate.create({
    family, name, channel, subject, body, variables: variables || [],
    version: previous ? previous.version + 1 : 1,
    previousVersion: previous?._id || null,
    status: 'draft',
    createdBy: actor?._id || actor?.id || null,
  });
  return template;
}

async function activateTemplate(id, { actor } = {}) {
  const template = await MarketingTemplate.findById(id);
  if (!template) fail('TEMPLATE_NOT_FOUND', 'Modèle introuvable.', 404);
  await MarketingTemplate.updateMany({ family: template.family, status: 'active' }, { status: 'archived' });
  template.status = 'active';
  template.updatedBy = actor?._id || actor?.id || null;
  await template.save();
  return template;
}

async function previewTemplate(id, variables = {}) {
  const template = await MarketingTemplate.findById(id).lean();
  if (!template) fail('TEMPLATE_NOT_FOUND', 'Modèle introuvable.', 404);
  return { template, preview: renderTemplate(template, variables) };
}

async function listTemplateHistory(family) {
  return MarketingTemplate.find({ family }).sort({ version: -1 }).lean();
}

async function listActiveTemplates() {
  return MarketingTemplate.find({ status: 'active' }).sort({ name: 1 }).lean();
}

module.exports = { TemplateError, render, renderTemplate, createTemplateVersion, activateTemplate, previewTemplate, listTemplateHistory, listActiveTemplates };
