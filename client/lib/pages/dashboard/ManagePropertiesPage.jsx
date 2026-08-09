"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getAllProperties, getPropertyById, deleteProperty, updateProperty, addProperty, toggleRecommande } from "../../services/propertyService";
import { createFullAccommodation, updateFullAccommodation } from "../../services/accommodationService";
import { useAuth } from '../../context/AuthContext';
import { isStaffDocs } from '../../utils/staffRoles';
import {
  PlusCircle, X, Edit, Trash2, Home, Search, Loader2, AlertTriangle, Eye,
  ArrowLeft, ArrowRight, Building2, Sparkles,
} from "lucide-react";
import PropertyForm from "../../components/dashboard/PropertyForm";
import SalePropertyForm from "../../components/dashboard/SalePropertyForm";
import RentalPropertyForm from "../../components/dashboard/RentalPropertyForm";
import HotelPropertyForm from "../../components/dashboard/HotelPropertyForm";
import PropertyWizard from "../../components/dashboard/PropertyWizard";
import { HOTEL_ACCOMMODATION_TYPES } from "../../constants/accommodation";
import DashboardKpis from '../../components/dashboard/DashboardKpis';
import PropertyPortfolioDashboard from '../../components/dashboard/propertyAsset/PropertyPortfolioDashboard';
import PropertyManagementCard from '../../components/dashboard/PropertyManagementCard';
import { formatCurrencyXAF } from '../../utils/normalizePropertyDetail';
import { getDashboardAnalytics } from '../../services/dashboardAnalyticsService';

// Libellés d'affichage pour le titre de la modale "Ajouter" — le choix
// métier lui-même est piloté par PropertyWizard.jsx (Sprint 0, point
// d'entrée unique de création — voir ARCHITECTURE_ALTIMMO_V2.md).
const BUSINESS_TYPE_LABELS = { vente: 'Vente', location: 'Location', hebergement: 'Hébergement' };

const PROPERTIES_PER_PAGE = 8;

