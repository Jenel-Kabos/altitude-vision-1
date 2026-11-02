// ALTIMMO-AI-INTEGRATION-01 (DeepSeek) — mise en forme des réponses du conseiller conversationnel.
// Fichier identique au web (client/lib/utils) et au mobile (altimmo-app/src/utils). Aucun texte n'est
// inventé : chaque valeur vient de l'annonce publique ou de l'évaluation serveur ; une valeur absente
// reste « non renseignée ».
import { formatAmount, OFFER_LABELS } from './assistantViewModel';

const PERIOD_LABELS = Object.freeze({ night: 'par nuit', month: 'par mois', week: 'par semaine', year: 'par an', sale: 'prix de vente' });
const MODE_LABELS = Object.freeze({ deepseek: 'Conseiller DeepSeek', 'simulé': 'Conseiller simulé (essais, sans DeepSeek)', moteur: 'Moteur Altimmo seul' });
const TURN_MODE_LABELS = Object.freeze({ deepseek: 'DeepSeek', 'simulé': 'simulé', secours: 'moteur Altimmo (secours)', 'règle': 'règle Altimmo' });
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const list = (value) => (Array.isArray(value) ? value.filter(isText) : []);

export const advisorModeLabel = (mode) => MODE_LABELS[mode] || MODE_LABELS.moteur;
/** Origine réelle d'une réponse : rédigée par le modèle, ou réponse de secours vérifiée. */
export function turnOriginLabel(metrics = {}) {
  const mode = TURN_MODE_LABELS[metrics.mode] || null;
  if (!mode) return null;
  return metrics.narration === 'fallback' ? `${mode}, réponse de secours vérifiée` : mode;
}

/** Annonce publique (projection serveur) + évaluation → carte affichable. */
export function toAdvisorCard(listing = {}, fit = null) {
  const id = String(listing.id || '');
  const price = finite(listing.price)
    ? { label: PERIOD_LABELS[listing.pricePeriod] ? `Prix (${PERIOD_LABELS[listing.pricePeriod]})` : 'Prix', value: formatAmount(listing.price) }
    : null;
  const address = listing.address || {};
  const features = [
    finite(listing.bedrooms) && listing.bedrooms > 0 ? `${listing.bedrooms} chambre${listing.bedrooms > 1 ? 's' : ''}` : null,
    finite(listing.surface) && listing.surface > 0 ? `${listing.surface} m²` : null,
  ].filter(Boolean);
  return {
    id, hotelId: isText(listing.hotelId) ? listing.hotelId : null,
    title: isText(listing.title) ? listing.title : 'Annonce Altimmo',
    offerLabel: OFFER_LABELS[listing.status] || null,
    typeLabel: isText(listing.type) ? listing.type : null,
    price, features,
    location: [address.neighborhood, address.arrondissement, address.city].filter(isText).join(', ') || null,
    image: isText(listing.image) && /^https:\/\//.test(listing.image) ? listing.image : null,
    isLodging: listing.lodging === true || listing.status === 'hebergement',
    strengths: list(fit?.strengths), limits: list(fit?.limits), toVerify: list(fit?.toVerify),
  };
}

/** Résultat d'un tour → cartes (au plus 5, sans doublon). */
export function toAdvisorCards(result = {}) {
  const fits = result.fits || {};
  const seen = new Set();
  return (result.cards || []).map((item) => item?.listing).filter((listing) => listing && !seen.has(listing.id) && seen.add(listing.id))
    .slice(0, 5).map((listing) => toAdvisorCard(listing, fits[listing.id]));
}

// Statuts d'un tour sans nouvelle recherche : les annonces déjà présentées restent affichées.
const KEEP_CARDS = new Set(['needs_clarification', 'refused', 'comparison']);
/** Le tour a-t-il remplacé les annonces présentées (y compris par « aucune ») ? */
export const replacesCards = (result = {}) => Boolean(result.cards?.length) || !KEEP_CARDS.has(result.status);

/** Comparaison du conseiller → enveloppe du contrat IA-03 attendue par `toComparisonView`. */
export const comparisonEnvelope = (comparison) => (comparison?.envelope ? { data: comparison.envelope } : null);
