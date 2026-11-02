'use strict';
// Interprétation déterministe des critères explicites d'un message français.
// Aucune valeur n'est déduite : ce qui est ambigu reste dans `ambiguity`.
const { AMENITIES, CITIES, DISTRICTS } = require('./conversationState');

const { classifyIntent } = require('./intentModel');

const MAX_LENGTH = 1000;
const WORD_NUMBERS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8 };
const TYPES = [['maison', 'Maison'], ['villa', 'Villa'], ['appartement', 'Appartement'], ['studio', 'Studio'], ['terrain', 'Terrain'], ['duplex', 'Duplex'], ['commerce', 'Commerce'], ['local commercial', 'Commerce'], ['bureau', 'Bureau'], ['hotel', 'Hôtel']];
const AMENITY_SYNONYMS = [['groupe electrogene', 'groupe électrogène'], ['cour', 'cour'], ['parking', 'parking'], ['stationnement', 'parking'], ['jardin', 'jardin'], ['piscine', 'piscine'], ['climatisation', 'climatisation'], ['climatise', 'climatisation'], ['clim', 'climatisation'], ['garage', 'garage'], ['balcon', 'balcon'], ['terrasse', 'terrasse'], ['forage', 'forage'], ['wifi', 'wifi']];

const normalize = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`]/g, "'").replace(/ | /g, ' ');
const key = (text) => normalize(text).replace(/[^a-z]/g, '');
const DISTRICT_KEYS = Object.keys(DISTRICTS).map((name) => [key(name), name]);
const CITY_KEYS = [['brazzaville', 'Brazzaville'], ['brazza', 'Brazzaville'], ['pointenoire', 'Pointe-Noire'], ['ponton', 'Pointe-Noire']];

const RENT = /\b(louer|location|loue|locataire|loyer|a louer|mensuel(le)?|par mois)\b/;
const BUY = /\b(acheter|achat|acquerir|acquisition|a vendre|devenir proprietaire)\b/;
const STAY = /\b(sejour|nuits?|jours?|semaines?|week-?end|vacances|hebergement|hotel)\b/;
const FURNISHED = /\b(meuble|meublee|meubles|meublees)\b/;
const NEGATED_TX = /\b(pas|plus|ni)\s+(a\s+|pour\s+)?(l[' ]|la\s+|le\s+)?(louer|acheter|location|achat)\b/g;
const STRICT = /(strict|pas plus de|maximum absolu|ne (pas|jamais) depasser|pas un franc de plus|non negociable|au grand maximum)/;
const FLEXIBLE = /(budget (est )?(flexible|negociable)|un peu plus si|je peux depasser)/;
const STRONG = /(absolument|obligatoire(ment)?|indispensable|imperativement|il (me|nous) faut|exige|non negociable)/;
const REMOVE_BEFORE = /(sans|pas besoin d[e']\s*|plus besoin d[e']\s*|oublie[rz]?|enleve[rz]?|retire[rz]?|supprime[rz]?|pas de|pas d'|plus de|je ne veux (pas|plus)|laisse[rz]? tomber)\s*(la |le |les |l'|une |un |d'|de )?$/;
const RESTORE_BEFORE = /(remet[sz]?|remettre|reprend[sz]?|finalement je veux (quand meme |bien )?|je veux (quand meme|de nouveau|a nouveau)|je reveux)\s*(la |le |les |l'|une |un )?$/;
const MARKET = /(proche|pres|a cote|non loin|proximite|pas loin)\s+(d'|de\s+|du\s+|des\s+)?(une?\s+|l'|la\s+|les\s+)?marches?\b/;
const SCHOOL = /(proche|pres|a cote|non loin|proximite|pas loin)\s+(d'|de\s+|du\s+|des\s+)?(une?\s+|l'|la\s+|les\s+)?ecoles?/;

const INTENTS = {
  accept: [/^(oui|ouais|ok|okay|d'accord|daccord|vas-y|allez-y|bien sur|parfait|ca marche|volontiers|je veux bien|entendu|tres bien|bonne idee|pourquoi pas)\b/, /(j'accepte|elargi[st]?\b|je suis d'accord)/],
  reject: [/^(non|pas question|surtout pas|jamais)\b/, /(je refuse|je ne veux pas (elargir|changer)|je prefere rester|garde[rz]? (le|la|les|mon|ma|mes)\b|pas d'accord)/],
  results: [/(qu'est-ce que tu (me )?propos|que (me )?proposes|tu (me )?proposes|propose[sz]?-moi|montre[sz]?-moi|lance (la )?recherche|cherche[sz]?-moi|trouve[sz]?-moi|quelles? (sont les )?options|quels? .* (proposes|disponibles|publies)|as-tu (une?|des)|qu'est-ce que tu as|voir les (biens|annonces)|qu'est-ce qu'il y a|des propositions|relance)/],
  compare: [/(compar|difference entre|lequel (est|choisir|me conseilles|prendre)|entre les deux)/],
  advice: [/(avantages?|inconvenients?|limites?|pourquoi|conseill|recommand|le mieux|meilleur|qu'en penses|ton avis|interessant)/],
  tooSmall: [/(trop petit|pas assez grand|trop exigu|plus d'espace|plus grand|plus spacieu)/],
  greeting: [/^(bonjour|bonsoir|salut|hello)\b/],
};
const MOTIVATIONS = [['famille', /(enfants?|famille|familial|ma femme|mon mari|bebe)/], ['ecole', /ecole/], ['espace', /(trop petit|plus grand|plus d'espace|spacieu|plus de place|exigu)/], ['mobilite', /(mon travail|mon bureau|trajet|transport|deplacement)/], ['budget', /(moins cher|economis|petit budget)/], ['calme', /(calme|tranquille|bruit)/], ['courses', /(mes courses|courses quotidiennes|faire les courses)/], ['commerce', /(activite commerciale|mon commerce|vendre au marche|ma boutique)/], ['exterieur', /(espace exterieur|jouer dehors|dehors pour)/]];
const ORDINALS = { premier: 0, premiere: 0, '1er': 0, deuxieme: 1, second: 1, seconde: 1, troisieme: 2, quatrieme: 3, cinquieme: 4 };

const change = (current, value) => (current === null || current === undefined || current === value ? 'set' : 'replace');

function amounts(text, lastQuestion) {
  const found = [];
  const pattern = /(-?)(\d{1,3}(?:[ .]\d{3})+|\d+(?:[.,]\d+)?)/g;
  let match;
  while ((match = pattern.exec(text))) {
    if (match[1] === '-') continue;
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 24);
    const raw = match[2];
    let value = /[ .]\d{3}/.test(raw) && !/,/.test(raw) ? Number(raw.replace(/[ .]/g, '')) : Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    if (/^\s*(m2|m²|metres? carres?|metres?|mètres?)/.test(after)) { found.push({ kind: 'surface', value: Math.round(value) }); continue; }
    if (/^\s*(chambres?|ch\b)/.test(after)) { found.push({ kind: 'bedrooms', value }); continue; }
    if (/^\s*(semaines?|jours?|nuits?|mois|ans?|enfants?|personnes?|adultes?|salles?|etages?|premiers?|biens?|annonces?)/.test(after)) continue;
    if (/^\s*(k\b|mille)/.test(after)) value *= 1000;
    else if (/^\s*millions?/.test(after)) value *= 1_000_000;
    value = Math.round(value);
    if (value >= 10_000 || (lastQuestion === 'budget' && value >= 1000)) found.push({ kind: 'money', value, index: match.index });
    else if (lastQuestion === 'bedrooms' && value >= 0 && value <= 20) found.push({ kind: 'bedrooms', value });
  }
  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\s+chambres?\\b`).test(text)) found.push({ kind: 'bedrooms', value });
    else if (lastQuestion === 'bedrooms' && new RegExp(`^\\s*${word}\\b`).test(text)) found.push({ kind: 'bedrooms', value });
  }
  return found;
}

