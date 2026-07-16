const mongoose = require('mongoose');
const Estimation = require('../models/Estimation');
const MarketPriceReference = require('../models/MarketPriceReference');
const ConstructionCostReference = require('../models/ConstructionCostReference');
const ValuationCalculation = require('../models/ValuationCalculation');
const ValuationCoefficient = require('../models/ValuationCoefficient');
const Property = require('../models/Property');
const valuation = require('../services/propertyValuationService');
const { calculateComparableSimilarity } = require('../services/comparableSimilarityService');
const { detectValuationAnomalies, confidenceBreakdown } = require('../services/valuationAnomalyService');
const { renderHtml, generatePdf, disclaimer } = require('../services/valuationReportService');
const crypto = require('crypto');
const { buildMarketHistoryPipeline, finalizeMarketHistory } = require('../services/valuationMarketAnalyticsService');
const { VALUATION_PAGE_LIMITS } = require('../utils/valuationConstants');

const notFound = (res, message = 'Demande d\'estimation introuvable.') => res.status(404).json({ status: 'fail', message });
const validId = id => mongoose.isValidObjectId(id);
const asPlain = value => value?.toObject ? value.toObject() : value;
const boundedPage = query => ({ page: Math.max(1, Number.parseInt(query.page, 10) || 1), limit: Math.min(VALUATION_PAGE_LIMITS.max, Math.max(1, Number.parseInt(query.limit, 10) || VALUATION_PAGE_LIMITS.default)) });
const escapedRegex = value => new RegExp(String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const appendHistory = (estimation, to, userId, comment = '') => {
  const from = estimation.statut;
  if (from !== to) estimation.workflowHistory.push({ from, to, by: userId, comment });
  estimation.statut = to;
};
const selectedComparablePrice = item => item.priceType === 'conclu' ? Number(item.concludedPrice) : item.priceType === 'negocie' ? Number(item.negotiatedPrice) : Number(item.askingPrice);
const validateComparable = item => {
  const price = selectedComparablePrice(item); const surface = Number(item.landSurface || item.builtSurface); const weight = Number(item.weight);
  if (!String(item.source || '').trim() || !item.sourceType || !item.priceType) return 'Source, type de source et type de prix sont obligatoires.';
  if (!item.date || Number.isNaN(new Date(item.date).getTime())) return 'La date de référence est invalide.';
  if (!(price > 0) || !(surface > 0)) return 'Le prix et au moins une surface doivent être strictement positifs.';
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) return 'Le poids doit être compris entre 0 et 1.';
  if (item.latitude != null && item.latitude !== '' && (!Number.isFinite(Number(item.latitude)) || Number(item.latitude) < -90 || Number(item.latitude) > 90)) return 'La latitude est invalide.';
  if (item.longitude != null && item.longitude !== '' && (!Number.isFinite(Number(item.longitude)) || Number(item.longitude) < -180 || Number(item.longitude) > 180)) return 'La longitude est invalide.';
  if (item.included === false && !String(item.exclusionReason || '').trim()) return 'Une justification est obligatoire pour exclure un comparable.';
  if (item.priceType === 'conclu' && item.sourceType !== 'transaction_altimmo' && !String(item.notes || '').trim()) return 'Une justification est obligatoire pour déclarer un prix conclu sans transaction Altimmo.';
  return null;
};
const markCalculationInputsChanged = estimation => { if (estimation.currentCalculation) estimation.calculationInputUpdatedAt = new Date(); };
// Export déterministe utilisé par les tests de contrat ; les routes restent l'unique surface de mutation HTTP.
exports.validateComparableInput = validateComparable;

exports.getUnreadEstimationCount = async (_req, res) => {
  const unreadCount = await Estimation.countDocuments({ staffViewedAt: null });
  res.status(200).json({ status: 'success', data: { unreadCount } });
};

