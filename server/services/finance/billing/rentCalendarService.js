// F-U2.10 — Calendrier locatif déterministe (fuseau Africa/Brazzaville, UTC+1
// fixe). Aucun appel au fuseau du serveur : toutes les dates sont construites
// en UTC puis décalées de l'offset WAT.

const { fail } = require('../financialError');
const { percentageOfMinor } = require('../moneyService');
const { CONTRACT_TIMEZONE } = require('../../../constants/contractualFinanceConstants');
const { RENT_CALENDAR_POLICY: CAL, RENT_PRORATA_POLICY: PRORATA, RENT_PENALTY_POLICY } = require('../../../constants/rentCollectionConstants');

const OFFSET_MS = CONTRACT_TIMEZONE.offsetMinutes * 60000;
const DAY = 86400000;

// Minuit (heure de Brazzaville) du jour local donné.
const watMidnight = (year, month, day) => new Date(Date.UTC(year, month - 1, day) - OFFSET_MS);
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const nextMonth = (year, month) => (month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 });

// Jour civil local (Brazzaville) d'un instant.
function localDay(at) {
  const shifted = new Date(new Date(at).getTime() + OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function parseRentPeriod(label) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(label || ''));
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) fail('BILLING_PERIOD_INVALID', 'Période attendue au format AAAA-MM.', 422);
  return { year: Number(match[1]), month: Number(match[2]), label: String(label) };
}

// Calendrier complet d'une période de loyer.
function rentCalendar(label) {
  const { year, month } = parseRentPeriod(label);
  const next = nextMonth(year, month);
  const monthDays = daysInMonth(year, month);
  const billingDay = month === 2 ? monthDays : CAL.billingDay; // février : dernier jour (28/29)
  const lateFrom = watMidnight(next.year, next.month, CAL.lateFromDayNextMonth);
  return {
    period: label, year, month, monthDays, timeZone: CAL.timeZone, policyVersion: CAL.version,
    start: watMidnight(year, month, 1),
    end: watMidnight(next.year, next.month, 1), // exclusif : le 31 appartient à la période
    billingDate: watMidnight(year, month, billingDay), // clôture conventionnelle (exigibilité)
    conventionalDays: 30,
    dueDate: new Date(lateFrom.getTime() - 1), // fin du 5 du mois suivant
    lateFrom,
    formalNoticeDate: watMidnight(next.year, next.month, CAL.formalNoticeDayNextMonth),
    decisions: [],
  };
}

function phaseAt(label, now = new Date()) {
  const cal = rentCalendar(label);
  const t = new Date(now).getTime();
  if (t < cal.billingDate.getTime()) return 'BEFORE_BILLING';
  if (t < cal.lateFrom.getTime()) return 'AWAITING_PAYMENT';
  if (t < cal.formalNoticeDate.getTime()) return 'LATE';
  return 'FORMAL_NOTICE';
}

const halfUp = (amount, numerator, denominator) => Math.floor((amount * numerator * 2 + denominator) / (denominator * 2));