const ManagePropertiesPage = ({ section = null, readOnly = false }) => {
  const { canEdit, canDelete, user } = useAuth();
  const canAddProperty = ['Admin', 'CommunityManager', 'Collaborateur', 'GestionnaireImmobilier'].includes(user?.role);
  // Sprint 0 (architecture Altimmo) — pré-filtre lu depuis l'URL
  // (?status=vente|location|hebergement), posé par les liens dédiés du
  // domaine Immobilier dans AdminDashboard.jsx. Filtre 100% frontend, ne
  // change aucun appel API : getAllProperties() renvoie toujours tout,
  // exactement comme avant ce sprint.
  const searchParams = useSearchParams();
  const statusFilter = section || searchParams?.get('status') || null;
  const [properties, setProperties]         = useState([]);
  const [filteredProperties, setFiltered]   = useState([]);
  const [loading, setLoading]               = useState(false);
  const [searchTerm, setSearchTerm]         = useState('');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editingId, setEditingId]           = useState(null);
  const [notification, setNotif]           = useState({ show: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage]       = useState(1);
  const [existingImages, setExistingImages] = useState([]);
  const [confirmState, setConfirm]          = useState({ isOpen: false, message: '', onConfirm: () => {} });
  // Sprint A — sélecteur métier initial ('vente'|'location'|'hebergement') ;
  // null = écran de sélection encore affiché dans la modale "Ajouter".
  const [addChoice, setAddChoice]           = useState(null);
  // Bien en cours d'édition (objet complet, pas seulement `formData`) — sert
  // à déterminer quel formulaire spécialisé afficher (SalePropertyForm /
  // RentalPropertyForm / PropertyForm legacy pour l'hébergement).
  const [editingProperty, setEditingProperty] = useState(null);
  const [editFullData, setEditFullData]     = useState(null); // { property, sale? , rental? }
  const [editLoading, setEditLoading]       = useState(false);
  const [analytics, setAnalytics] = useState(null);

  const emptyForm = {
    title: "", description: "", price: "", honoraires: "", fraisVisite: 0,
    pole: "Altimmo", status: "vente",
    type: "Appartement", availability: "Disponible",
    address: { street: "", arrondissement: "", city: "Brazzaville" },
    surface: "", bedrooms: "", bathrooms: "", livingRooms: "",
    constructionType: "Non spécifié", kitchens: "", amenities: "",
    latitude: -4.266, longitude: 15.283, images: [],
    // Hébergement (dashboard admin uniquement — voir PropertyForm.enableHebergement)
    accommodationType: "", maxAdults: "", maxChildren: "", beds: "",
    checkInTime: "14:00", checkOutTime: "11:00", minimumStay: 1, maximumStay: "",
    cancellationPolicy: "moderee", houseRules: "", securityDeposit: 0, cleaningFee: 0,
    nightlyPrice: "",
    // Sprint B1 — équipements structurés (nom distinct de `amenities`, qui
    // reste le champ générique texte libre de Property) / règles / services inclus
    accommodationAmenities: { cuisine: [], salon: [], internet: [], exterieur: [], parking: [], securite: [] },
    rules: { petsAllowed: false, partiesAllowed: false, smokingAllowed: false, childrenAllowed: true, minimumAge: 0 },
    includedServices: { menage: false, petitDejeuner: false, blanchisserie: false, transfert: false, cuisine: false },
    // Établissement hôtelier (Sprint Hôtel — uniquement si accommodationType === 'hotel')
    hotelMode: "", hotelId: "", hotelName: "", hotelDescription: "",
    hotelStarRating: "", hotelPhone: "", hotelEmail: "", hotelWebsite: "",
    hotelServices: "", hotelHasRestaurant: false, hotelHasReception: false,
  };
  const [formData, setFormData]       = useState(emptyForm);
  const [loadingSubmit, setSubmit]    = useState(false);
  const [errors, setErrors]           = useState({});

  useEffect(() => { fetchProperties(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const module = section === 'vente' ? 'sales' : section === 'location' ? 'rentals' : null;
    if (!module) return;
    getDashboardAnalytics(module).then(setAnalytics).catch(() => setAnalytics({ kpis: {} }));
  }, [section]);

  useEffect(() => {
    let list = statusFilter ? properties.filter((p) => p.status === statusFilter) : properties;
    if (searchTerm) {
      list = list.filter(p =>
        p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address?.arrondissement?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFiltered(list);
    setCurrentPage(1);
  }, [searchTerm, properties, statusFilter]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await getAllProperties({ dashboardClassification: true });
      // `filteredProperties` est dérivé exclusivement par l'effet de filtrage
      // ci-dessous (searchTerm + statusFilter) — ne pas le fixer ici en
      // parallèle, sous peine de courte-circuiter le filtre ?status= au
      // premier rendu après chargement (Sprint 0).
      setProperties(res);
    } catch {
      showNotif("Erreur lors du chargement des biens.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotif = (message, type = 'success') => {
    setNotif({ show: true, message, type });
    setTimeout(() => setNotif({ show: false, message: '', type: 'success' }), 4000);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setExistingImages([]);
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingId(null);
    setErrors({});
    setAddChoice(null);
    setEditingProperty(null);
    setEditFullData(null);
    setEditLoading(false);
  };

  // Réponse du PropertyWizard (Sprint 0) — détermine le formulaire à charger.
  // Un `accommodationType` n'est fourni que pour Hébergement (étape 2 du
  // wizard, y compris "Hôtel") ; PropertyForm garde son propre sélecteur
  // interne, simplement préréglé ici.
  const handleWizardComplete = ({ transactionType, accommodationType }) => {
    setAddChoice(transactionType);
    if (transactionType === 'hebergement') {
      setFormData((prev) => ({
        ...prev,
        status: 'hebergement',
        ...(accommodationType ? { accommodationType } : {}),
      }));
    }
  };

  const openCreate = () => {
    setAddChoice(['vente', 'location', 'hebergement'].includes(section) ? section : null);
    if (section === 'hebergement') setFormData((prev) => ({ ...prev, status: 'hebergement' }));
    setShowAddModal(true);
  };

  const ownerHref = (property) => {
    const classification = property.dashboardClassification;
    if (classification?.family === 'vente') return `/dashboard/sales?focus=${property._id}`;
    if (classification?.family === 'location') return `/dashboard/rentals?focus=${property._id}`;
    if (classification?.family === 'accommodation') return `/dashboard/hebergements?accommodationId=${classification.accommodationId}`;
    if (classification?.family === 'hotel') return `/dashboard/etablissements/${classification.hotelId}`;
    return `/dashboard/properties?focus=${property._id}&classification=ambiguous`;
  };

  // Point d'entrée unique du bouton "Modifier" — détermine quel formulaire
  // spécialisé afficher selon la catégorie métier réelle du bien (Sprint A).
  // Hébergement continue d'utiliser exactement le flux existant (handleEdit
  // ci-dessous, inchangé) ; Vente/Location chargent la fiche
  // SaleManagement/RentalManagement associée pour préremplir le nouveau
  // formulaire dédié.
  const handleEditClick = async (property) => {
    setEditingProperty(property);
    if (property.status === 'hebergement') {
      await handleEdit(property);
      return;
    }
    setEditingId(property._id);
    setExistingImages(property.images || []);
    setShowEditModal(true);
    setEditLoading(true);
    try {
      const full = await getPropertyById(property._id);
      setEditFullData(full);
    } catch {
      showNotif("Erreur lors du chargement du bien.", "error");
      setEditFullData({ property });
    } finally {
      setEditLoading(false);
    }
  };

  const handleEdit = async (property) => {
    setEditingId(property._id);
    setExistingImages(property.images || []);
    setFormData({
      title:            property.title            || "",
      description:      property.description      || "",
      price:            property.price            || "",
      honoraires:       property.honoraires        ?? "",
      fraisVisite:      property.fraisVisite       ?? 0,
      pole:             property.pole             || "Altimmo",
      status:           property.status           || "vente",
      type:             property.type             || "Appartement",
      availability:     property.availability     || "Disponible",
      address:          property.address          || { street: "", arrondissement: "", city: "Brazzaville" },
      surface:          property.surface          || "",
      bedrooms:         property.bedrooms         || "",
      bathrooms:        property.bathrooms        || "",
      livingRooms:      property.livingRooms      || "",
      constructionType: property.constructionType || "Non spécifié",
      kitchens:         property.kitchens         || "",
      amenities:        Array.isArray(property.amenities) ? property.amenities.join(", ") : "",
      latitude:         property.location?.coordinates?.[1] || -4.266,
      longitude:        property.location?.coordinates?.[0] || 15.283,
      images:           [],
      // Champs hébergement — préremplis si un profil Accommodation existe déjà
      // (voir ci-dessous), sinon valeurs par défaut du modèle.
      accommodationType: "", maxAdults: "", maxChildren: "", beds: "",
      checkInTime: "14:00", checkOutTime: "11:00", minimumStay: 1, maximumStay: "",
      cancellationPolicy: "moderee", houseRules: "", securityDeposit: 0, cleaningFee: 0,
      nightlyPrice: "",
      accommodationAmenities: { cuisine: [], salon: [], internet: [], exterieur: [], parking: [], securite: [] },
      rules: { petsAllowed: false, partiesAllowed: false, smokingAllowed: false, childrenAllowed: true, minimumAge: 0 },
      includedServices: { menage: false, petitDejeuner: false, blanchisserie: false, transfert: false, cuisine: false },
      hotelMode: "", hotelId: "", hotelName: "", hotelDescription: "",
      hotelStarRating: "", hotelPhone: "", hotelEmail: "", hotelWebsite: "",
      hotelServices: "", hotelHasRestaurant: false, hotelHasReception: false,
    });
    setShowEditModal(true);

    // Le listing admin (getAllProperties) n'embarque pas l'Accommodation —
    // seul le détail (getPropertyById) le fait. On la récupère à part pour
    // préremplir la section Hébergement sans dupliquer cette logique.
    if (property.status === 'hebergement') {
      try {
        const full = await getPropertyById(property._id);
        const acc = full?.accommodation;
        if (acc) {
          const nightlyRate = (acc.rates || []).find((r) => r.mode === 'nightly');
          setFormData((prev) => ({
            ...prev,
            accommodationType: acc.accommodationType || "",
            maxAdults: acc.capacity?.maxAdults ?? "",
            maxChildren: acc.capacity?.maxChildren ?? "",
            beds: acc.beds ?? "",
            checkInTime: acc.checkInTime || "14:00",
            checkOutTime: acc.checkOutTime || "11:00",
            minimumStay: acc.minimumStay ?? 1,
            maximumStay: acc.maximumStay ?? "",
            cancellationPolicy: acc.cancellationPolicy || "moderee",
            houseRules: Array.isArray(acc.houseRules) ? acc.houseRules.join(", ") : "",
            securityDeposit: acc.securityDeposit ?? 0,
            cleaningFee: acc.cleaningFee ?? 0,
            nightlyPrice: nightlyRate?.amount ?? "",
            accommodationAmenities: acc.amenities || { cuisine: [], salon: [], internet: [], exterieur: [], parking: [], securite: [] },
            rules: acc.rules || { petsAllowed: false, partiesAllowed: false, smokingAllowed: false, childrenAllowed: true, minimumAge: 0 },
            includedServices: acc.includedServices || { menage: false, petitDejeuner: false, blanchisserie: false, transfert: false, cuisine: false },
            // Établissement déjà rattaché : on prérempli en mode "existing" —
            // l'admin peut changer d'hôtel ou en créer un nouveau, mais on ne
            // duplique jamais la fiche Hotel existante au premier chargement.
            hotelMode: acc.hotel ? 'existing' : "",
            hotelId: acc.hotel ? String(acc.hotel) : "",
          }));
        }
      } catch {
        showNotif("Bien chargé, mais les informations d'hébergement n'ont pas pu être récupérées.", "error");
      }
    }
  };

  // Validation propre à l'hébergement — n'exige que les champs réellement
  // requis par le modèle Accommodation/RatePlan (jamais les champs de bail :
  // caution locative, profils locataires, documents requis).
  const validateHebergement = (data) => {
    const e = {};
    if (!data.accommodationType) e.accommodationType = "Le type d'hébergement est requis.";
    if (!(Number(data.maxAdults) > 0)) e.maxAdults = "La capacité (adultes) doit être supérieure à 0.";
    if (!data.checkInTime) e.checkInTime = "L'heure de check-in est requise.";
    if (!data.checkOutTime) e.checkOutTime = "L'heure de check-out est requise.";
    if (data.maximumStay !== "" && data.maximumStay !== undefined && data.maximumStay !== null) {
      const min = Number(data.minimumStay) || 1;
      const max = Number(data.maximumStay);
      if (max < min) e.maximumStay = "La durée maximale doit être ≥ à la durée minimale.";
    }
    if (data.nightlyPrice !== "" && data.nightlyPrice !== undefined && data.nightlyPrice !== null) {
      if (!(Number(data.nightlyPrice) > 0)) e.nightlyPrice = "Le prix par nuit doit être positif.";
    }
    // Établissement hôtelier requis uniquement pour accommodationType='hotel'
    // — villa_meublee/maison_meublee/appartement_meuble/studio_meuble/
    // chambre_hotes/residence_hoteliere/autre n'exigent aucune référence Hotel.
    if (data.accommodationType === 'hotel') {
      if (!data.hotelMode) {
        e.hotelMode = "Sélectionnez un établissement existant ou créez-en un nouveau.";
      } else if (data.hotelMode === 'existing' && !data.hotelId) {
        e.hotelId = "Un établissement hôtelier doit être sélectionné.";
      } else if (data.hotelMode === 'create') {
        if (!data.hotelName || !data.hotelName.trim()) {
          e.hotelName = "Le nom de l'hôtel est requis.";
        }
        if (data.hotelEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.hotelEmail)) {
          e.hotelEmail = "Adresse email invalide.";
        }
        if (data.hotelStarRating !== "" && data.hotelStarRating !== undefined && data.hotelStarRating !== null) {
          const stars = Number(data.hotelStarRating);
          if (!(stars >= 1 && stars <= 5)) e.hotelStarRating = "Le nombre d'étoiles doit être compris entre 1 et 5.";
        }
      }
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmit(true);
    try {
      if (!editingId && (!formData.images || formData.images.length === 0)) {
        showNotif("Veuillez ajouter au moins une image", "error");
        setSubmit(false);
        return;
      }

      const isHebergement = formData.status === 'hebergement';
      if (isHebergement) {
        const validationErrors = validateHebergement(formData);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          showNotif("Veuillez corriger les champs indiqués.", "error");
          setSubmit(false);
          return;
        }
      }

      const {
        address, amenities, images, latitude, longitude,
        // Champs hébergement — retirés du FormData générique Property et
        // ré-ajoutés explicitement ci-dessous (noms attendus par le backend).
        accommodationType, maxAdults, maxChildren, beds,
        checkInTime, checkOutTime, minimumStay, maximumStay,
        cancellationPolicy, houseRules, securityDeposit, cleaningFee, nightlyPrice,
        accommodationAmenities, rules, includedServices,
        hotelMode, hotelId, hotelName, hotelDescription, hotelStarRating,
        hotelPhone, hotelEmail, hotelWebsite, hotelServices, hotelHasRestaurant, hotelHasReception,
        ...rest
      } = formData;

      const data = new FormData();
      Object.entries(rest).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) data.append(k, v);
      });
      data.append('latitude', latitude);
      data.append('longitude', longitude);
      data.append("address", JSON.stringify(address));

      const amenitiesArray = typeof amenities === 'string'
        ? amenities.split(",").map(a => a.trim()).filter(Boolean)
        : (Array.isArray(amenities) ? amenities : []);
      data.append("amenities", JSON.stringify(amenitiesArray));

      images?.forEach(file => { if (file instanceof File) data.append("images", file); });

      if (editingId && existingImages.length > 0)
        data.append("existingImages", JSON.stringify(existingImages));

      data.append("location", JSON.stringify({
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      }));

      if (isHebergement) {
        data.append('accommodationType', accommodationType);
        if (maxAdults !== "") data.append('capacity[maxAdults]', maxAdults);
        if (maxChildren !== "") data.append('capacity[maxChildren]', maxChildren);
        if (beds !== "") data.append('beds', beds);
        data.append('checkInTime', checkInTime);
        data.append('checkOutTime', checkOutTime);
        data.append('minimumStay', minimumStay || 1);
        if (maximumStay !== "") data.append('maximumStay', maximumStay);
        data.append('cancellationPolicy', cancellationPolicy || 'moderee');
        if (houseRules) data.append('houseRules', houseRules);
        data.append('securityDeposit', securityDeposit || 0);
        data.append('cleaningFee', cleaningFee || 0);
        if (nightlyPrice !== "") data.append('nightlyPrice', nightlyPrice);
        // Nom distinct de "amenities" (déjà utilisé ci-dessus pour le champ
        // générique texte libre de Property) — voir accommodationController.buildAccommodationData.
        data.append('accommodationAmenities', JSON.stringify(accommodationAmenities || {}));
        data.append('rules', JSON.stringify(rules || {}));
        data.append('includedServices', JSON.stringify(includedServices || {}));

        // Établissement hôtelier — uniquement pertinent pour accommodationType
        // === 'hotel' ; jamais envoyé pour les autres types (voir
        // accommodationController.buildHotelInput côté backend).
        if (accommodationType === 'hotel' && hotelMode) {
          data.append('hotelMode', hotelMode);
          if (hotelMode === 'existing') {
            if (hotelId) data.append('hotelId', hotelId);
          } else if (hotelMode === 'create') {
            data.append('hotelName', hotelName || '');
            if (hotelDescription) data.append('hotelDescription', hotelDescription);
            if (hotelStarRating !== "") data.append('hotelStarRating', hotelStarRating);
            if (hotelPhone) data.append('hotelPhone', hotelPhone);
            if (hotelEmail) data.append('hotelEmail', hotelEmail);
            if (hotelWebsite) data.append('hotelWebsite', hotelWebsite);
            if (hotelServices) data.append('hotelServices', hotelServices);
            data.append('hotelHasRestaurant', hotelHasRestaurant ? 'true' : 'false');
            data.append('hotelHasReception', hotelHasReception ? 'true' : 'false');
          }
        }
      }

      if (editingId) {
        if (isHebergement) {
          const response = await updateFullAccommodation(editingId, data);
          setProperties(p => p.map(x => x._id === editingId ? response.property : x));
          showNotif("Hébergement modifié avec succès !");
        } else {
          const response = await updateProperty(editingId, data);
          setProperties(p => p.map(x => x._id === editingId ? response : x));
          showNotif("Bien modifié avec succès !");
        }
      } else {
        if (isHebergement) {
          await createFullAccommodation(data);
          showNotif("Hébergement créé avec succès !");
        } else {
          await addProperty(data);
          showNotif("Bien ajouté avec succès !");
        }
        fetchProperties();
      }
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || `Erreur lors de ${editingId ? "la modification" : "l'ajout"} du bien.`;
      showNotif(msg, "error");
    } finally {
      setSubmit(false);
    }
  };

  // Sprint A — SalePropertyForm/RentalPropertyForm gèrent leur propre appel
  // API et leurs propres erreurs ; ManagePropertiesPage n'a qu'à rafraîchir
  // la liste et fermer la modale en cas de succès.
  const handleSaleRentalCreateSuccess = () => {
    fetchProperties();
    resetForm();
  };
  const handleSaleRentalUpdateSuccess = (result) => {
    setProperties((p) => p.map((x) => (x._id === editingId ? result.property : x)));
    resetForm();
  };

  const handleToggleRecommande = async (propertyId, currentValue) => {
    try {
      await toggleRecommande(propertyId, !currentValue);
      setProperties(prev => prev.map(p =>
        p._id === propertyId ? { ...p, recommande: !currentValue } : p
      ));
      showNotif(!currentValue ? "Bien marqué comme recommandé" : "Recommandation retirée");
    } catch (err) {
      const msg = err.response?.data?.message || "Erreur lors de la mise à jour du statut recommandé";
      showNotif(msg, "error");
    }
  };

  const handleDelete = (id) => {
    setConfirm({
      isOpen: true,
      message: 'Êtes-vous sûr de vouloir supprimer ce bien ?',
      onConfirm: async () => {
        try {
          await deleteProperty(id);
          setProperties(p => p.filter(x => x._id !== id));
          showNotif("Bien supprimé !");
        } catch {
          showNotif("Erreur lors de la suppression.", "error");
        } finally {
          setConfirm({ isOpen: false, message: '', onConfirm: () => {} });
        }
      },
    });
  };

  const totalPages       = Math.ceil(filteredProperties.length / PROPERTIES_PER_PAGE);
  const currentProperties = filteredProperties.slice((currentPage - 1) * PROPERTIES_PER_PAGE, currentPage * PROPERTIES_PER_PAGE);

  // ── ConfirmDialog ──────────────────────────────────────────
  const ConfirmDialog = () => {
    if (!confirmState.isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center animate-slideUp">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmation Requise</h3>
          <p className="text-gray-600 text-center mb-6">{confirmState.message}</p>
          <div className="flex gap-4 w-full">
            <button onClick={() => setConfirm({ isOpen: false, message: '', onConfirm: () => {} })}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition">Annuler</button>
            <button onClick={confirmState.onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition shadow-md">Confirmer</button>
          </div>
        </div>
      </div>
    );
  };

  // ── PropertyCard ───────────────────────────────────────────
  const PropertyCard = ({ property }) => {
    return <PropertyManagementCard property={property} description={property.description} priceLabel={formatCurrencyXAF(property.price || 0)} badges={[{ label: property.type || 'Bien' }, { label: ({ vente: 'Vente', location: 'Location', hebergement: 'Hébergement' }[property.status] || 'Vente'), className: 'bg-gradient-to-r from-green-600 to-emerald-600' }]} footer={<>
          {property.amenities?.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1">
              {property.amenities.slice(0, 3).map((a, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">{a}</span>
              ))}
              {property.amenities.length > 3 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">+{property.amenities.length - 3}</span>
              )}
            </div>
          )}
          {!readOnly && canEdit && (
            <button
              onClick={() => handleToggleRecommande(property._id, property.recommande)}
              title={property.statusAdmin !== 'Validée' ? 'Pas encore validé — ne s\'affichera côté public qu\'une fois validé.' : ''}
              className={`mb-3 px-3 py-1 rounded-full text-xs font-medium transition ${
                property.recommande
                  ? 'bg-gold text-dark hover:bg-gold-light'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${property.statusAdmin !== 'Validée' ? 'opacity-70' : ''}`}
            >
              {property.recommande ? '★ Recommandé' : 'Recommander'}
            </button>
          )}
          </>} actions={<>
            {isStaffDocs(user) && (
              <Link href={`/dashboard/properties/${property._id}`} title="Piloter le patrimoine"
                className="flex-1 p-2.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </Link>
            )}
            {readOnly && (
              <Link href={ownerHref(property)} className="flex-1 p-2.5 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold">
                <Eye className="w-5 h-5" /> Voir
              </Link>
            )}
            {!readOnly && canEdit && (
              <button onClick={() => handleEditClick(property)}
                className="flex-1 p-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center" title="Modifier">
                <Edit className="w-5 h-5" />
              </button>
            )}
            {!readOnly && canDelete && (
              <button onClick={() => handleDelete(property._id)}
                className="flex-1 p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-600 hover:to-pink-600 rounded-xl transition-all hover:scale-110 hover:shadow-lg flex items-center justify-center" title="Supprimer">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </>} />;
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-xl font-bold text-gray-700">Chargement des biens…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 p-4 sm:p-10 font-sans">
      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn  { animation: fadeIn  0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
      `}</style>

      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white animate-slideUp ${
          notification.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-pink-600'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 animate-slideUp flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg flex-shrink-0">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl leading-tight font-black bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
              {{ vente: 'Vente', location: 'Location', hebergement: 'Hébergement' }[statusFilter] || 'Tous les biens'}
            </h1>
            <p className="text-sm sm:text-lg text-gray-600 font-medium mt-1">Gérez le patrimoine immobilier de <span className="font-bold text-blue-600">Altimmo</span></p>
          </div>
        </div>

        {isStaffDocs(user) && <PropertyPortfolioDashboard />}

        {section === 'vente' && <DashboardKpis items={[
          { key: 'active', label: 'Biens actifs', value: analytics?.kpis?.active }, { key: 'drafts', label: 'Brouillons', value: analytics?.kpis?.drafts },
          { key: 'published', label: 'Publiés', value: analytics?.kpis?.published }, { key: 'sold', label: 'Vendus', value: analytics?.kpis?.sold },
          { key: 'visits', label: 'Visites programmées', value: analytics?.kpis?.scheduledVisits }, { key: 'offers', label: 'Offres en attente', value: analytics?.kpis?.pendingOffers },
          { key: 'sales', label: 'Chiffre des ventes', value: analytics?.kpis?.salesAmount, format: 'money' }, { key: 'commissions', label: 'Commissions', value: analytics?.kpis?.commissions, format: 'money' },
        ]} loading={!analytics} />}
        {section === 'location' && <DashboardKpis items={[
          { key: 'available', label: 'Disponibles', value: analytics?.kpis?.available }, { key: 'occupied', label: 'Occupés', value: analytics?.kpis?.occupied },
          { key: 'contracts', label: 'Contrats actifs', value: analytics?.kpis?.activeContracts }, { key: 'expiring', label: 'Contrats à échéance', value: analytics?.kpis?.expiringContracts },
          { key: 'collected', label: 'Loyers encaissés', value: analytics?.kpis?.rentCollected, format: 'money' }, { key: 'unpaid', label: 'Loyers impayés', value: analytics?.kpis?.unpaidRent, format: 'money' },
          { key: 'penalties', label: 'Pénalités', value: analytics?.kpis?.penalties, format: 'money' }, { key: 'maintenance', label: 'Maintenance', value: analytics?.kpis?.maintenance },
          { key: 'notices', label: 'Préavis', value: analytics?.kpis?.notices },
        ]} loading={!analytics} />}

        {/* Barre */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="Rechercher un bien…" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} aria-label="Rechercher un bien immobilier"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
            </div>
            {!readOnly && canAddProperty && (
              <button onClick={openCreate}
                className="flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-full shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all hover:scale-105">
                <PlusCircle className="w-5 h-5" /> {section === 'vente' ? 'Ajouter un bien à vendre' : section === 'location' ? 'Ajouter un bien à louer' : section === 'hebergement' ? 'Ajouter un hébergement' : 'Ajouter'}
              </button>
            )}
          </div>
        </div>

        {/* Contenu */}
        {currentProperties.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-xl border-2 border-dashed border-blue-200 animate-slideUp">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 rounded-full text-blue-600"><Home className="w-12 h-12" /></div>
            </div>
            <p className="text-lg font-bold text-gray-700 mb-1">Aucun bien trouvé</p>
            <p className="text-sm text-gray-500">{readOnly ? 'Aucune annonce ne correspond à votre recherche.' : 'Utilisez le bouton Ajouter pour créer la première.'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {currentProperties.map(p => <PropertyCard key={p._id} property={p} />)}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-blue-50 transition"><ArrowLeft className="w-5 h-5" /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      page === currentPage ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105' : 'bg-white text-gray-700 hover:bg-blue-50'
                    }`}>{page}</button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 hover:bg-blue-50 transition"><ArrowRight className="w-5 h-5" /></button>
              </div>
            )}
          </>
        )}

        {/* Modal Ajouter */}
        {!readOnly && showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-2 sm:my-10 max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] flex flex-col animate-slideUp">
              <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white/95 z-20 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white"><Sparkles className="w-6 h-6" /></div>
                  <h2 className="pr-10 text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {addChoice ? `Ajouter — ${BUSINESS_TYPE_LABELS[addChoice] || addChoice}` : 'Ajouter une annonce'}
                  </h2>
                  <button onClick={resetForm} disabled={loadingSubmit}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"><X className="w-6 h-6" /></button>
                </div>
              </div>
              <div className="p-3 sm:p-6 overflow-y-auto flex-grow">
                {!addChoice && (
                  <PropertyWizard onComplete={handleWizardComplete} />
                )}

                {addChoice === 'vente' && (
                  <SalePropertyForm onSuccess={handleSaleRentalCreateSuccess} onCancel={() => setAddChoice(null)} />
                )}
                {addChoice === 'location' && (
                  <RentalPropertyForm onSuccess={handleSaleRentalCreateSuccess} onCancel={() => setAddChoice(null)} />
                )}
                {/* Sprint B2 — "Hôtel" ouvre désormais HotelPropertyForm (domaine
                    Hôtellerie dédié), jamais PropertyForm. Tous les autres types
                    d'hébergement (Sprint B1, inchangés) restent sur PropertyForm. */}
                {addChoice === 'hebergement' && HOTEL_ACCOMMODATION_TYPES.includes(formData.accommodationType) && (
                  <HotelPropertyForm accommodationType={formData.accommodationType} onSuccess={() => { resetForm(); fetchProperties(); }} onCancel={resetForm} />
                )}
                {addChoice === 'hebergement' && !HOTEL_ACCOMMODATION_TYPES.includes(formData.accommodationType) && (
                  <PropertyForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit} loading={loadingSubmit}
                    enableHebergement errors={errors} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Modifier */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-2 sm:my-10 max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] flex flex-col animate-slideUp">
              <div className="p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white/95 z-20 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white"><Edit className="w-6 h-6" /></div>
                  <h2 className="pr-10 text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Modifier {editingProperty?.status === 'vente' ? 'une vente' : editingProperty?.status === 'location' ? 'une location' : HOTEL_ACCOMMODATION_TYPES.includes(formData.accommodationType) ? 'un hôtel' : 'un hébergement'}</h2>
                  <button onClick={resetForm} disabled={loadingSubmit}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"><X className="w-6 h-6" /></button>
                </div>
              </div>
              <div className="p-3 sm:p-6 overflow-y-auto flex-grow">
                {editingProperty?.status === 'hebergement' && (
                  <PropertyForm formData={formData} setFormData={setFormData} onSubmit={handleSubmit} loading={loadingSubmit}
                    existingImages={existingImages} setExistingImages={setExistingImages}
                    enableHebergement errors={errors} isEditing />
                )}
                {editingProperty?.status !== 'hebergement' && editLoading && (
                  <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
                )}
                {editingProperty?.status === 'vente' && !editLoading && (
                  <SalePropertyForm
                    propertyId={editingId}
                    initialProperty={editFullData}
                    initialSale={editFullData?.sale}
                    existingImages={existingImages}
                    onSuccess={handleSaleRentalUpdateSuccess}
                    onCancel={resetForm}
                  />
                )}
                {editingProperty?.status === 'location' && !editLoading && (
                  <RentalPropertyForm
                    propertyId={editingId}
                    initialProperty={editFullData}
                    initialRental={editFullData?.rental}
                    existingImages={existingImages}
                    onSuccess={handleSaleRentalUpdateSuccess}
                    onCancel={resetForm}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </div>
  );
};

export default ManagePropertiesPage;
