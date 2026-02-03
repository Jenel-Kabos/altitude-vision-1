import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Upload, Calendar, DollarSign, Target, Briefcase, Users, FileText, Check } from 'lucide-react';

const AltcomProjectFormModal = ({ onClose, onFormSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Informations générales
    projectName: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    
    // Détails du projet
    projectType: 'Communication Digitale',
    projectCategory: 'Stratégie',
    targetAudience: '',
    objectives: '',
    
    // Budget et timing
    budget: '',
    deadline: '',
    startDate: '',
    
    // Description détaillée
    detailedDescription: '',
    currentSituation: '',
    expectedResults: '',
    
    // Fichiers/Assets (optionnel)
    hasExistingMaterials: false,
    materialsDescription: '',
  });

  const totalSteps = 4;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.projectName || !formData.contactName || !formData.email || !formData.detailedDescription) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onFormSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Erreur lors de la création du projet:", error);
      alert(error.message || "Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Progress bar
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 relative">
          <motion.button
            onClick={onClose}
            whileHover={{ rotate: 90 }}
            className="absolute top-4 right-4 text-white hover:text-red-300 transition duration-300 p-2 rounded-full bg-white/20 backdrop-blur-sm"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </motion.button>

          <h3 className="text-3xl font-extrabold mb-2">Créer un Projet Altcom</h3>
          <p className="text-blue-100 text-sm">
            Étape {currentStep} sur {totalSteps}
          </p>
          
          {/* Progress Bar */}
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.3 }}
              className="bg-white h-full rounded-full"
            />
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <AnimatePresence mode="wait">
            {/* Étape 1: Informations Générales */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <h4 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                  Informations Générales
                </h4>

                <div>
                  <label htmlFor="projectName" className="block text-gray-700 font-semibold mb-2">
                    Nom du Projet <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="projectName"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleChange}
                    placeholder="Ex: Campagne de Lancement Produit X"
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="companyName" className="block text-gray-700 font-semibold mb-2">
                      Entreprise/Organisation
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      placeholder="Votre entreprise"
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="contactName" className="block text-gray-700 font-semibold mb-2">
                      Nom du Contact <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="contactName"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleChange}
                      placeholder="Votre nom complet"
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-gray-700 font-semibold mb-2">
                      Email Professionnel <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="email@entreprise.com"
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-gray-700 font-semibold mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+242 XX XXX XXXX"
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Étape 2: Type et Cible du Projet */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <h4 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Target className="w-6 h-6 text-blue-600" />
                  Type et Cible du Projet
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="projectType" className="block text-gray-700 font-semibold mb-2">
                      Type de Projet <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="projectType"
                      name="projectType"
                      value={formData.projectType}
                      onChange={handleChange}
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    >
                      <option value="Communication Digitale">Communication Digitale</option>
                      <option value="Branding & Design">Branding & Design</option>
                      <option value="Stratégie de Contenu">Stratégie de Contenu</option>
                      <option value="Campagne Publicitaire">Campagne Publicitaire</option>
                      <option value="Relations Publiques">Relations Publiques</option>
                      <option value="Événementiel">Événementiel</option>
                      <option value="Refonte Site Web">Refonte Site Web</option>
                      <option value="Production Audiovisuelle">Production Audiovisuelle</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="projectCategory" className="block text-gray-700 font-semibold mb-2">
                      Catégorie
                    </label>
                    <select
                      id="projectCategory"
                      name="projectCategory"
                      value={formData.projectCategory}
                      onChange={handleChange}
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    >
                      <option value="Stratégie">Stratégie</option>
                      <option value="Création">Création</option>
                      <option value="Production">Production</option>
                      <option value="Diffusion">Diffusion</option>
                      <option value="Conseil">Conseil</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="targetAudience" className="block text-gray-700 font-semibold mb-2">
                    Public Cible <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="targetAudience"
                    name="targetAudience"
                    value={formData.targetAudience}
                    onChange={handleChange}
                    placeholder="Ex: Jeunes professionnels 25-35 ans, B2B, Grand public..."
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                  />
                </div>

                <div>
                  <label htmlFor="objectives" className="block text-gray-700 font-semibold mb-2">
                    Objectifs Principaux <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="objectives"
                    name="objectives"
                    value={formData.objectives}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Ex: Augmenter la notoriété de marque de 30%, générer 500 leads qualifiés, positionner l'entreprise comme leader..."
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg resize-none"
                  ></textarea>
                </div>
              </motion.div>
            )}

            {/* Étape 3: Budget et Timing */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <h4 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-blue-600" />
                  Budget et Planning
                </h4>

                <div>
                  <label htmlFor="budget" className="block text-gray-700 font-semibold mb-2">
                    Budget Estimé <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="budget"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                  >
                    <option value="">Sélectionnez un budget</option>
                    <option value="Moins de 500K">Moins de 500 000 FCFA</option>
                    <option value="500K-1M">500 000 - 1 000 000 FCFA</option>
                    <option value="1M-3M">1 000 000 - 3 000 000 FCFA</option>
                    <option value="3M-5M">3 000 000 - 5 000 000 FCFA</option>
                    <option value="5M-10M">5 000 000 - 10 000 000 FCFA</option>
                    <option value="Plus de 10M">Plus de 10 000 000 FCFA</option>
                    <option value="À définir">À définir ensemble</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startDate" className="block text-gray-700 font-semibold mb-2">
                      Date de Début Souhaitée
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    />
                  </div>

                  <div>
                    <label htmlFor="deadline" className="block text-gray-700 font-semibold mb-2">
                      Date Limite de Livraison
                    </label>
                    <input
                      type="date"
                      id="deadline"
                      name="deadline"
                      value={formData.deadline}
                      onChange={handleChange}
                      className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Conseil:</strong> Un délai réaliste nous permet de garantir une qualité optimale. 
                    La plupart de nos projets nécessitent 4 à 8 semaines de production.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Étape 4: Description Détaillée */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <h4 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Description Détaillée
                </h4>

                <div>
                  <label htmlFor="detailedDescription" className="block text-gray-700 font-semibold mb-2">
                    Description du Projet <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="detailedDescription"
                    name="detailedDescription"
                    value={formData.detailedDescription}
                    onChange={handleChange}
                    rows="5"
                    maxLength="2000"
                    placeholder="Décrivez votre projet en détail: contexte, ambitions, contraintes spécifiques..."
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg resize-none"
                  ></textarea>
                  <p className="text-sm text-gray-500 mt-1">{formData.detailedDescription.length}/2000 caractères</p>
                </div>

                <div>
                  <label htmlFor="currentSituation" className="block text-gray-700 font-semibold mb-2">
                    Situation Actuelle
                  </label>
                  <textarea
                    id="currentSituation"
                    name="currentSituation"
                    value={formData.currentSituation}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Quelle est votre situation actuelle en termes de communication? Quels sont les défis rencontrés?"
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg resize-none"
                  ></textarea>
                </div>

                <div>
                  <label htmlFor="expectedResults" className="block text-gray-700 font-semibold mb-2">
                    Résultats Attendus
                  </label>
                  <textarea
                    id="expectedResults"
                    name="expectedResults"
                    value={formData.expectedResults}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Quels résultats concrets attendez-vous? Comment mesurerez-vous le succès?"
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-lg resize-none"
                  ></textarea>
                </div>

                <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="hasExistingMaterials"
                      name="hasExistingMaterials"
                      checked={formData.hasExistingMaterials}
                      onChange={handleChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="hasExistingMaterials" className="text-gray-700 font-semibold">
                      J'ai des supports existants (logos, chartes graphiques, contenus...)
                    </label>
                  </div>

                  {formData.hasExistingMaterials && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <textarea
                        id="materialsDescription"
                        name="materialsDescription"
                        value={formData.materialsDescription}
                        onChange={handleChange}
                        rows="2"
                        placeholder="Décrivez brièvement vos supports existants..."
                        className="w-full p-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 resize-none"
                      ></textarea>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer avec boutons de navigation */}
        <div className="bg-gray-50 border-t-2 border-gray-200 p-6 flex justify-between items-center">
          <motion.button
            onClick={handlePrev}
            disabled={currentStep === 1 || isSubmitting}
            whileHover={{ scale: currentStep === 1 ? 1 : 1.05 }}
            whileTap={{ scale: currentStep === 1 ? 1 : 0.95 }}
            className={`px-6 py-3 rounded-xl font-bold text-lg transition duration-300 ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            Précédent
          </motion.button>

          {currentStep < totalSteps ? (
            <motion.button
              onClick={handleNext}
              whileHover={{ scale: 1.05, boxShadow: "0 8px 20px rgba(59, 130, 246, 0.4)" }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-blue-700 transition duration-300 flex items-center gap-2"
            >
              Suivant
              <Check className="w-5 h-5" />
            </motion.button>
          ) : (
            <motion.button
              onClick={handleSubmit}
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.05, boxShadow: isSubmitting ? "" : "0 10px 25px rgba(34, 197, 94, 0.4)" }}
              whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
              className={`px-8 py-3 ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
              } text-white font-bold text-lg rounded-xl shadow-lg transition duration-300 flex items-center gap-2`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Soumettre le Projet
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AltcomProjectFormModal;