// Prorata du premier loyer, base conventionnelle de 30 jours (jour d'entrée
// inclus). Un mois complet vaut toujours un loyer ; aucun supplément le 31.
function firstRentProrata({ monthlyRentMinor, period, entryDate }) {
  if (!Number.isSafeInteger(monthlyRentMinor) || monthlyRentMinor <= 0) fail('LEASE_RENT_UNDETERMINED', 'Montant du loyer invalide.', 409);
  const cal = rentCalendar(period);
  const entry = new Date(entryDate);
  if (entry.getTime() <= cal.start.getTime()) return { applicable: false, amountMinor: monthlyRentMinor };
  if (entry.getTime() >= cal.end.getTime()) fail('LEASE_NOT_ACTIVE_FOR_PERIOD', 'Le bail ne couvre pas cette période.', 409);
  const { day } = localDay(entry);
  if (day === 1) return { applicable: false, amountMinor: monthlyRentMinor };
  const base = { applicable: true, ruleVersion: PRORATA.version, entryDate: entry, entryDay: day, monthDays: cal.monthDays, baseDays: PRORATA.baseDays, monthlyRentMinor, coveredFrom: entry, coveredTo: cal.billingDate };
  if (day === 31) {
    const next = nextMonth(cal.year, cal.month);
    return { ...base, rule: 'ENTRY_ON_31', ruleStatus: PRORATA.rules.ENTRY_ON_31.status, ruleDescription: PRORATA.rules.ENTRY_ON_31.description, days: 0, amountMinor: 0, firstFullPeriod: `${next.year}-${String(next.month).padStart(2, '0')}` };
  }
  const ruleKey = cal.month === 2 ? 'FEBRUARY_CONVENTIONAL' : 'THIRTY_DAY_BASE';
  const days = PRORATA.baseDays - day + 1;
  return { ...base, rule: ruleKey, ruleStatus: PRORATA.rules[ruleKey].status, ruleDescription: PRORATA.rules[ruleKey].description, days, amountMinor: halfUp(monthlyRentMinor, days, PRORATA.baseDays) };
}

// Sortie : un mois dont l'occupation va au moins jusqu'à la clôture
// conventionnelle (le 30 ; février : dernier jour) est un mois complet.
function exitCoversConventionalMonth(period, lastOccupiedDate) {
  const cal = rentCalendar(period);
  const last = localDay(lastOccupiedDate);
  if (last.year !== cal.year || last.month !== cal.month) return new Date(lastOccupiedDate) >= cal.end;
  return last.day >= Math.min(30, cal.monthDays);
}

function assertProrataDecided(result) {
  if (result.applicable && !['VALIDATED', 'DERIVED'].includes(result.ruleStatus)) {
    fail('RENT_PRORATA_RULE_UNDECIDED', `Prorata non décidé (${result.rule}) : simulation ${result.amountMinor} FCFA pour ${result.days}/${result.baseDays} jours — décision requise.`, 409);
  }
  return result;
}

// F-U2.12 — Jour conventionnel (1..30) d'un jour civil du mois.
//   début : jour d'entrée / prise d'effet tel quel (le 31 = aucun jour) ;
//   fin   : jour civil plafonné à 30 ; dernier jour de février → 30.
function conventionalEndDay(cal, day) { return day >= Math.min(30, cal.monthDays) ? 30 : day; }

