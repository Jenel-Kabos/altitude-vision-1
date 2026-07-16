const { MIN_MARKET_TREND_SAMPLE_SIZE } = require('../utils/valuationConstants');

const PERIOD_FORMATS = { month: '%Y-%m', quarter: '%Y-Q', year: '%Y' };
const confidenceValue = { faible: 1, moyen: 2, bon: 3, 'élevé': 4 };

const buildMarketHistoryPipeline = ({ period = 'month', filters = {} } = {}) => {
  const match = { active: true };
  ['city', 'district', 'neighborhood', 'microZone', 'propertyType', 'transactionType', 'priceType', 'sourceType'].forEach(key => { if (filters[key]) match[key] = filters[key]; });
  if (filters.from || filters.to) match.validFrom = { ...(filters.from && { $gte: new Date(filters.from) }), ...(filters.to && { $lte: new Date(filters.to) }) };
  const dateFormat = period === 'quarter' ? null : PERIOD_FORMATS[period] || PERIOD_FORMATS.month;
  const periodExpression = dateFormat ? { $dateToString: { format: dateFormat, date: '$validFrom' } } : { $concat: [{ $dateToString: { format: '%Y-Q', date: '$validFrom' } }, { $toString: { $ceil: { $divide: [{ $month: '$validFrom' }, 3] } } }] };
  return [
    { $match: match },
    { $addFields: { confidenceNumeric: { $switch: { branches: Object.entries(confidenceValue).map(([key, value]) => ({ case: { $eq: ['$confidenceLevel', key] }, then: value })), default: 1 } } } },
    { $group: { _id: { period: periodExpression, priceType: '$priceType' }, average: { $avg: '$averagePricePerSqm' }, minimum: { $min: '$minPricePerSqm' }, maximum: { $max: '$maxPricePerSqm' }, sampleSize: { $sum: { $max: ['$sampleSize', 1] } }, referenceCount: { $sum: 1 }, confidenceAverage: { $avg: '$confidenceNumeric' }, dispersion: { $stdDevPop: '$averagePricePerSqm' } } },
    { $sort: { '_id.priceType': 1, '_id.period': 1 } },
  ];
};

const finalizeMarketHistory = rows => {
  const previous = new Map();
  return rows.map(row => {
    const priceType = row._id.priceType || 'demande'; const prior = previous.get(priceType);
    const sufficient = row.sampleSize >= MIN_MARKET_TREND_SAMPLE_SIZE;
    const priorSufficient = prior?.sampleSize >= MIN_MARKET_TREND_SAMPLE_SIZE && prior.average > 0;
    const variation = sufficient && priorSufficient ? Number((((row.average - prior.average) / prior.average) * 100).toFixed(2)) : null;
    previous.set(priceType, row);
    return { period: row._id.period, priceType, average: Math.round(row.average), minimum: row.minimum, maximum: row.maximum, sampleSize: row.sampleSize, referenceCount: row.referenceCount, dispersion: Math.round(row.dispersion || 0), confidenceAverage: Number((row.confidenceAverage || 0).toFixed(2)), insufficientData: !sufficient, variation };
  });
};

module.exports = { buildMarketHistoryPipeline, finalizeMarketHistory };
