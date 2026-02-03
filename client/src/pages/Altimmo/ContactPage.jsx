import React, { useState } from 'react';
import { FaMapMarkerAlt, FaEnvelope, FaPhoneAlt } from 'react-icons/fa';
import api from '../services/api';
import Spinner from '../components/layout/Spinner';

const ContactPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Endpoint corrigé pour un formulaire de contact générique
      await api.post('/contact', formData);
      
      setSuccess('Votre message a été envoyé avec succès ! Nous vous répondrons bientôt.');
      setFormData({ name: '', email: '', subject: '', message: '' });

    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-primary">Contactez-nous</h1>
          <p className="text-lg text-gray-600 mt-2">Une question, une demande de devis ? N'hésitez pas à nous écrire.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white p-8 rounded-lg shadow-lg">
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Nos Coordonnées</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <FaMapMarkerAlt className="text-primary text-xl mt-1 mr-4" />
                  <p className="text-gray-600">Avenue des 3 Martyrs, Centre-ville<br />Brazzaville, République du Congo</p>
                </div>
                <div className="flex items-center">
                  <FaEnvelope className="text-primary text-xl mr-4" />
                  <a href="mailto:contact@altitude-vision.com" className="text-gray-600 hover:text-primary">contact@altitude-vision.com</a>
                </div>
                <div className="flex items-center">
                  <FaPhoneAlt className="text-primary text-xl mr-4" />
                  <a href="tel:+242060000000" className="text-gray-600 hover:text-primary">(+242) 06 000 00 00</a>
                </div>
              </div>
            </div>
            <div className="h-64 md:h-80 w-full rounded-lg overflow-hidden">
              <iframe
                title="Notre localisation"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3979.288252273063!2d15.28101481476043!3d-4.264426096924845!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNMKwMTUnNTAuMCJTIDHCsDE2JzUxLjYiRQ!5e0!3m2!1sen!2scg!4v1617300000000!5m2!1sen!2scg"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Envoyez-nous un message</h2>
            <form onSubmit={submitHandler} className="space-y-4">
              {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
              {success && <div className="bg-green-100 text-green-700 p-3 rounded">{success}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <input type="text" id="name" placeholder="Votre nom" value={formData.name} onChange={handleChange} required className="input-style"/>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" id="email" placeholder="Votre email" value={formData.email} onChange={handleChange} required className="input-style"/>
                </div>
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                <input type="text" id="subject" placeholder="Sujet du message" value={formData.subject} onChange={handleChange} required className="input-style"/>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea id="message" rows="6" placeholder="Écrivez votre message ici..." value={formData.message} onChange={handleChange} required className="input-style"></textarea>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-3 px-4 rounded-md hover:bg-blue-800 transition duration-300 disabled:bg-gray-400">
                {loading ? <Spinner /> : 'Envoyer le message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;