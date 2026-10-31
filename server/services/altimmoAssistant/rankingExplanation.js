const LABELS = Object.freeze({
  parking: 'Parking', pool: 'Piscine', garden: 'Jardin', terrace: 'Terrasse',
  air_conditioning: 'Climatisation', wifi: 'Wi-Fi', security: 'Sécurité',
  generator: 'Groupe électrogène', borehole: 'Forage', furnished: 'Meublé',
  equipped_kitchen: 'Cuisine équipée',
});
const PERIOD_LABELS = Object.freeze({ TOTAL: '', MONTH: ' par mois', NIGHT: ' par nuit' });
const formatAmount = (amount) => String(Math.round(Number(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

const alternativeLabel = (options) => (Array.isArray(options) && options.every((option) => option.every((key) => LABELS[key]))
  ? options.map((option) => option.map((key) => LABELS[key].toLowerCase()).join(' et ')).join(' ou ') : null);

function contributionText(item) {
  if (item.kind === 'AMENITY_ANY') {
    const label = alternativeLabel(item.options);
    if (!label) return null;
    if (item.state === 'TRUE') return `Option confirmée parmi : ${label}.`;
    if (item.state === 'FALSE') return `Aucune option disponible parmi : ${label}.`;
    return `Options non vérifiables avec les données disponibles : ${label}.`;
  }
  if (item.kind === 'AMENITY') {
    const label = LABELS[item.key];
    if (!label) return null;
    if (item.state === 'TRUE') return `${label} confirmé.`;
    if (item.state === 'FALSE') return `${label} explicitement non satisfait.`;
    return `${label} non vérifiable avec les données disponibles.`;
  }
  if (item.kind === 'PRICE_TARGET') {
    const target = `${formatAmount(item.target)} ${item.currency}${PERIOD_LABELS[item.period] || ''}`;
    if (item.state === 'TRUE') return `Prix conforme à la cible explicite de ${target}.`;
    if (item.state === 'FALSE') return `Prix différent de la cible explicite de ${target}.`;
    return `Compatibilité avec la cible de prix ${target} non vérifiable.`;
  }
  return null;
}

function criterionName(item) {
  if (item.kind === 'AMENITY_ANY') return `amenity_any.${item.key}`;
  return item.kind === 'AMENITY' ? `amenity.${item.key}` : item.kind === 'PRICE_TARGET' ? 'price_target' : 'unsupported';
}

function buildRankingExplanation(evaluation = {}) {
  const favorable = []; const unfavorable = []; const toVerify = []; const provenance = [];
  for (const item of Array.isArray(evaluation.contributions) ? evaluation.contributions : []) {
    const text = contributionText(item); if (!text) continue;
    if (item.state === 'TRUE') favorable.push(text);
    else if (item.state === 'FALSE') unfavorable.push(text);
    else toVerify.push(text);
    provenance.push({ criterion: criterionName(item), source: item.source || null, state: item.state });
  }
  const tradeoffs = [];
  if (favorable.length && (unfavorable.length || toVerify.length)) {
    let sentence = `Le bien confirme ${plural(favorable.length, 'préférence', 'préférences')}`;
    if (unfavorable.length) sentence += `, mais ${plural(unfavorable.length, 'autre n’est pas satisfaite', 'autres ne sont pas satisfaites')}`;
    if (toVerify.length) sentence += `${unfavorable.length ? ' et' : ', mais'} ${plural(toVerify.length, 'reste à vérifier', 'restent à vérifier')}`;
    tradeoffs.push(`${sentence}.`);
  }
  const noReliableSignal = Number(evaluation.confidence) === 0;
  return {
    summary: noReliableSignal
      ? 'Les données disponibles ne permettent pas de départager ce bien de manière fiable.'
      : favorable.length ? `${plural(favorable.length, 'préférence confirmée', 'préférences confirmées')}.` : 'Aucune préférence confirmée.',
    favorable, unfavorable, toVerify, tradeoffs, provenance,
    warnings: (evaluation.warnings || []).filter((item) => item && typeof item.code === 'string').map((item) => ({ code: item.code })),
  };
}

module.exports = { buildRankingExplanation };