// F-U2.12 — Plan conventionnel d'une période : segments [début, fin] par
// montant contractuel, base 30, sans chevauchement. Montants entiers
// (arrondi moitié vers le haut par segment). Lève une erreur explicite pour
// tout cas ambigu (avec simulation dans le message lorsque calculable).
function conventionalRentPlan({ period, rentAtStartMinor, rentChange = null, entryDate = null, obligationEndDate = null }) {
  const cal = rentCalendar(period);
  const inPeriod = (date) => date && new Date(date) >= cal.start && new Date(date) < cal.end;
  let startDay = 1;
  if (entryDate && new Date(entryDate) > cal.start) {
    if (!inPeriod(entryDate)) fail('LEASE_NOT_ACTIVE_FOR_PERIOD', 'Le bail ne couvre pas cette période.', 409);
    startDay = localDay(entryDate).day;
  }
  let endDay = 30;
  if (obligationEndDate && new Date(obligationEndDate) < cal.end) {
    if (new Date(obligationEndDate) < cal.start) fail('LEASE_NOT_ACTIVE_FOR_PERIOD', 'L’obligation locative a pris fin avant cette période.', 409);
    endDay = conventionalEndDay(cal, localDay(obligationEndDate).day);
  }
  if (startDay === 31) return { billable: false, reason: 'ENTRY_ON_31', firstFullPeriod: (() => { const n = nextMonth(cal.year, cal.month); return `${n.year}-${String(n.month).padStart(2, '0')}`; })() };
  if (endDay < startDay) fail('RENT_PERIOD_EMPTY', 'Aucun jour d’obligation locative sur cette période.', 409);
  const boundaries = [{ fromDay: startDay, rentMinor: rentAtStartMinor, source: 'LEASE' }];
  if (rentChange) {
    const changeDay = localDay(rentChange.effectiveDate).day; // jour où le nouveau loyer s'applique
    if (changeDay <= startDay) boundaries[0] = { fromDay: startDay, rentMinor: rentChange.newRentMinor, source: 'AMENDMENT' };
    else if (changeDay <= endDay) boundaries.push({ fromDay: changeDay, rentMinor: rentChange.newRentMinor, source: 'AMENDMENT' });
  }
  const segments = boundaries.map((b, i) => {
    const toDay = i + 1 < boundaries.length ? boundaries[i + 1].fromDay - 1 : endDay;
    const days = toDay - b.fromDay + 1;
    return { fromDay: b.fromDay, toDay, days, rentMinor: b.rentMinor, source: b.source, amountMinor: halfUp(b.rentMinor, days, PRORATA.baseDays) };
  }).filter((segment) => segment.days > 0);
  const totalMinor = segments.reduce((sum, segment) => sum + segment.amountMinor, 0);
  const conventionalDays = segments.reduce((sum, segment) => sum + segment.days, 0);
  const maxRent = Math.max(...segments.map((segment) => segment.rentMinor));
  if (totalMinor > maxRent) fail('RENT_PLAN_CAP_EXCEEDED', 'Le montant dépasse le loyer mensuel applicable.', 500); // garde-fou
  return {
    billable: true, period, policyVersion: PRORATA.version, baseDays: PRORATA.baseDays, startDay, endDay, conventionalDays, segments, totalMinor,
    full: startDay === 1 && endDay === 30 && segments.length === 1,
    february: cal.month === 2, monthDays: cal.monthDays,
  };
}

// F-U2.13 — Calendrier issu d'une politique contractuelle (jamais d'une valeur
// globale). `terms` absent ou champ absent → date absente (null).
//   due   : { day: 1..30 | 'END', monthOffset: 0|1 }  ('END' = 30, février : dernier jour)
//   grace : { day, monthOffset } — fin de tolérance (inclus) ; sinon fin du jour d'échéance
//   formalNotice : { day, monthOffset }
function policyDay(cal, spec) {
  const target = spec.monthOffset ? nextMonth(cal.year, cal.month) : { year: cal.year, month: cal.month };
  const days = daysInMonth(target.year, target.month);
  const day = spec.day === 'END' ? (target.month === 2 ? days : 30) : Math.min(Number(spec.day), days);
  return watMidnight(target.year, target.month, day);
}

function policyCalendar(label, terms) {
  const cal = rentCalendar(label);
  const exigibleAt = terms?.due ? policyDay(cal, terms.due) : null;
  const graceDay = terms?.grace ? policyDay(cal, terms.grace) : exigibleAt;
  const dueDate = graceDay ? new Date(graceDay.getTime() + DAY - 1) : null;
  const inArrears = Boolean(terms?.due && terms.due.day === 'END' && !terms.due.monthOffset);
  return {
    ...cal,
    billingDate: inArrears ? exigibleAt : cal.start, // génération : à terme échu si stipulé, sinon dès le début de période
    exigibleAt, dueDate, lateFrom: dueDate ? new Date(dueDate.getTime() + 1) : null,
    formalNoticeDate: terms?.formalNotice ? policyDay(cal, terms.formalNotice) : null,
  };
}

const latePenaltyMinor = (unpaidRentMinor, rateBasisPoints = RENT_PENALTY_POLICY.rateBasisPoints) => percentageOfMinor(Math.max(0, unpaidRentMinor), rateBasisPoints);

module.exports = { policyCalendar, rentCalendar, phaseAt, localDay, firstRentProrata, exitCoversConventionalMonth, assertProrataDecided, conventionalRentPlan, conventionalEndDay, latePenaltyMinor, watMidnight, DAY };