exports.getEstimation = async (req, res) => {
  if (!validId(req.params.id)) return notFound(res);
  const estimation = await Estimation.findById(req.params.id)
    .populate('traitePar validatedBy', 'name role')
    .populate('currentCalculation');
  if (!estimation) return notFound(res);
  if (!estimation.staffViewedAt) { estimation.staffViewedAt = new Date(); await estimation.save(); }
  return res.json({ status: 'success', data: { estimation } });
};

exports.updateEstimation = async (req, res) => {
  if (!validId(req.params.id)) return notFound(res);
  const estimation = await Estimation.findById(req.params.id);
  if (!estimation) return notFound(res);
  if (req.body.comparables) {
    for (const item of req.body.comparables) {
      const chosenPrice = item.priceType === 'conclu' ? item.concludedPrice : item.priceType === 'negocie' ? item.negotiatedPrice : item.askingPrice;
      const surface = Number(item.landSurface || item.builtSurface);
      if (!String(item.source || '').trim() || !item.sourceType || !item.priceType || !item.date || !(Number(chosenPrice) > 0) || !(surface > 0) || !(Number(item.pricePerSqm) > 0)) return res.status(422).json({ status: 'fail', message: 'Chaque comparable exige une source, un type de source, un type de prix, une date, une surface et un prix positifs.' });
      if (item.included === false && !String(item.exclusionReason || '').trim()) return res.status(422).json({ status: 'fail', message: 'Une justification est obligatoire pour exclure un comparable.' });
    }
  }
  const allowed = ['statut', 'noteInterne', 'referenceBien', 'usage', 'occupation', 'acquisitionYear', 'declaredValue', 'location', 'land', 'construction', 'rooms', 'equipment', 'documents', 'photos', 'comparables', 'expertAdjustments', 'reportDisclaimerAccepted'];
  allowed.forEach(key => { if (req.body[key] !== undefined) estimation[key] = req.body[key]; });
  if (req.body.location && estimation.comparables?.length) {
    estimation.comparables.forEach(item => {
      const scored = calculateComparableSimilarity({ estimation: asPlain(estimation), comparable: asPlain(item) });
      item.distance = scored.distance; item.similarity = scored.score; item.similarityDetails = scored.details;
    });
  }
  if (['location', 'land', 'construction', 'rooms', 'equipment', 'documents', 'photos', 'comparables', 'expertAdjustments'].some(key => req.body[key] !== undefined)) markCalculationInputsChanged(estimation);
  if (req.body.statut !== undefined) appendHistory(estimation, req.body.statut, req.user.id, req.body.statusComment || '');
  estimation.traitePar = req.user.id;
  await estimation.save(); await estimation.populate('traitePar', 'name');
  return res.json({ status: 'success', data: { estimation } });
};

const referenceFor = async (estimation) => {
  const loc = estimation.location || {};
  const query = { active: true, propertyType: estimation.typeBien, transactionType: estimation.transaction };
  if (loc.city) query.city = loc.city;
  let reference = await MarketPriceReference.findOne(query).sort({ neighborhood: -1, district: -1, updatedAt: -1 });
  if (!reference && loc.city) reference = await MarketPriceReference.findOne({ active: true, propertyType: estimation.typeBien, transactionType: estimation.transaction }).sort({ updatedAt: -1 });
  return reference;
};

