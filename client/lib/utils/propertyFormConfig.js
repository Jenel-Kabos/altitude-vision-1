import { BedDouble, Building2, Home, KeyRound, Map, ShoppingBag, Tag } from 'lucide-react';
import { HOTEL_ACCOMMODATION_TYPES } from '../constants/accommodation';

export function getPropertyFormConfig({ transactionType = 'vente', propertyType = 'Bien immobilier', accommodationType = '', mode = 'create' } = {}) {
  const isLand = propertyType === 'Terrain';
  const isCommercial = ['Commerce', 'Bureau', 'Entrepôt'].includes(propertyType);
  const isHotel = transactionType === 'hebergement' && HOTEL_ACCOMMODATION_TYPES.includes(accommodationType);
  const TypeIcon = isLand ? Map : isCommercial ? ShoppingBag : Home;
  const verb = mode === 'edit' ? 'Modifier' : 'Ajouter';

  const transaction = transactionType === 'location'
    ? { label: 'Location', Icon: KeyRound, tone: 'from-blue-600 to-cyan-500', priceLabel: 'Loyer mensuel (FCFA)', priceHelp: 'Indiquez le montant du loyer mensuel.', title: `${verb} un bien à louer` }
    : transactionType === 'hebergement'
      ? { label: isHotel ? 'Hôtel' : 'Hébergement', Icon: isHotel ? Building2 : BedDouble, tone: 'from-violet-600 to-fuchsia-500', priceLabel: 'Tarif par nuit (FCFA)', priceHelp: 'Indiquez le tarif appliqué par nuit.', title: `${verb} ${isHotel ? 'un hôtel' : 'un hébergement'}` }
      : { label: 'Vente', Icon: Tag, tone: 'from-amber-600 to-orange-500', priceLabel: 'Prix de vente (FCFA)', priceHelp: 'Indiquez le prix de vente demandé.', title: `${verb} un bien à vendre` };

  const contextHelp = isLand
    ? 'Mettez en avant la superficie, la localisation, la construction possible et les informations foncières déjà prises en charge.'
    : isCommercial
      ? 'Présentez la surface professionnelle, l’accès, le stationnement et les équipements adaptés à l’activité.'
      : transactionType === 'location'
        ? 'Priorité au loyer, à la disponibilité, à la caution et aux conditions de bail.'
        : transactionType === 'hebergement'
          ? 'Priorité à la capacité, aux horaires, aux services, aux équipements et aux conditions de séjour.'
          : 'Priorité au prix de vente, à la disponibilité, aux caractéristiques et à la qualité de présentation.';

  return { ...transaction, TypeIcon, propertyType, isLand, isCommercial, isHotel, contextHelp, mode };
}