function interpretUtterance(text, state) {
  if (typeof text !== 'string') throw new Error('Message invalide.');
  if (text.length > MAX_LENGTH) throw new Error(`Message limité à ${MAX_LENGTH} caractères.`);
  const n = normalize(text);
  const c = state.criteria;
  const operations = []; const ambiguity = []; const motivations = [];
  const push = (op, path, value) => operations.push(value === undefined ? { op, path, source: 'explicit' } : { op, path, value, source: 'explicit' });

  // Opération (location, achat, séjour) : jamais déduite d'un montant.
  const positive = n.replace(NEGATED_TX, ' ');
  const tx = [];
  if (STAY.test(positive)) tx.push('STAY');
  else {
    if (RENT.test(positive)) tx.push('RENT');
    if (BUY.test(positive)) tx.push('BUY');
  }
  if (tx.length > 1 || /je ne sais pas (si|encore)/.test(n) && tx.length) ambiguity.push('transaction_conflict');
  else if (tx.length === 1 && c.transaction !== tx[0]) {
    push(change(c.transaction, tx[0]), 'transaction', tx[0]);
    if (c.budget.period && (tx[0] === 'RENT' || (tx[0] === 'BUY' && c.budget.period !== 'sale') || (tx[0] === 'STAY' && c.budget.period !== 'night'))) push('remove', 'budget.period');
  }

  // Type de bien : premier type cité, hors négation.
  const typeHits = TYPES.filter(([word]) => new RegExp(`\\b${word}s?\\b`).test(n) && !new RegExp(`(pas|plus)\\s+(une?|de)\\s+${word}`).test(n));
  const type = typeHits.sort((a, b) => n.search(new RegExp(`\\b${a[0]}`)) - n.search(new RegExp(`\\b${b[0]}`)))[0]?.[1];
  if (type && !(type === 'Bureau' && /mon bureau/.test(n)) && c.propertyType !== type) push(change(c.propertyType, type), 'propertyType', type);
  if (typeHits.length > 1) ambiguity.push('type_multiple');
  if (FURNISHED.test(n) && c.furnished !== true) push(change(c.furnished, true), 'furnished', true);
  if (/\b(non meuble|pas meuble|sans meubles?)\b/.test(n) && c.furnished !== false) push(change(c.furnished, false), 'furnished', false);

  // Lieu : catalogue fermé de quartiers ; élargissement explicite.
  const compact = n.replace(/[^a-z]/g, '');
  const district = DISTRICT_KEYS.filter(([k]) => compact.includes(k)).sort((a, b) => compact.indexOf(a[0]) - compact.indexOf(b[0]))[0]?.[1];
  const widen = /(n'importe quel|peu importe le|tous les|autres?|d'autres)\s+(quartier|arrondissement)s?|tout(e)? brazzaville|ailleurs|quartier de brazzaville/.test(n);
  if (district && !(widen && district === c.district)) {
    if (c.district !== district) push(change(c.district, district), 'district', district);
    if (c.city !== DISTRICTS[district]) push(change(c.city, DISTRICTS[district]), 'city', DISTRICTS[district]);
  } else {
    const city = CITY_KEYS.find(([k]) => compact.includes(k))?.[1];
    if (city && c.city !== city) push(change(c.city, city), 'city', city);
    if (city && c.district && DISTRICTS[c.district] !== city) push('remove', 'district');
  }
  if (widen && c.district) push('remove', 'district');

  // Montants, chambres et surface.
  const numbers = amounts(n, state.lastQuestion);
  const money = numbers.filter((item) => item.kind === 'money');
  const relative = /(augment\w*|ajout\w*|rajout\w*|hausse\w*|monte\w*)\b[^.?!]*?(de|\+)\s*$/;
  const lower = /(baisse\w*|redui\w*|diminue\w*|enleve\w*)\b[^.?!]*?(de|-)\s*$/;
  const rangeWords = /\b(entre|de)\b[^.?!]{0,40}\b(et|a)\b|\bbudget\b[^.?!]{0,40}\bet\b/;
  const explicitMinMax = /\bminimum\b[^.?!]{0,40}\bmaximum\b/;
  const isRange = money.length >= 2 && (rangeWords.test(n) || explicitMinMax.test(n));
  if (isRange) {
    const min = money[0].value; const max = money[1].value;
    if (min <= max) {
      if (min !== c.budget.min) push(change(c.budget.min, min), 'budget.min', min);
      if (max !== c.budget.max) push(change(c.budget.max, max), 'budget.max', max);
    } else ambiguity.push('budget_range_conflict');
  } else for (const item of money.slice(0, 1)) {
    const before = n.slice(0, item.index);
    let value = item.value;
    if (relative.test(before) && Number.isInteger(c.budget.max)) value = c.budget.max + item.value;
    else if (lower.test(before) && Number.isInteger(c.budget.max)) value = c.budget.max - item.value;
    const minimumOnly = /\b(minimum|au moins|a partir de)\b/.test(n) && !/\bmaximum\b/.test(n);
    const path = minimumOnly ? 'budget.min' : 'budget.max';
    if (value >= 1000 && value <= 5_000_000_000 && value !== (minimumOnly ? c.budget.min : c.budget.max)) push(change(minimumOnly ? c.budget.min : c.budget.max, value), path, value);
  }
  if (money.length > 1 && !isRange) ambiguity.push('budget_multiple');
  if (money.length && !c.transaction && !tx.length) ambiguity.push('budget_period_unknown');
  if (STRICT.test(n) && !c.budget.strict) push('set', 'budget.strict', true);
  if (FLEXIBLE.test(n) && c.budget.strict) push('replace', 'budget.strict', false);
  const txAfter = tx[0] || c.transaction;
  const period = txAfter === 'STAY' ? 'night' : txAfter === 'RENT' && /(mensuel|par mois|loyer)/.test(n) ? 'month' : txAfter === 'BUY' ? 'sale' : null;
  if (period && c.budget.period !== period) push(change(c.budget.period, period), 'budget.period', period);
  const bedrooms = numbers.find((item) => item.kind === 'bedrooms');
  if (bedrooms && Number.isInteger(bedrooms.value) && bedrooms.value <= 20 && bedrooms.value !== c.bedrooms.min) push(change(c.bedrooms.min, bedrooms.value), 'bedrooms.min', bedrooms.value);
  const surface = numbers.find((item) => item.kind === 'surface');
  if (surface && surface.value >= 5 && surface.value !== c.surface.min) push(change(c.surface.min, surface.value), 'surface.min', surface.value);

  // Équipements : ajout, obligation, suppression, restauration.
  const seen = new Set();
  for (const [word, amenity] of AMENITY_SYNONYMS) {
    const pattern = new RegExp(`\\b${word}s?\\b`, 'g');
    let match;
    while ((match = pattern.exec(n))) {
      if (seen.has(amenity) || !AMENITIES.has(amenity)) break;
      if (word === 'cour' && /^cour(s|t|ir|ant)/.test(n.slice(match.index))) continue;
      seen.add(amenity);
      const before = n.slice(Math.max(0, match.index - 40), match.index);
      const sentence = n.slice(Math.max(0, n.lastIndexOf('.', match.index) + 1), n.indexOf('.', match.index) === -1 ? n.length : n.indexOf('.', match.index));
      const known = [...state.amenities.preferred, ...state.amenities.required].includes(amenity);
      const remembered = state.criteriaHistory.some((item) => item.path.startsWith('amenities') && item.value === amenity);
      if (REMOVE_BEFORE.test(before)) { if (known) push('remove', 'amenities.preferred', amenity); continue; }
      if (RESTORE_BEFORE.test(before) && remembered && !known) { push('restore', state.criteriaHistory.findLast((item) => item.value === amenity).path, amenity); continue; }
      const bucket = STRONG.test(sentence) ? 'required' : 'preferred';
      if (!state.amenities[bucket].includes(amenity)) push('set', `amenities.${bucket}`, amenity);
    }
  }

  // Proximité d'une école : préférence importante, jamais vérifiée par le texte.
  if (SCHOOL.test(n)) {
    const importance = STRONG.test(n) ? 'required' : 'important';
    if (state.proximity.school !== importance) push(change(state.proximity.school, importance), 'proximity.school', importance);
  } else if (/ecole[^.?!]{0,40}(pas indispensable|pas obligatoire|pas forcement|accepte\w* un trajet)/.test(n) && state.proximity.school === 'required') push('replace', 'proximity.school', 'important');

  if (MARKET.test(n)) {
    const importance = STRONG.test(n) ? 'required' : 'important';
    if (state.proximity.market !== importance) push(change(state.proximity.market ?? null, importance), 'proximity.market', importance);
  }

  for (const [name, pattern] of MOTIVATIONS) if (pattern.test(n)) motivations.push(name);

  const intents = Object.fromEntries(Object.entries(INTENTS).map(([name, patterns]) => [name, patterns.some((pattern) => pattern.test(n.trim()))]));
  if (intents.accept && intents.reject) { intents.accept = false; ambiguity.push('accept_reject_conflict'); }
  const selection = [...n.matchAll(/\b(premier|premiere|1er|deuxieme|second|seconde|troisieme|quatrieme|cinquieme)\b/g)].map((m) => ORDINALS[m[1]]);
  if (/les deux premiers/.test(n)) selection.splice(0, selection.length, 0, 1);
  if (!c.transaction && !tx.length && (c.propertyType || type)) ambiguity.push('transaction_missing');
  // Intention du tour (affiner, nouvelle recherche, explorer) : opérations finales décidées côté serveur.
  const types = [...new Set(typeHits.map(([, t]) => t))].filter((t) => !(t === 'Bureau' && /mon bureau/.test(n)));
  const { intent, operations: finalOps } = classifyIntent(n, state, { types, tx, operations });
  const finalAmbiguity = types.length >= 2 ? ambiguity.filter((a) => a !== 'type_multiple') : ambiguity;
  return { intent, operations: finalOps, motivations, intents, selection: [...new Set(selection)], ambiguity: [...new Set(finalAmbiguity)] };
}

const KNOWN_CITIES = Object.keys(CITIES);

module.exports = { normalize, interpretUtterance, KNOWN_CITIES };
