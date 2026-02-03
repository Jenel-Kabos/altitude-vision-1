import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, MapPin, Plus, Edit, Trash2, Search, X, Loader, AlertTriangle, 
  Send, ArrowLeft, ArrowRight, Sparkles, 
  Image as ImageIcon, Upload, Video, Users, Target, Lightbulb, Settings, TrendingUp, Film
} from 'lucide-react';
import { getAllEvents, getEventById, uploadEventImages, uploadEventVideos } from '../../services/eventService';
import api from '../../services/api';

const EVENTS_PER_PAGE = 8;

const ManageEventsPage = () => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [currentPage, setCurrentPage] = useState(1);
  const [saveStatus, setSaveStatus] = useState('');
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => { fetchEvents(); }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = events.filter((event) =>
        event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEvents(filtered);
    } else {
      setFilteredEvents(events);
    }
    setCurrentPage(1);
  }, [searchTerm, events]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllEvents();
      setEvents(data);
      setFilteredEvents(data);
    } catch (err) {
      console.error('Erreur lors du chargement des événements:', err);
      setError('Impossible de charger les événements');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
  };

  const handleAdd = () => {
    setModalMode('add');
    setSelectedEvent(null);
    setShowModal(true);
  };

  const handleEdit = async (eventId) => {
    try {
      const event = await getEventById(eventId);
      setSelectedEvent(event);
      setModalMode('edit');
      setShowModal(true);
    } catch (err) {
      showNotification('Erreur lors du chargement de l\'événement', 'error');
    }
  };

  const handleDelete = (eventId) => {
    setConfirmState({
      isOpen: true,
      message: `Êtes-vous sûr de vouloir supprimer cet événement ?`,
      onConfirm: async () => {
        try {
          await api.delete(`/events/${eventId}`);
          showNotification('Événement supprimé avec succès');
          fetchEvents();
          setConfirmState({ isOpen: false, message: '', onConfirm: () => {} });
        } catch (err) {
          showNotification('Erreur lors de la suppression', 'error');
          setConfirmState({ isOpen: false, message: '', onConfirm: () => {} });
        }
      },
    });
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (modalMode === 'add') {
        await api.post('/events', formData);
        showNotification('Événement créé avec succès');
      } else {
        await api.put(`/events/${selectedEvent._id}`, formData);
        showNotification('Événement modifié avec succès');
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Erreur lors de l\'enregistrement', 'error');
    }
  };

  const totalPages = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
  const currentEvents = filteredEvents.slice(startIndex, startIndex + EVENTS_PER_PAGE);

  const ConfirmDialog = () => {
    if (!confirmState.isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center animate-slideUp">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmation Requise</h3>
          <p className="text-gray-600 text-center mb-6">{confirmState.message}</p>
          <div className="flex gap-4 w-full">
            <button
              onClick={() => setConfirmState({ isOpen: false, message: '', onConfirm: () => {} })}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={confirmState.onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const EventCard = ({ event }) => {
    const formattedDate = event.date ? new Date(event.date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : 'Date non définie';

    const hasVideos = event.videos && event.videos.length > 0;

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group animate-slideUp">
        <div className="relative h-48 overflow-hidden">
          <img
            src={event.images?.[0] || 'https://placehold.co/600x400/818CF8/FFFFFF?text=Mila+Events'}
            alt={event.name}
            className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
            onError={(e) => { e.target.src = 'https://placehold.co/600x400/818CF8/FFFFFF?text=Mila+Events'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <span className="absolute top-2 left-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            {event.category || 'Événement'}
          </span>
          {hasVideos && (
            <span className="absolute top-2 right-2 bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
              <Video className="w-3 h-3" />
              {event.videos.length}
            </span>
          )}
          {event.guests && (
            <span className="absolute bottom-2 right-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
              <Users className="w-3 h-3" />
              {event.guests}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-1">{event.name}</h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{event.description}</p>

          <div className="space-y-2 text-sm text-gray-500 mb-4">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-red-500" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(event._id)}
              className="flex-1 p-2.5 text-indigo-600 hover:text-white bg-indigo-50 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg flex items-center justify-center"
              title="Modifier"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(event._id)}
              className="flex-1 p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-600 hover:to-pink-600 rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-lg flex items-center justify-center"
              title="Supprimer"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-16 h-16 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-700">Chargement des événements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-10 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
      `}</style>

      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white animate-slideUp ${
          notification.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-pink-600'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-slideUp">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Gestion des Événements
                </h1>
                <p className="text-lg text-gray-600 font-medium mt-1">
                  Gérez les événements de <span className="font-bold text-indigo-600">Mila Events</span>
                </p>
              </div>
            </div>
            {saveStatus && (
              <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                saveStatus.includes('✓') ? 'bg-emerald-100 text-emerald-700' :
                saveStatus.includes('✗') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {saveStatus}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-100 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un événement..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-full shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 hover:scale-105 hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg animate-slideUp">
            <div className="flex items-center">
              <AlertTriangle className="text-red-500 w-6 h-6 mr-3" />
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {currentEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-xl border-2 border-dashed border-indigo-200 animate-slideUp">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-indigo-100 rounded-full shadow-md text-indigo-600">
                <Calendar className="w-12 h-12" />
              </div>
            </div>
            <p className="text-lg font-bold text-gray-700 mb-1">Aucun événement trouvé</p>
            <p className="text-sm text-gray-500">Cliquez sur <span className="font-semibold text-indigo-600">Ajouter</span> pour créer le premier.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {currentEvents.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      page === currentPage 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105' 
                        : 'bg-white text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {showModal && (
          <EventModal 
            mode={modalMode} 
            event={selectedEvent} 
            onClose={() => setShowModal(false)} 
            onSubmit={handleFormSubmit} 
          />
        )}

        <ConfirmDialog />
      </div>
    </div>
  );
};

const EventModal = ({ mode, event, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: event?.name || '',
    description: event?.description || '',
    date: event?.date ? event.date.split('T')[0] : '',
    location: event?.location || '',
    category: event?.category || 'Événement',
    guests: event?.guests || '',
    objective: event?.objective || '',
    creativeConcept: event?.creativeConcept || '',
    realization: event?.realization || '',
    result: event?.result || '',
    images: event?.images || [],
    videos: event?.videos || [],
  });
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [formError, setFormError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    { id: 'basic', title: '1. Informations de base' },
    { id: 'details', title: '2. Détails de l\'événement' },
    { id: 'media', title: '3. Médias' }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddUrlImage = () => {
    if (imageUrl && !formData.images.includes(imageUrl)) {
      setFormData({ ...formData, images: [...formData.images, imageUrl] });
      setImageUrl('');
    }
  };

  const handleAddUrlVideo = () => {
    if (videoUrl && !formData.videos.includes(videoUrl)) {
      if (formData.videos.length >= 3) {
        alert('Maximum 3 vidéos autorisées par événement');
        return;
      }
      setFormData({ ...formData, videos: [...formData.videos, videoUrl] });
      setVideoUrl('');
    }
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingImage(true);
      const uploadedUrls = await uploadEventImages(files);
      setFormData({ ...formData, images: [...formData.images, ...uploadedUrls] });
      if (imageInputRef.current) imageInputRef.current.value = '';
    } catch (error) {
      alert(error.message || 'Erreur lors de l\'upload des images');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (formData.videos.length + files.length > 3) {
      alert('Maximum 3 vidéos autorisées par événement');
      return;
    }

    try {
      setIsUploadingVideo(true);
      const uploadedUrls = await uploadEventVideos(files);
      setFormData({ ...formData, videos: [...formData.videos, ...uploadedUrls] });
      if (videoInputRef.current) videoInputRef.current.value = '';
    } catch (error) {
      alert(error.message || 'Erreur lors de l\'upload des vidéos');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleRemoveImage = (index) => {
    setFormData({ ...formData, images: formData.images.filter((_, i) => i !== index) });
  };

  const handleRemoveVideo = (index) => {
    setFormData({ ...formData, videos: formData.videos.filter((_, i) => i !== index) });
  };

  const handleNext = () => {
    if (activeTab === 'basic' && (!formData.name || !formData.date || !formData.location)) {
      setFormError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setFormError('');
    const currentIndex = steps.findIndex(s => s.id === activeTab);
    if (currentIndex < steps.length - 1) {
      setActiveTab(steps[currentIndex + 1].id);
      setCurrentStep(currentIndex + 2);
    }
  };

  const handlePrevious = () => {
    const currentIndex = steps.findIndex(s => s.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(steps[currentIndex - 1].id);
      setCurrentStep(currentIndex);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.date || !formData.location) {
      setFormError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setIsSubmitting(true);
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  const isFirstStep = activeTab === 'basic';
  const isLastStep = activeTab === 'media';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-10 max-h-[85vh] flex flex-col animate-slideUp">
        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-20 rounded-t-2xl backdrop-blur-sm bg-white/95">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent capitalize">
              {mode === 'add' ? 'Créer un nouvel événement' : 'Modifier l\'événement'}
            </h2>
            <button
              onClick={onClose}
              disabled={isSubmitting || isUploadingImage || isUploadingVideo}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-4 pt-2">
            <div className="flex justify-between items-center mb-2">
              <p className="text-lg font-bold text-indigo-600">
                {steps.find(s => s.id === activeTab)?.title}
              </p>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Étape {currentStep} sur {steps.length}
            </p>
            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 ease-out shadow-lg"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {formError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{formError}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-6 pb-6 space-y-5 overflow-y-auto flex-grow">
          {activeTab === 'basic' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom de l'Événement <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm hover:border-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows="4"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-y text-sm hover:border-gray-300"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm hover:border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Catégorie</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm hover:border-gray-300"
                  >
                    <option value="Événement">Événement</option>
                    <option value="Mariage">Mariage</option>
                    <option value="Gala">Gala</option>
                    <option value="Conférence">Conférence</option>
                    <option value="Anniversaire">Anniversaire</option>
                    <option value="Lancement">Lancement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    Nombre d'invités
                  </label>
                  <input
                    type="number"
                    name="guests"
                    value={formData.guests}
                    onChange={handleChange}
                    min="1"
                    placeholder="Ex: 150"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm hover:border-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lieu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  placeholder="Ex: Hôtel Radisson Blu, Brazzaville"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm hover:border-gray-300"
                />
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-blue-800">
                  <strong>💡 Conseil :</strong> Ces détails enrichissent la présentation de l'événement et permettent aux clients de mieux comprendre votre travail.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Objectif
                </label>
                <textarea
                  name="objective"
                  value={formData.objective}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Quel était l'objectif principal de cet événement ?"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-y text-sm hover:border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">Exemple : Célébrer le lancement d'un nouveau produit et créer du buzz médiatique</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  Concept Créatif
                </label>
                <textarea
                  name="creativeConcept"
                  value={formData.creativeConcept}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Décrivez le concept créatif et l'ambiance de l'événement"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-y text-sm hover:border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">Exemple : Thème futuriste avec jeux de lumières LED, hologrammes et expériences immersives</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-green-600" />
                  Réalisation & Scénographie
                </label>
                <textarea
                  name="realization"
                  value={formData.realization}
                  onChange={handleChange}
                  rows="5"
                  placeholder="Détaillez la mise en œuvre technique et la scénographie"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-y text-sm hover:border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">Exemple : Installation de 50m² d'écrans LED, scène modulaire sur 3 niveaux, éclairage dynamique synchronisé</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Résultat
                </label>
                <textarea
                  name="result"
                  value={formData.result}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Quel a été l'impact et les résultats de cet événement ?"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 resize-y text-sm hover:border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">Exemple : 500+ participants, 2M de vues sur les réseaux sociaux, couverture par 10 médias nationaux</p>
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-blue-600" />
                  Images ({formData.images.length})
                </h3>

                <div className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={isUploadingImage || isSubmitting}
                    />
                    <label
                      htmlFor="image-upload"
                      className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${
                        isUploadingImage
                          ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                          : 'border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin text-blue-600" />
                          <span className="text-blue-600 font-semibold">Upload en cours...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-blue-600" />
                          <span className="text-blue-600 font-semibold">📁 Parcourir (Images)</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Ou coller une URL d'image"
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-sm hover:border-gray-300"
                    disabled={isUploadingImage || isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={handleAddUrlImage}
                    disabled={isUploadingImage || isSubmitting}
                    className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 hover:scale-105 shadow-md disabled:bg-gray-400"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {formData.images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-gray-200 group-hover:border-indigo-400 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        disabled={isUploadingImage || isSubmitting}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {formData.images.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                    Aucune image ajoutée
                  </p>
                )}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Film className="w-6 h-6 text-red-600" />
                  Vidéos ({formData.videos.length}/3)
                </h3>

                <div className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm"
                      multiple
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-upload"
                      disabled={isUploadingVideo || isSubmitting || formData.videos.length >= 3}
                    />
                    <label
                      htmlFor="video-upload"
                      className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition ${
                        isUploadingVideo || formData.videos.length >= 3
                          ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                          : 'border-red-300 hover:border-red-500 hover:bg-red-50'
                      }`}
                    >
                      {isUploadingVideo ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin text-red-600" />
                          <span className="text-red-600 font-semibold">Upload en cours...</span>
                        </>
                      ) : formData.videos.length >= 3 ? (
                        <span className="text-gray-500 font-semibold">Maximum atteint (3 vidéos)</span>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-red-600" />
                          <span className="text-red-600 font-semibold">🎬 Parcourir (MP4/WebM, 100MB max)</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Ou coller une URL de vidéo (YouTube, Vimeo, etc.)"
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 text-sm hover:border-gray-300"
                    disabled={isUploadingVideo || isSubmitting || formData.videos.length >= 3}
                  />
                  <button
                    type="button"
                    onClick={handleAddUrlVideo}
                    disabled={isUploadingVideo || isSubmitting || formData.videos.length >= 3}
                    className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold rounded-lg hover:from-red-700 hover:to-pink-700 transition-all duration-200 hover:scale-105 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.videos.map((video, index) => (
                    <div key={index} className="relative group flex items-center gap-3 p-3 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-red-400 transition-all">
                      <Video className="w-8 h-8 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{video}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(index)}
                        disabled={isUploadingVideo || isSubmitting}
                        className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {formData.videos.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                    Aucune vidéo ajoutée (maximum 3)
                  </p>
                )}
              </div>
            </div>
          )}
        </form>

        <div className="flex justify-between items-center p-6 border-t border-gray-200 sticky bottom-0 bg-white z-20 rounded-b-2xl backdrop-blur-sm bg-white/95 shadow-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isUploadingImage || isUploadingVideo}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>

          <div className="flex gap-3">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isSubmitting || isUploadingImage || isUploadingVideo}
                className="flex items-center gap-2 px-6 py-2.5 font-semibold rounded-xl transition-all duration-200 shadow-md bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 hover:from-indigo-200 hover:to-purple-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Précédent</span>
              </button>
            )}

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isUploadingImage || isUploadingVideo}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>{mode === 'add' ? 'Créer' : 'Sauvegarder'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting || isUploadingImage || isUploadingVideo}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Suivant</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageEventsPage;