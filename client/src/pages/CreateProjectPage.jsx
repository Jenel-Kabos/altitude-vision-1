// src/pages/CreateProjectPage.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Target,
  Calendar,
  Clock,
  Users,
  Palette,
  Sparkles,
  DollarSign,
  MessageSquare,
  Camera,
  CheckCircle,
  Send,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { createQuoteRequest } from '../services/quoteService';

const CreateProjectPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    // 1. Informations client
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    referralSource: '',
    referralOther: '',
    
    // 2. Objectif
    eventType: '',
    eventTypeOther: '',
    eventGoal: '',
    eventAmbiance: '',
    
    // 3. Détails pratiques
    date: '',
    startTime: '',
    endTime: '',
    venueStatus: '',
    venueDetails: '',
    guests: '',
    
    // 4. Thème & style
    theme: '',
    colors: '',
    styleType: '',
    styleOther: '',
    essentialElements: '',
    
    // 5. Prestations
    services: [],
    servicesOther: '',
    
    // 6. Budget
    budget: '',
    budgetAdaptation: '',
    budgetPriority: '',
    
    // 7. Communication
    communicationManagement: '',
    musicalAmbiance: '',
    
    // 8. Inspirations
    hasMoodboard: '',
    moodboardLink: '',
    
    // 9. Prochaines étapes
    meetingDate: '',
    meetingType: '',
  });

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const steps = [
    { number: 1, title: 'Informations Client', icon: User },
    { number: 2, title: 'Objectif', icon: Target },
    { number: 3, title: 'Détails Pratiques', icon: Calendar },
    { number: 4, title: 'Thème & Style', icon: Palette },
    { number: 5, title: 'Prestations', icon: Sparkles },
    { number: 6, title: 'Budget', icon: DollarSign },
    { number: 7, title: 'Communication', icon: MessageSquare },
    { number: 8, title: 'Inspirations', icon: Camera },
    { number: 9, title: 'Confirmation', icon: CheckCircle },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      if (name === 'services') {
        const updatedServices = checked
          ? [...formData.services, value]
          : formData.services.filter(s => s !== value);
        setFormData({ ...formData, services: updatedServices });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const validateStep = (step) => {
    switch(step) {
      case 1:
        return formData.name && formData.phone && formData.email;
      case 2:
        return formData.eventType && formData.eventGoal;
      case 3:
        return formData.date && formData.guests;
      case 4:
        return formData.theme || formData.styleType;
      case 5:
        return formData.services.length > 0;
      case 6:
        return formData.budget;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 9));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert('Veuillez remplir tous les champs obligatoires');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    
    try {
      // Formater les données pour l'API avec structure complète
      const quoteData = {
        // Type de demande
        requestType: 'Projet Complet',
        
        // Informations de base
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        service: 'Création de Projet Complet',
        eventType: formData.eventType || 'Autre',
        date: formData.date,
        guests: parseInt(formData.guests) || 1,
        budget: formData.budget,
        
        // Description formatée (pour lecture humaine rapide)
        description: `
Type d'événement: ${formData.eventType} ${formData.eventTypeOther ? '(' + formData.eventTypeOther + ')' : ''}
Objectif: ${formData.eventGoal}
Ambiance souhaitée: ${formData.eventAmbiance}
Thème: ${formData.theme}
Date: ${new Date(formData.date).toLocaleDateString('fr-FR')}
Invités: ${formData.guests} personnes
Budget: ${formData.budget} FCFA
        `.trim(),
        
        // Données structurées complètes du projet
        projectDetails: {
          // 1. Informations client
          clientInfo: {
            company: formData.company,
            address: formData.address,
            referralSource: formData.referralSource,
            referralOther: formData.referralOther,
          },
          
          // 2. Objectif
          objective: {
            eventTypeOther: formData.eventTypeOther,
            eventGoal: formData.eventGoal,
            eventAmbiance: formData.eventAmbiance,
          },
          
          // 3. Détails pratiques
          practicalDetails: {
            startTime: formData.startTime,
            endTime: formData.endTime,
            venueStatus: formData.venueStatus,
            venueDetails: formData.venueDetails,
          },
          
          // 4. Thème & Style
          theme: {
            theme: formData.theme,
            colors: formData.colors,
            styleType: formData.styleType,
            styleOther: formData.styleOther,
            essentialElements: formData.essentialElements,
          },
          
          // 5. Prestations
          services: formData.services,
          servicesOther: formData.servicesOther,
          
          // 6. Budget détaillé
          budgetDetails: {
            budgetAdaptation: formData.budgetAdaptation,
            budgetPriority: formData.budgetPriority,
          },
          
          // 7. Communication
          communication: {
            communicationManagement: formData.communicationManagement,
            musicalAmbiance: formData.musicalAmbiance,
          },
          
          // 8. Inspirations
          inspirations: {
            hasMoodboard: formData.hasMoodboard,
            moodboardLink: formData.moodboardLink,
          },
          
          // 9. Prochaines étapes
          nextSteps: {
            meetingDate: formData.meetingDate || null,
            meetingType: formData.meetingType,
          },
        },
      };

      console.log('📤 [CreateProject] Envoi du projet complet:', quoteData);

      await createQuoteRequest(quoteData);
      
      setNotification({
        show: true,
        message: 'Votre projet a été envoyé avec succès ! Nous vous contacterons sous 24h.',
        type: 'success',
      });

      setTimeout(() => {
        navigate('/mila-events');
      }, 3000);
      
    } catch (error) {
      console.error('❌ [CreateProject] Erreur:', error);
      setNotification({
        show: true,
        message: 'Erreur lors de l\'envoi. Veuillez réessayer.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Notification */}
      {notification.show && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {notification.message}
        </motion.div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white py-12 shadow-xl">
        <div className="container mx-auto px-6">
          <button
            onClick={() => navigate('/mila-events')}
            className="flex items-center text-blue-100 hover:text-white mb-6 transition"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </button>
          
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-3">
              Formulaire de Création d'Événement
            </h1>
            <p className="text-xl text-blue-100">
              Mila Events — L'Art de l'Élégance
            </p>
            <p className="text-blue-200 mt-2">
              Créateur d'expériences événementielles inoubliables
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between overflow-x-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center min-w-[100px]">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition ${
                      currentStep === step.number
                        ? 'bg-blue-600 text-white scale-110 shadow-lg'
                        : currentStep > step.number
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className="text-xs mt-2 text-center font-semibold hidden md:block">
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 w-12 mx-2 transition ${
                      currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container mx-auto px-6 py-12">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto"
        >
          <form onSubmit={handleSubmit}>
            {/* Step 1: Informations Client */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <User className="w-8 h-8 mr-3 text-blue-600" />
                  1. Informations du Client
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Nom et prénom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Société / Organisation
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Téléphone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      E-mail <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Adresse</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Comment avez-vous connu Mila Events ?
                  </label>
                  <div className="space-y-2">
                    {['Réseaux sociaux', 'Recommandation', 'Site web', 'Autre'].map((source) => (
                      <label key={source} className="flex items-center">
                        <input
                          type="radio"
                          name="referralSource"
                          value={source}
                          checked={formData.referralSource === source}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span>{source}</span>
                      </label>
                    ))}
                  </div>
                  {formData.referralSource === 'Autre' && (
                    <input
                      type="text"
                      name="referralOther"
                      value={formData.referralOther}
                      onChange={handleChange}
                      placeholder="Précisez..."
                      className="w-full p-3 border border-gray-300 rounded-lg mt-3 focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Objectif */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <Target className="w-8 h-8 mr-3 text-blue-600" />
                  2. Objectif de l'Événement
                </h2>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Type d'événement <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Mariage', 'Anniversaire', 'Soirée d\'entreprise', 'Lancement de produit', 'Conférence / Séminaire', 'Autre'].map((type) => (
                      <label key={type} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="eventType"
                          value={type}
                          checked={formData.eventType === type}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span className="text-sm">{type}</span>
                      </label>
                    ))}
                  </div>
                  {formData.eventType === 'Autre' && (
                    <input
                      type="text"
                      name="eventTypeOther"
                      value={formData.eventTypeOther}
                      onChange={handleChange}
                      placeholder="Précisez le type..."
                      className="w-full p-3 border border-gray-300 rounded-lg mt-3 focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Quel est l'objectif principal ? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="eventGoal"
                    value={formData.eventGoal}
                    onChange={handleChange}
                    required
                    rows="3"
                    placeholder="Ex: célébrer, remercier, promouvoir, réunir, divertir..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Message ou ambiance souhaitée
                  </label>
                  <input
                    type="text"
                    name="eventAmbiance"
                    value={formData.eventAmbiance}
                    onChange={handleChange}
                    placeholder="Ex: chic, festif, professionnel, romantique, décontracté..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Détails Pratiques */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <Calendar className="w-8 h-8 mr-3 text-blue-600" />
                  3. Détails Pratiques
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Date souhaitée <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Heure de début</label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">Heure de fin</label>
                    <input
                      type="time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Lieu de l'événement
                  </label>
                  <div className="space-y-2">
                    {['À déterminer', 'Déjà réservé'].map((status) => (
                      <label key={status} className="flex items-center">
                        <input
                          type="radio"
                          name="venueStatus"
                          value={status}
                          checked={formData.venueStatus === status}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span>{status}</span>
                      </label>
                    ))}
                  </div>
                  {formData.venueStatus === 'Déjà réservé' && (
                    <input
                      type="text"
                      name="venueDetails"
                      value={formData.venueDetails}
                      onChange={handleChange}
                      placeholder="Précisez le lieu..."
                      className="w-full p-3 border border-gray-300 rounded-lg mt-3 focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Nombre estimé de participants <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="guests"
                    value={formData.guests}
                    onChange={handleChange}
                    required
                    min="1"
                    placeholder="Ex: 150"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Thème & Style */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <Palette className="w-8 h-8 mr-3 text-blue-600" />
                  4. Thème & Style
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Thème souhaité
                    </label>
                    <input
                      type="text"
                      name="theme"
                      value={formData.theme}
                      onChange={handleChange}
                      placeholder="Ex: Gatsby, Tropical, Jardin secret..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Couleurs dominantes
                    </label>
                    <input
                      type="text"
                      name="colors"
                      value={formData.colors}
                      onChange={handleChange}
                      placeholder="Ex: Bleu marine et or, Rose poudré..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Style recherché
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Classique', 'Moderne', 'Romantique', 'Bohème', 'Tropical chic', 'Autre'].map((style) => (
                      <label key={style} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="styleType"
                          value={style}
                          checked={formData.styleType === style}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span className="text-sm">{style}</span>
                      </label>
                    ))}
                  </div>
                  {formData.styleType === 'Autre' && (
                    <input
                      type="text"
                      name="styleOther"
                      value={formData.styleOther}
                      onChange={handleChange}
                      placeholder="Précisez le style..."
                      className="w-full p-3 border border-gray-300 rounded-lg mt-3 focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Éléments indispensables à inclure
                  </label>
                  <textarea
                    name="essentialElements"
                    value={formData.essentialElements}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Ex: piste de danse, photobooth, mur floral, projection..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Prestations */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <Sparkles className="w-8 h-8 mr-3 text-blue-600" />
                  5. Prestations Souhaitées <span className="text-red-500">*</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    'Conception & coordination complète',
                    'Décoration / scénographie',
                    'Location de salle',
                    'Son & lumière',
                    'Traiteur / bar',
                    'Animation musicale / DJ',
                    'Photographe / vidéaste',
                    'Impression et papeterie',
                    'Gestion protocolaire',
                  ].map((service) => (
                    <label key={service} className="flex items-start p-3 border border-gray-300 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        name="services"
                        value={service}
                        checked={formData.services.includes(service)}
                        onChange={handleChange}
                        className="mr-3 mt-1"
                      />
                      <span>{service}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Autre (précisez)
                  </label>
                  <input
                    type="text"
                    name="servicesOther"
                    value={formData.servicesOther}
                    onChange={handleChange}
                    placeholder="Autres prestations souhaitées..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Step 6: Budget */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <DollarSign className="w-8 h-8 mr-3 text-blue-600" />
                  6. Budget Prévisionnel
                </h2>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Budget total estimé (en FCFA) <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionnez une tranche</option>
                    <option value="Moins de 1M">Moins de 1 000 000 FCFA</option>
                    <option value="1M-5M">1 000 000 - 5 000 000 FCFA</option>
                    <option value="5M-10M">5 000 000 - 10 000 000 FCFA</option>
                    <option value="Plus de 10M">Plus de 10 000 000 FCFA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Souhaitez-vous une proposition adaptée à votre budget ?
                  </label>
                  <div className="space-y-2">
                    {['Oui', 'Non'].map((option) => (
                      <label key={option} className="flex items-center">
                        <input
                          type="radio"
                          name="budgetAdaptation"
                          value={option}
                          checked={formData.budgetAdaptation === option}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Priorité du client
                  </label>
                  <div className="space-y-3">
                    {[
                      { value: 'Qualité & prestige', desc: 'Le meilleur sans compromis' },
                      { value: 'Équilibre qualité/prix', desc: 'Optimal rapport qualité-prix' },
                      { value: 'Simplicité & efficacité', desc: 'Essentiel et fonctionnel' },
                    ].map((priority) => (
                      <label key={priority.value} className="flex items-start p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 cursor-pointer transition">
                        <input
                          type="radio"
                          name="budgetPriority"
                          value={priority.value}
                          checked={formData.budgetPriority === priority.value}
                          onChange={handleChange}
                          className="mr-3 mt-1"
                        />
                        <div>
                          <div className="font-semibold">{priority.value}</div>
                          <div className="text-sm text-gray-600">{priority.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 7: Communication */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <MessageSquare className="w-8 h-8 mr-3 text-blue-600" />
                  7. Communication & Ambiance
                </h2>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Souhaitez-vous que Mila Events gère la communication autour de l'événement ?
                  </label>
                  <div className="space-y-2">
                    {['Oui (réseaux sociaux, visuels, campagne presse)', 'Non'].map((option) => (
                      <label key={option} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="communicationManagement"
                          value={option}
                          checked={formData.communicationManagement === option}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Ambiance musicale ou artistique souhaitée
                  </label>
                  <textarea
                    name="musicalAmbiance"
                    value={formData.musicalAmbiance}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Ex: Jazz live, DJ house, groupe afrobeat, orchestre classique..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Step 8: Inspirations */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <Camera className="w-8 h-8 mr-3 text-blue-600" />
                  8. Inspirations & Références
                </h2>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Avez-vous un moodboard, une photo, ou un lien Pinterest ?
                  </label>
                  <div className="space-y-2">
                    {[
                      'Oui, j\'ai des références visuelles',
                      'Non, je souhaite que Mila Events le conçoive pour moi',
                    ].map((option) => (
                      <label key={option} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="hasMoodboard"
                          value={option}
                          checked={formData.hasMoodboard === option}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.hasMoodboard === 'Oui, j\'ai des références visuelles' && (
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Lien vers votre moodboard (Pinterest, Google Drive, etc.)
                    </label>
                    <input
                      type="url"
                      name="moodboardLink"
                      value={formData.moodboardLink}
                      onChange={handleChange}
                      placeholder="https://..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      💡 Vous pouvez créer un tableau Pinterest ou partager un dossier Google Drive avec vos inspirations
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 9: Prochaines étapes */}
            {currentStep === 9 && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                  <CheckCircle className="w-8 h-8 mr-3 text-green-600" />
                  9. Étapes Suivantes
                </h2>

                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                  <h3 className="text-xl font-bold text-blue-900 mb-3">Résumé de votre projet</h3>
                  <div className="space-y-2 text-gray-700">
                    <p><strong>Client :</strong> {formData.name}</p>
                    <p><strong>Type d'événement :</strong> {formData.eventType}</p>
                    <p><strong>Date :</strong> {new Date(formData.date).toLocaleDateString('fr-FR')}</p>
                    <p><strong>Invités :</strong> {formData.guests} personnes</p>
                    <p><strong>Budget :</strong> {formData.budget} FCFA</p>
                    <p><strong>Prestations :</strong> {formData.services.length} service(s) sélectionné(s)</p>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Date souhaitée pour la rencontre de briefing
                  </label>
                  <input
                    type="date"
                    name="meetingDate"
                    value={formData.meetingDate}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">
                    Préférence pour la rencontre
                  </label>
                  <div className="space-y-2">
                    {['En personne', 'En visio (Zoom / WhatsApp)'].map((type) => (
                      <label key={type} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name="meetingType"
                          value={type}
                          checked={formData.meetingType === type}
                          onChange={handleChange}
                          className="mr-3"
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                  <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center">
                    <CheckCircle className="w-6 h-6 mr-2" />
                    Prêt à envoyer votre demande ?
                  </h3>
                  <p className="text-gray-700 mb-4">
                    En cliquant sur "Envoyer", votre projet sera transmis à notre équipe qui vous contactera sous <strong>24h</strong>.
                  </p>
                  <ul className="space-y-2 text-gray-600">
                    <li>✓ Consultation personnalisée gratuite</li>
                    <li>✓ Devis détaillé sous 48h</li>
                    <li>✓ Accompagnement de A à Z</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-12 pt-6 border-t">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Précédent
                </button>
              )}

              {currentStep < 9 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold ml-auto"
                >
                  Suivant
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-lg ml-auto disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-6 h-6" />
                      Envoyer mon Projet
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default CreateProjectPage;