exports.calculateEstimation = async (req, res) => {
  if (!validId(req.params.id)) return notFound(res);
  const estimation = await Estimation.findById(req.params.id);
  if (!estimation) return notFound(res);
  try {
    const reference = await referenceFor(estimation);
    const constructionRef = estimation.construction?.builtSurface > 0
      ? await ConstructionCostReference.findOne({ active: true, city: estimation.location?.city || '' }).sort({ updatedAt: -1 }) : null;
    const combinedCoefficient = (estimation.expertAdjustments || []).reduce((total, item) => total * (Number(item.coefficient) || 1), 1);
    const methods = [];
    const landSurface = estimation.land?.surface || (estimation.typeBien.includes('Terrain') ? estimation.surface : null);
    if (landSurface && reference) methods.push(valuation.calculateLandValue({ landSurface, reference, coefficient: combinedCoefficient }));
    if (estimation.construction?.builtSurface && constructionRef) methods.push(valuation.calculateReplacementCost({ builtSurface: estimation.construction.builtSurface, reference: constructionRef, depreciationRate: estimation.construction.depreciationRate || 0 }));
    const comparable = valuation.calculateComparableValue((estimation.comparables || []).filter(item => item.included !== false).map(item => asPlain(item)));
    if (comparable) methods.push(comparable);
    if (req.body.annualNetIncome && req.body.capitalizationRate) methods.push(valuation.calculateIncomeValue(req.body));
    const finalResult = valuation.calculateFinalRange(methods);
    const confidence = valuation.calculateConfidenceScore({ location: estimation.location, references: reference ? [reference] : [], documents: estimation.documents || [], photos: estimation.photos || [], physicalVisit: Boolean(req.body.physicalVisit), requiredFields: [estimation.typeBien, estimation.surface, estimation.location?.city || estimation.adresse] });
    const version = (await ValuationCalculation.countDocuments({ estimationId: estimation._id })) + 1;
    const calculation = await ValuationCalculation.create({ estimationId: estimation._id, version, inputSnapshot: asPlain(estimation), marketReferenceSnapshot: [reference, constructionRef].filter(Boolean).map(asPlain), coefficientsSnapshot: asPlain(estimation.expertAdjustments || []), methodsResults: methods, finalResult: { marketValue: finalResult, rental: req.body.monthlyRent ? valuation.calculateRentalEstimate({ monthlyRent: req.body.monthlyRent, annualCharges: req.body.annualCharges, propertyValue: finalResult.recommended }) : null, warnings: confidence.warnings }, confidenceScore: confidence.score, calculatedBy: req.user.id });
    estimation.currentCalculation = calculation._id; estimation.calculationInputUpdatedAt = null; appendHistory(estimation, 'Calcul automatique terminé', req.user.id, req.body.reasonForAdjustment || 'Calcul du laboratoire'); estimation.traitePar = req.user.id; await estimation.save();
    return res.status(201).json({ status: 'success', data: { calculation, estimation } });
  } catch (error) { return res.status(422).json({ status: 'fail', message: error.message }); }
};

exports.getCalculations = async (req, res) => {
  if (!validId(req.params.id)) return notFound(res);
  if (!await Estimation.exists({ _id: req.params.id })) return notFound(res);
  const calculations = await ValuationCalculation.find({ estimationId: req.params.id }).sort({ version: -1 }).populate('calculatedBy validatedBy', 'name');
  return res.json({ status: 'success', data: { calculations } });
};

exports.validateEstimation = async (req, res) => {
  if (!validId(req.params.id)) return notFound(res);
  const estimation = await Estimation.findById(req.params.id); if (!estimation || !estimation.currentCalculation) return notFound(res, 'Calcul d\'estimation introuvable.');
  const calculation = await ValuationCalculation.findById(estimation.currentCalculation); calculation.validatedBy = req.user.id; calculation.validatedAt = new Date(); calculation.reasonForAdjustment = req.body.comment || calculation.reasonForAdjustment; await calculation.save();
  estimation.validatedBy = req.user.id; estimation.validatedAt = new Date(); appendHistory(estimation, 'Validée', req.user.id, req.body.comment || 'Validation expert'); await estimation.save();
  return res.json({ status: 'success', data: { estimation, calculation } });
};

exports.createMarketReference = async (req, res) => { const reference = await MarketPriceReference.create({ ...req.body, updatedBy: req.user.id, lastUpdatedAt: new Date() }); res.status(201).json({ status: 'success', data: { reference } }); };
exports.updateMarketReference = async (req, res) => { if (!validId(req.params.id)) return notFound(res, 'Référence introuvable.'); const reference = await MarketPriceReference.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user.id, lastUpdatedAt: new Date() }, { new: true, runValidators: true }); if (!reference) return notFound(res, 'Référence introuvable.'); res.json({ status: 'success', data: { reference } }); };

