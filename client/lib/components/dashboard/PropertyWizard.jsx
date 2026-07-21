"use client";

// client/lib/components/dashboard/PropertyWizard.jsx — Sprint 0 (architecture
// fonctionnelle Altimmo). Point d'entrée unique de création d'annonce :
// remplace l'ancien sélecteur à 3 cartes affiché directement dans
// ManagePropertiesPage.jsx. L'utilisateur ne voit jamais plusieurs
// formulaires concurrents — un seul, déterminé par ses réponses ici.
//
// Étape 1 — Vente / Location / Hébergement.
// Étape 2 — si Hébergement : type précis (dont Hôtel), avant de charger le
// formulaire. Le type choisi ici préremplit `accommodationType` dans
// PropertyForm (lequel garde sa propre logique complète, inchangée).
//
// Ne modifie aucune API ni aucun modèle — purement une couche de
// présentation qui détermine quel formulaire déjà existant afficher.

import { useState } from "react";
import { Landmark, KeyRound, Palmtree, ArrowLeft, Building2, Home, Warehouse, DoorOpen, Users, Building, Hotel as HotelIcon } from "lucide-react";

export const TRANSACTION_OPTIONS = [
  { key: "vente", label: "Vente", Icon: Landmark, description: "Vendre une maison, un appartement, un terrain, un immeuble ou un local." },
  { key: "location", label: "Location", Icon: KeyRound, description: "Louer un logement ou local avec loyer mensuel et contrat de bail." },
  { key: "hebergement", label: "Hébergement", Icon: Palmtree, description: "Proposer un séjour meublé à la nuitée — logement indépendant ou hôtel." },
];

// Sprint B1 : "hébergement indépendant" (villas/appartements/studios/maisons/
// chambres d'hôtes/résidences meublées). Sprint B2 : "Hôtel" est réactivé
// ici — le choisir ouvre désormais HotelPropertyForm (domaine Hôtellerie
// dédié : établissement + catégories de chambres + tarifs), jamais
// PropertyForm. Résidence hôtelière reste hors périmètre (pas de domaine
// dédié) — voir ARCHITECTURE_ALTIMMO_V2.md §3 et HOTEL_V2.md. Valeurs
// techniques alignées sur Accommodation.ACCOMMODATION_TYPES (server/models/
// Accommodation.js) — jamais inventées.
export const HEBERGEMENT_TYPE_OPTIONS = [
  { value: "appartement_meuble", label: "Appartement meublé", Icon: Building2 },
  { value: "villa_meublee", label: "Villa", Icon: Home },
  { value: "maison_meublee", label: "Maison", Icon: Warehouse },
  { value: "studio_meuble", label: "Studio", Icon: DoorOpen },
  { value: "residence_meublee", label: "Résidence meublée", Icon: Building },
  { value: "chambre_hotes", label: "Chambre d'hôtes", Icon: Users },
  { value: "hotel", label: "Hôtel", Icon: HotelIcon },
];

const CardGrid = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
);

const OptionCard = ({ Icon, label, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-start gap-2 p-5 border-2 border-gray-200 rounded-xl text-left hover:border-blue-500 hover:shadow-lg transition-all"
  >
    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Icon className="w-6 h-6" /></div>
    <h3 className="font-bold text-gray-800">{label}</h3>
    {description && <p className="text-sm text-gray-500">{description}</p>}
  </button>
);

/**
 * @param {(result: { transactionType: 'vente'|'location'|'hebergement', accommodationType?: string }) => void} onComplete
 */
const PropertyWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);

  const chooseTransaction = (key) => {
    if (key === "hebergement") {
      setStep(2);
      return;
    }
    onComplete({ transactionType: key });
  };

  const chooseHebergementType = (accommodationType) => {
    onComplete({ transactionType: "hebergement", accommodationType });
  };

  if (step === 2) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quel type d'hébergement ?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {HEBERGEMENT_TYPE_OPTIONS.map(({ value, label, Icon }) => (
            <OptionCard key={value} Icon={Icon} label={label} onClick={() => chooseHebergementType(value)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Que souhaitez-vous publier ?</h3>
      <CardGrid>
        {TRANSACTION_OPTIONS.map(({ key, label, Icon, description }) => (
          <OptionCard key={key} Icon={Icon} label={label} description={description} onClick={() => chooseTransaction(key)} />
        ))}
      </CardGrid>
    </div>
  );
};

export default PropertyWizard;
