import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Loader2, Plus, Trash2, DollarSign, FileText, Tag } from 'lucide-react';
import { createService, updateService } from '../../services/serviceService';

const ServiceFormModal = ({ service, onClose, onSuccess }) => {
  const isEditMode = !!service;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    pole: 'Altcom',
    price: '',
    imageUrl: '',
    options: [],
  });

  const [newOption, setNewOption] = useState({
    name: '',
    price: '',
    description: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (service) {
      setFormData({
        title: service.title || '',
        description: service.description || '',
        pole: service.pole || 'Altcom',
        price: service.price || '',
        imageUrl: service.imageUrl || '',
        options: service.options || [],
      });
    }
  }, [service]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddOption = () => {
    if (!newOption.name || !newOption.price) {
      alert('Veuillez remplir le nom et le prix de l\'option');
      return;
    }

    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { ...newOption, price: Number(newOption.price) }]
    }));

    setNewOption({ name: '', price: '', description: '' });
  };

  const handleRemoveOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Le titre est requis';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'La description est requise';
    }

    if (!formData.price || formData.price <= 0) {
      newErrors.price = 'Le prix doit être supérieur à 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const dataToSubmit = {
        ...formData,
        price: Number(formData.price),
      };

      if (isEditMode) {
        await updateService(service._id, dataToSubmit);
      } else {
        await createService(dataToSubmit);
      }

      onSuccess();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(error.response?.data?.message || 'Erreur lors de la sauvegarde du service');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl z-10">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-4 right-4 text-white hover:text-red-300 transition p-2 rounded-full bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="w-8 h-8" />
            {isEditMode ? 'Modifier le Service' : 'Créer un Nouveau Service'}
          </h2>
          <p className="text-blue-100 mt-2">
            {isEditMode ? 'Mettez à jour les informations du service' : 'Ajoutez un nouveau service Altcom'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Titre */}
          <div>
            <label htmlFor="title" className="block text-gray-700 font-semibold mb-2">
              Titre du Service <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Ex: Communication Digitale"
              className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-gray-700 font-semibold mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Décrivez le service en détail..."
              className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
          </div>

          {/* Prix */}
          <div>
            <label htmlFor="price" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Prix de Base (FCFA) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="1000"
              placeholder="Ex: 500000"
              className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
                errors.price ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="imageUrl" className="block text-gray-700 font-semibold mb-2">
              URL de l'Image (optionnel)
            </label>
            <input
              type="url"
              id="imageUrl"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
            />
            {formData.imageUrl && (
              <div className="mt-3">
                <p className="text-sm text-gray-600 mb-2">Aperçu :</p>
                <img
                  src={formData.imageUrl}
                  alt="Aperçu"
                  className="w-full h-48 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/400x200?text=Image+Invalide';
                  }}
                />
              </div>
            )}
          </div>

          {/* Options du Service */}
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50">
            <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Options du Service (Facultatif)
            </h3>

            {/* Liste des options existantes */}
            {formData.options.length > 0 && (
              <div className="space-y-2 mb-4">
                {formData.options.map((option, index) => (
                  <div
                    key={index}
                    className="bg-white p-3 rounded-lg border border-blue-200 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{option.name}</p>
                      <p className="text-sm text-gray-600">{option.description}</p>
                      <p className="text-sm text-green-600 font-bold">
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'XAF',
                          maximumFractionDigits: 0,
                        }).format(option.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire pour ajouter une nouvelle option */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Nom de l'option
                  </label>
                  <input
                    type="text"
                    value={newOption.name}
                    onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
                    placeholder="Ex: Gestion réseaux sociaux"
                    className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Prix (FCFA)
                  </label>
                  <input
                    type="number"
                    value={newOption.price}
                    onChange={(e) => setNewOption({ ...newOption, price: e.target.value })}
                    placeholder="Ex: 300000"
                    min="0"
                    className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Description (optionnel)
                </label>
                <input
                  type="text"
                  value={newOption.description}
                  onChange={(e) => setNewOption({ ...newOption, description: e.target.value })}
                  placeholder="Ex: 3 posts/semaine"
                  className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleAddOption}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <Plus className="w-4 h-4" />
                Ajouter cette option
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition font-semibold disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEditMode ? 'Mettre à jour' : 'Créer le Service'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ServiceFormModal;