const filteredQuery = (query, fields) => Object.fromEntries(fields.filter(field => query[field] !== undefined && query[field] !== '').map(field => [field, query[field]]));
exports.listMarketReferences = async (req, res) => {
  const filter = filteredQuery(req.query, ['city', 'district', 'neighborhood', 'microZone', 'propertyType', 'transactionType', 'sourceType', 'confidenceLevel', 'active']);
  if (req.query.q) filter.$or = ['city', 'district', 'neighborhood', 'dataSource'].map(field => ({ [field]: { $regex: req.query.q, $options: 'i' } }));
  if (req.query.validAt) filter.$and = [{ validFrom: { $lte: new Date(req.query.validAt) } }, { $or: [{ validTo: null }, { validTo: { $gte: new Date(req.query.validAt) } }] }];
  const references = await MarketPriceReference.find(filter).populate('updatedBy', 'name').sort({ updatedAt: -1 });
  res.json({ status: 'success', data: { references } });
};
exports.deactivateMarketReference = async (req, res) => { if (!validId(req.params.id)) return notFound(res, 'Référence introuvable.'); const reference = await MarketPriceReference.findByIdAndUpdate(req.params.id, { active: false, updatedBy: req.user.id, lastUpdatedAt: new Date() }, { new: true }); if (!reference) return notFound(res, 'Référence introuvable.'); res.json({ status: 'success', data: { reference } }); };
exports.listConstructionCosts = async (req, res) => { const costs = await ConstructionCostReference.find(filteredQuery(req.query, ['city', 'constructionCategory', 'buildingUse', 'materialsLevel', 'confidenceLevel', 'active'])).sort({ updatedAt: -1 }); res.json({ status: 'success', data: { costs } }); };
exports.createConstructionCost = async (req, res) => { const cost = await ConstructionCostReference.create(req.body); res.status(201).json({ status: 'success', data: { cost } }); };
exports.updateConstructionCost = async (req, res) => { if (!validId(req.params.id)) return notFound(res, 'Coût introuvable.'); const cost = await ConstructionCostReference.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!cost) return notFound(res, 'Coût introuvable.'); res.json({ status: 'success', data: { cost } }); };
exports.listCoefficients = async (req, res) => { const coefficients = await ValuationCoefficient.find(filteredQuery(req.query, ['category', 'city', 'district', 'active'])).populate('updatedBy', 'name').sort({ category: 1, code: 1 }); res.json({ status: 'success', data: { coefficients } }); };
exports.createCoefficient = async (req, res) => { const coefficient = await ValuationCoefficient.create({ ...req.body, updatedBy: req.user.id }); res.status(201).json({ status: 'success', data: { coefficient } }); };
exports.updateCoefficient = async (req, res) => { if (!validId(req.params.id)) return notFound(res, 'Coefficient introuvable.'); const coefficient = await ValuationCoefficient.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user.id }, { new: true, runValidators: true }); if (!coefficient) return notFound(res, 'Coefficient introuvable.'); res.json({ status: 'success', data: { coefficient } }); };
exports.scoreComparable = async (req, res) => { if (!validId(req.params.id)) return notFound(res); const estimation = await Estimation.findById(req.params.id); if (!estimation) return notFound(res); const result = calculateComparableSimilarity({ estimation: asPlain(estimation), comparable: req.body }); res.json({ status: 'success', data: result }); };
exports.searchInternalComparables = async (req, res) => {
  if (!validId(req.params.id)) return notFound(res);
  const estimation = await Estimation.findById(req.params.id).select('typeBien transaction location land construction surface comparables').lean();
  if (!estimation) return notFound(res);
  const { page, limit } = boundedPage(req.query); const filter = { pole: 'Altimmo', statusAdmin: 'Validée', availability: 'Disponible' };
  if (req.query.city) filter['address.city'] = escapedRegex(req.query.city);
  if (req.query.district) filter['address.arrondissement'] = escapedRegex(req.query.district);
  if (req.query.propertyType) filter.type = req.query.propertyType;
  if (req.query.transactionType) filter.status = req.query.transactionType;
  if (Number(req.query.minPrice) >= 0) filter.price = { $gte: Number(req.query.minPrice) };
  if (Number(req.query.maxPrice) > 0) filter.price = { ...(filter.price || {}), $lte: Number(req.query.maxPrice) };
  if (Number(req.query.minSurface) > 0) filter.surface = { $gte: Number(req.query.minSurface) };
  if (Number(req.query.maxSurface) > 0) filter.surface = { ...(filter.surface || {}), $lte: Number(req.query.maxSurface) };
  if (req.query.q) filter.$or = [{ title: escapedRegex(req.query.q) }, { type: escapedRegex(req.query.q) }, { 'address.city': escapedRegex(req.query.q) }, { 'address.arrondissement': escapedRegex(req.query.q) }];
  if (req.query.radius && Number(req.query.radius) > 0 && Number.isFinite(estimation.location?.latitude) && Number.isFinite(estimation.location?.longitude)) filter.location = { $geoWithin: { $centerSphere: [[estimation.location.longitude, estimation.location.latitude], Math.min(100, Number(req.query.radius)) / 6371] } };
  const query = Property.find(filter).select('_id title type status price surface availability statusAdmin address.city address.arrondissement latitude longitude createdAt constructionType').sort('-createdAt').skip((page - 1) * limit).limit(limit).lean();
  const [properties, total] = await Promise.all([query, Property.countDocuments(filter)]);
  const items = properties.map(property => { const comparable = { source: 'Annonce Altimmo', sourceType: 'annonce_altimmo', internalReference: String(property._id), propertyId: property._id, sourceConfidence: 'moyen', city: property.address?.city || '', district: property.address?.arrondissement || '', propertyType: property.type, builtSurface: property.type === 'Terrain' ? 0 : property.surface, landSurface: property.type === 'Terrain' ? property.surface : 0, askingPrice: property.price, priceType: 'demande', pricePerSqm: property.surface > 0 ? Number((property.price / property.surface).toFixed(2)) : null, date: property.createdAt, condition: property.constructionType || '', latitude: property.latitude, longitude: property.longitude }; return { ...property, valuation: { ...calculateComparableSimilarity({ estimation, comparable }), pricePerSqm: comparable.pricePerSqm }, alreadyAdded: (estimation.comparables || []).some(item => String(item.propertyId || '') === String(property._id)) }; });
  res.json({ status: 'success', data: { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
};
exports.addInternalComparable = async (req, res) => {
  if (!validId(req.params.id) || !validId(req.body.propertyId)) return res.status(422).json({ status: 'fail', message: 'Identifiant de dossier ou d’annonce invalide.' });
  const [estimation, property] = await Promise.all([Estimation.findById(req.params.id), Property.findOne({ _id: req.body.propertyId, pole: 'Altimmo', statusAdmin: 'Validée' }).select('_id title type status price surface address.city address.arrondissement latitude longitude createdAt constructionType').lean()]);
  if (!estimation || !property) return notFound(res, 'Dossier ou annonce Altimmo introuvable.');
  if ((estimation.comparables || []).some(item => String(item.propertyId || '') === String(property._id))) return res.status(409).json({ status: 'fail', message: 'Cette annonce est déjà utilisée comme comparable.' });
  if (!(property.price > 0 && property.surface > 0)) return res.status(422).json({ status: 'fail', message: 'L’annonce ne possède pas de prix et surface exploitables.' });
  const comparable = { source: property.title || 'Annonce Altimmo', sourceType: 'annonce_altimmo', internalReference: String(property._id), propertyId: property._id, sourceConfidence: 'moyen', city: property.address?.city || '', district: property.address?.arrondissement || '', propertyType: property.type, landSurface: property.type === 'Terrain' ? property.surface : 0, builtSurface: property.type === 'Terrain' ? 0 : property.surface, priceType: 'demande', askingPrice: property.price, pricePerSqm: Number((property.price / property.surface).toFixed(2)), date: property.createdAt, condition: property.constructionType || '', latitude: property.latitude, longitude: property.longitude, included: true, notes: 'Snapshot d’une annonce Altimmo validée ; prix demandé, non assimilé à une transaction conclue.' };
  const scored = calculateComparableSimilarity({ estimation: asPlain(estimation), comparable }); Object.assign(comparable, { similarity: scored.score, similarityDetails: scored.details, distance: scored.distance, weight: scored.suggestedWeight });
  estimation.comparables.push(comparable); markCalculationInputsChanged(estimation); await estimation.save();
  res.status(201).json({ status: 'success', data: { estimation, comparable: estimation.comparables.at(-1), warnings: ['Prix demandé : cette annonce ne constitue pas une transaction conclue.', ...scored.warnings] } });
};
exports.updateComparable = async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.comparableId)) return res.status(422).json({ status: 'fail', message: 'Identifiant invalide.' });
  const estimation = await Estimation.findById(req.params.id); if (!estimation) return notFound(res);
  const comparable = estimation.comparables.id(req.params.comparableId); if (!comparable) return notFound(res, 'Comparable introuvable.');
  const allowed = ['source', 'sourceType', 'priceType', 'internalReference', 'date', 'city', 'district', 'neighborhood', 'microZone', 'latitude', 'longitude', 'propertyType', 'condition', 'landSurface', 'builtSurface', 'askingPrice', 'negotiatedPrice', 'concludedPrice', 'sourceConfidence', 'weight', 'notes', 'included', 'exclusionReason'];
  allowed.forEach(key => { if (req.body[key] !== undefined) comparable[key] = req.body[key] === '' && ['latitude', 'longitude'].includes(key) ? undefined : req.body[key]; });
  const validationError = validateComparable(comparable); if (validationError) return res.status(422).json({ status: 'fail', message: validationError });
  const surface = Number(comparable.landSurface || comparable.builtSurface); comparable.pricePerSqm = Number((selectedComparablePrice(comparable) / surface).toFixed(2));
  const scored = calculateComparableSimilarity({ estimation: asPlain(estimation), comparable: asPlain(comparable) }); comparable.distance = scored.distance; comparable.similarity = scored.score; comparable.similarityDetails = { ...scored.details, explanation: scored.explanation, suggestedWeight: scored.suggestedWeight };
  markCalculationInputsChanged(estimation); await estimation.save();
  res.json({ status: 'success', data: { estimation, comparable, calculationStale: Boolean(estimation.currentCalculation) } });
};
exports.deleteComparable = async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.comparableId)) return res.status(422).json({ status: 'fail', message: 'Identifiant invalide.' });
  const estimation = await Estimation.findById(req.params.id); if (!estimation) return notFound(res);
  const comparable = estimation.comparables.id(req.params.comparableId); if (!comparable) return notFound(res, 'Comparable introuvable.');
  comparable.deleteOne(); markCalculationInputsChanged(estimation); await estimation.save();
  res.json({ status: 'success', data: { estimation, calculationStale: Boolean(estimation.currentCalculation) } });
};
exports.getMarketHistory = async (req, res) => {
  const rows = await MarketPriceReference.aggregate(buildMarketHistoryPipeline({ period: req.query.period, filters: req.query }));
  res.json({ status: 'success', data: { series: finalizeMarketHistory(rows) } });
};
exports.getLaboratoryStatistics = async (req, res) => {
  const match = {}; if (req.query.status) match.statut = req.query.status; if (req.query.city) match['location.city'] = req.query.city; if (req.query.propertyType) match.typeBien = req.query.propertyType;
  if (req.query.from || req.query.to) match.createdAt = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(req.query.to) }) };
  const [summary, byStatus, byType, byCity] = await Promise.all([
    Estimation.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$staffViewedAt', null] }, 1, 0] } }, averageProcessingDays: { $avg: { $divide: [{ $subtract: [{ $ifNull: ['$publishedAt', '$$NOW'] }, '$createdAt'] }, 86400000] } } } }]),
    Estimation.aggregate([{ $match: match }, { $group: { _id: '$statut', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Estimation.aggregate([{ $match: match }, { $group: { _id: '$typeBien', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Estimation.aggregate([{ $match: match }, { $group: { _id: { $ifNull: ['$location.city', 'Non renseignée'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);
  const validated = await Estimation.find({ ...match, validatedAt: { $ne: null } }).select('currentCalculation').populate({ path: 'currentCalculation', select: 'confidenceScore finalResult methodsResults' }).lean();
  const calculations = validated.map(item => item.currentCalculation).filter(Boolean); const ranges = calculations.map(item => item.finalResult?.marketValue).filter(Boolean);
  res.json({ status: 'success', data: { summary: { ...(summary[0] || { total: 0, unread: 0, averageProcessingDays: 0 }), validatedCalculations: calculations.length, confidenceAverage: calculations.length ? Number((calculations.reduce((sum, item) => sum + (item.confidenceScore || 0), 0) / calculations.length).toFixed(2)) : null, values: { low: ranges.reduce((sum, item) => sum + (item.low || 0), 0), recommended: ranges.reduce((sum, item) => sum + (item.recommended || 0), 0), high: ranges.reduce((sum, item) => sum + (item.high || 0), 0) } }, byStatus, byType, byCity } });
};
exports.compareEstimations = async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids)] : [];
  if (ids.length < 2 || ids.length > VALUATION_PAGE_LIMITS.comparisonMax || ids.some(id => !validId(id))) return res.status(422).json({ status: 'fail', message: 'Sélectionnez entre 2 et 4 identifiants valides.' });
  const items = await Estimation.find({ _id: { $in: ids } }).select('referenceBien statut typeBien surface location.city location.district location.neighborhood land.surface construction.builtSurface construction.condition documents comparables currentCalculation').populate({ path: 'currentCalculation', select: 'finalResult confidenceScore methodsResults' }).lean();
  if (items.length !== ids.length) return res.status(404).json({ status: 'fail', message: 'Un ou plusieurs dossiers sont introuvables.' });
  const safe = items.map(item => { const value = item.currentCalculation?.finalResult?.marketValue || null; const surface = Number(item.surface); return { id: item._id, reference: item.referenceBien || String(item._id).slice(-8).toUpperCase(), status: item.statut, propertyType: item.typeBien, location: item.location, surface: item.surface, landSurface: item.land?.surface || null, builtSurface: item.construction?.builtSurface || null, condition: item.construction?.condition || null, value, pricePerSqm: value?.recommended > 0 && surface > 0 ? Math.round(value.recommended / surface) : null, confidenceScore: item.currentCalculation?.confidenceScore ?? null, methods: (item.currentCalculation?.methodsResults || []).map(method => method.method), rentalYield: item.currentCalculation?.finalResult?.rental?.netYield ?? null, verifiedDocuments: (item.documents || []).filter(document => document.verified).length, comparableCount: (item.comparables || []).filter(comparable => comparable.included !== false).length }; });
  res.json({ status: 'success', data: { estimations: safe } });
};
exports.getExpertAnalysis = async (req, res) => { if (!validId(req.params.id)) return notFound(res); const estimation = await Estimation.findById(req.params.id).populate('currentCalculation'); if (!estimation) return notFound(res); const anomalies = detectValuationAnomalies({ estimation: asPlain(estimation), calculation: asPlain(estimation.currentCalculation) }); res.json({ status: 'success', data: { anomalies, confidence: confidenceBreakdown(asPlain(estimation)) } }); };
exports.adjustExpertValue = async (req, res) => { if (!validId(req.params.id)) return notFound(res); const estimation = await Estimation.findById(req.params.id).populate('currentCalculation'); if (!estimation?.currentCalculation) return notFound(res, 'Calcul d\'estimation introuvable.'); const adjustedValue = Number(req.body.adjustedValue); const automaticValue = Number(estimation.currentCalculation.finalResult?.marketValue?.recommended); if (!Number.isFinite(adjustedValue) || adjustedValue <= 0 || !String(req.body.justification || '').trim()) return res.status(422).json({ status: 'fail', message: 'Une valeur positive et une justification sont obligatoires.' }); if (!(automaticValue > 0)) return res.status(422).json({ status: 'fail', message: 'La valeur automatique de référence est invalide.' }); const difference = adjustedValue - automaticValue; const entry = { automaticValue, adjustedValue, difference, differencePercent: Number(((difference / automaticValue) * 100).toFixed(2)), justification: req.body.justification.trim(), adjustedBy: req.user.id, adjustedAt: new Date() }; estimation.expertValueAdjustment = entry; estimation.expertValueAdjustmentHistory.push(entry); appendHistory(estimation, 'Révision expert', req.user.id, req.body.justification.trim()); await estimation.save(); res.json({ status: 'success', data: { estimation, warning: Math.abs(difference / automaticValue) > .2 ? 'Écart supérieur à 20 % : justification renforcée requise.' : null } }); };
exports.publishEstimation = async (req, res) => {
  if (!validId(req.params.id)) return notFound(res);
  const estimation = await Estimation.findById(req.params.id).populate('currentCalculation'); if (!estimation || estimation.statut !== 'Validée' || !estimation.currentCalculation) return res.status(422).json({ status: 'fail', message: 'Une estimation validée avec calcul est requise avant publication.' });
  const blocking = detectValuationAnomalies({ estimation: asPlain(estimation), calculation: asPlain(estimation.currentCalculation) }).filter(item => item.level === 'critical');
  if (blocking.length) return res.status(422).json({ status: 'fail', message: 'Publication bloquée par des anomalies critiques.', data: { anomalies: blocking } });
  const verificationCode = `ALT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  estimation.report = { verificationCode, verificationHash: crypto.createHash('sha256').update(verificationCode).digest('hex'), publishedCalculation: estimation.currentCalculation, publishedAt: new Date(), validUntil: req.body.validUntil || null };
  estimation.publishedAt = estimation.report.publishedAt; appendHistory(estimation, 'Rapport publié', req.user.id, req.body.comment || 'Publication du rapport'); await estimation.save();
  return res.json({ status: 'success', data: { estimation, verificationCode, disclaimer } });
};
exports.renderReportHtml = async (req, res) => { if (!validId(req.params.id)) return notFound(res); const estimation = await Estimation.findById(req.params.id).populate('currentCalculation report.publishedCalculation'); if (!estimation?.report?.publishedCalculation) return notFound(res, 'Rapport publié introuvable.'); res.type('html').send(renderHtml(estimation)); };
exports.downloadReportPdf = async (req, res) => { if (!validId(req.params.id)) return notFound(res); const estimation = await Estimation.findById(req.params.id).populate('currentCalculation report.publishedCalculation'); if (!estimation?.report?.publishedCalculation) return notFound(res, 'Rapport publié introuvable.'); const pdf = await generatePdf(estimation); res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="rapport-${estimation.report.verificationCode}.pdf"` }).send(pdf); };
exports.verifyReport = async (req, res) => { const estimation = await Estimation.findOne({ 'report.verificationCode': req.params.code, 'report.revokedAt': null }).populate('report.publishedCalculation'); if (!estimation?.report?.publishedCalculation) return res.status(404).json({ status: 'fail', message: 'Rapport introuvable ou révoqué.' }); const calculation = estimation.report.publishedCalculation; res.json({ status: 'success', data: { reference: estimation.referenceBien || String(estimation._id).slice(-8).toUpperCase(), publicationDate: estimation.report.publishedAt, propertyType: estimation.typeBien, city: estimation.location?.city || null, status: estimation.statut, version: calculation.version, issuer: 'Altitude Vision' } }); };
