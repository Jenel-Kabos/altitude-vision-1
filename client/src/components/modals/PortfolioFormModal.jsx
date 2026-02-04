import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Save,
  Loader2,
  Upload,
  Trash2,
  Sparkles,
  Calendar,
  User,
  Tag,
  Link as LinkIcon,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { createPortfolioItem, updatePortfolioItem } from '../../services/portfolioService';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://altitude-vision.onrender.com';

const CATEGORIES = [
  'Communication Digitale',
  'Branding & Design',
  'Stratégie de Contenu',
  'Campagne Publicitaire',
  'Production Audiovisuelle',
  'Relations Publiques',
  'Événementiel',
  'Autre',
];

const PortfolioFormModal = ({ item, onClose, onSuccess }) => {
  const isEditMode = !!item;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    pole: 'Altcom',
    category: 'Communication Digitale',
    images: [],
    link: '',
    client: '',
    tags: [],
    projectDate: new Date().toISOString().split('T')[0],
    isPublished: true,
  });

  const [imageUrls, setImageUrls] = useState(['']);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (item) {
      // Normaliser les URLs d'images
      const normalizedImages = (item.images || []).map(img => {
        // Si l'image commence par /uploads, ajouter le BACKEND_URL
        if (typeof img === 'string' && img.startsWith('/uploads')) {
          return `${BACKEND_URL}${img}`;
        }
        return img;
      });

      setFormData({
        title: item.title || '',
        description: item.description || '',
        pole: 'Altcom',
        category: item.category || 'Communication Digitale',
        images: normalizedImages,
        link: item.link || '',
        client: item.client || '',
        tags: item.tags || [],
        projectDate: item.projectDate ? item.projectDate.split('T')[0] : new Date().toISOString().split('T')[0],
        isPublished: item.isPublished !== undefined ? item.isPublished : true,
      });

      setImageUrls(normalizedImages.length > 0 ? normalizedImages : ['']);
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageUrlChange = (index, value) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
    
    // Filtrer les URLs vides et mettre à jour formData immédiatement
    const validUrls = newUrls.filter((url) => url && url.trim());
    setFormData((prev) => ({ 
      ...prev, 
      images: validUrls 
    }));
    
    // Debug log
    console.log('📸 Images après modification:', validUrls);
  };

  const addImageUrlField = () => {
    setImageUrls([...imageUrls, '']);
  };

  const removeImageUrlField = (index) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    const urlsToKeep = newUrls.length > 0 ? newUrls : [''];
    setImageUrls(urlsToKeep);
    
    const validUrls = urlsToKeep.filter((url) => url && url.trim());
    setFormData((prev) => ({ ...prev, images: validUrls }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
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

    if (formData.images.length === 0) {
      newErrors.images = 'Au moins une image est requise';
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
        pole: 'Altcom',
        images: formData.images.filter((url) => url && url.trim()),
      };

      console.log('📤 Données envoyées au backend:', dataToSubmit);

      if (isEditMode) {
        await updatePortfolioItem(item._id, dataToSubmit);
      } else {
        await createPortfolioItem(dataToSubmit);
      }

      onSuccess();
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la sauvegarde du projet';
      alert(errorMessage);
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
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl z-10">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-4 right-4 text-white hover:text-red-300 transition p-2 rounded-full bg-white/20"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8" />
            {isEditMode ? 'Modifier le Projet Portfolio' : 'Ajouter au Portfolio'}
          </h2>
          <p className="text-purple-100 mt-2">
            {isEditMode ? 'Mettez à jour ce projet' : 'Ajoutez une nouvelle réalisation Altcom'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Titre */}
          <div>
            <label htmlFor="title" className="block text-gray-700 font-semibold mb-2">
              Titre du Projet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Ex: Campagne Digitale TechStartup Congo"
              className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 transition ${
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
              rows="5"
              placeholder="Décrivez le projet, les objectifs atteints, les résultats..."
              className={`w-full p-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 transition resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
          </div>

          {/* Catégorie */}
          <div>
            <label htmlFor="category" className="block text-gray-700 font-semibold mb-2">
              Catégorie <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">Ce projet sera automatiquement classé dans Altcom</p>
          </div>

          {/* Client et Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="client" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-600" />
                Nom du Client
              </label>
              <input
                type="text"
                id="client"
                name="client"
                value={formData.client}
                onChange={handleChange}
                placeholder="Ex: TechStartup Congo"
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>
            <div>
              <label htmlFor="projectDate" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                Date du Projet
              </label>
              <input
                type="date"
                id="projectDate"
                name="projectDate"
                value={formData.projectDate}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>
          </div>

          {/* Lien */}
          <div>
            <label htmlFor="link" className="block text-gray-700 font-semibold mb-2 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-purple-600" />
              Lien vers le Projet (optionnel)
            </label>
            <input
              type="url"
              id="link"
              name="link"
              value={formData.link}
              onChange={handleChange}
              placeholder="https://example.com"
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 transition"
            />
          </div>

          {/* Images */}
          <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
            <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Images du Projet <span className="text-red-500">*</span>
            </h3>

            {errors.images && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {errors.images}
              </div>
            )}

            <div className="space-y-3">
              {imageUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleImageUrlChange(index, e.target.value)}
                    placeholder="https://images.unsplash.com/photo-... ou URL complète"
                    className="flex-1 p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                  {imageUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImageUrlField(index)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                      title="Supprimer cette image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addImageUrlField}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                <Upload className="w-4 h-4" />
                Ajouter une image
              </button>
            </div>

            <p className="text-xs text-gray-600 mt-3">
              💡 Astuce : Vous pouvez utiliser des URLs d'images Unsplash, Imgur, ou des liens directs vers vos images hébergées.
            </p>

            {/* Aperçu des images - TOUJOURS AFFICHER si au moins une URL */}
            {imageUrls.some(url => url && url.trim()) && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Aperçu des images ({imageUrls.filter(url => url && url.trim()).length}) :
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {imageUrls
                    .filter(url => url && url.trim())
                    .map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`Aperçu ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border-2 border-purple-300 shadow-md"
                          onError={(e) => {
                            console.error(`❌ Erreur de chargement de l'image ${index + 1}:`, img);
                            e.target.src = 'https://via.placeholder.com/200x150/9333EA/FFFFFF?text=Image+Invalide';
                            e.target.onerror = null; // Éviter une boucle infinie
                          }}
                          onLoad={() => {
                            console.log(`✅ Image ${index + 1} chargée avec succès:`, img);
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100">
                            Image {index + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50">
            <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Tags (Mots-clés)
            </h3>

            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-300 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Ex: Digital, SEO, Branding..."
                className="flex-1 p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Publié */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPublished"
              name="isPublished"
              checked={formData.isPublished}
              onChange={handleChange}
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="isPublished" className="text-gray-700 font-semibold">
              Publier ce projet (visible sur le site)
            </label>
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
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEditMode ? 'Mettre à jour' : 'Ajouter au Portfolio'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default PortfolioFormModal;