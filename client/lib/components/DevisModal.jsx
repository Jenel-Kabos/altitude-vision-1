"use client";

import React, { useState } from 'react';
import {
  FaTimes, FaBuilding, FaMapMarkerAlt, FaRulerCombined, FaMoneyBillWave,
  FaLayerGroup, FaUser, FaEnvelope, FaPhone, FaPaperPlane, FaSpinner,
  FaArrowRight, FaArrowLeft, FaCheckCircle,
} from 'react-icons/fa';
import { PROPERTY_TYPES } from '../constants/propertyTypes';
import api from '../services/api';

const INITIAL = {
  adresseBien: '', typeBien: '', surface: '', loyerSouhaite: '', nbBiens: 1, message: '',
  nom: '', email: '', telephone: '',
};

/**
 * Modal de demande de devis "Gestion Locative", en 2 étapes (le bien → contact).
 * @param {object} props
 * @param {function} props.onClose - Fonction pour fermer le modal.
 */
const DevisModal = ({ onClose }) => {
  const [step,    setStep]    = useState(1);
  const [form,    setForm]    = useState(INITIAL);
  const [errors,  setErrors]  = useState({});
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState(null);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: null }));
  };

  const validateStep1 = () => {
    const errs = {};
    if (!form.adresseBien.trim()) errs.adresseBien = "L'adresse du bien est requise.";
    if (!form.typeBien)           errs.typeBien    = 'Sélectionnez un type de bien.';
    return errs;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!form.nom.trim())   errs.nom   = 'Votre nom est requis.';
    if (!form.email.trim()) errs.email = 'Votre email est requis.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email invalide.';
    return errs;
  };

  const goToStep2 = () => {
    const errs = validateStep1();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateStep2();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSending(true);
    setError(null);
    try {
      await api.post('/devis', {
        nom:           form.nom,
        email:         form.email,
        telephone:     form.telephone,
        adresseBien:   form.adresseBien,
        typeBien:      form.typeBien,
        surface:       form.surface       ? Number(form.surface)       : undefined,
        loyerSouhaite: form.loyerSouhaite ? Number(form.loyerSouhaite) : undefined,
        nbBiens:       form.nbBiens       ? Number(form.nbBiens)       : 1,
        message:       form.message,
      });
      setSent(true);
    } catch {
      setError("Erreur lors de l'envoi. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full relative max-h-[90vh] overflow-y-auto">

        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition duration-200"
        >
          <FaTimes className="text-2xl" aria-hidden="true" />
        </button>

        <div className="text-center mb-6">
          <FaBuilding className="text-5xl text-emerald-600 mx-auto mb-2" />
          <h3 className="text-3xl font-extrabold text-gray-800">Demande de Devis</h3>
          <p className="text-sm text-gray-500 mt-1">Gestion Locative — Étape {step} sur 2</p>
        </div>

        {/* Barre de progression */}
        <div className="h-1 bg-gray-100 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>

        {sent ? (
          <div className="flex flex-col items-center text-center py-8">
            <FaCheckCircle className="text-5xl text-emerald-500 mb-4" />
            <p className="font-bold text-gray-800 text-lg mb-2">Demande envoyée !</p>
            <p className="text-gray-500 text-sm mb-6">
              Votre demande de devis a été envoyée ! Notre équipe vous contactera sous 24h.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); goToStep2(); } : handleSubmit} className="space-y-4">

            {step === 1 && (
              <>
                <div>
                  <label htmlFor="adresseBien" className="block text-sm font-medium text-gray-700">
                    <FaMapMarkerAlt className="inline mr-1.5 text-gray-400" /> Adresse du bien *
                  </label>
                  <input
                    type="text" id="adresseBien" required
                    value={form.adresseBien} onChange={e => set('adresseBien', e.target.value)}
                    placeholder="Ex : Bacongo, Brazzaville"
                    className={`mt-1 block w-full border rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500 ${errors.adresseBien ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {errors.adresseBien && <p className="text-red-500 text-xs mt-1">{errors.adresseBien}</p>}
                </div>

                <div>
                  <label htmlFor="typeBien" className="block text-sm font-medium text-gray-700">
                    <FaBuilding className="inline mr-1.5 text-gray-400" /> Type de bien *
                  </label>
                  <select
                    id="typeBien" required
                    value={form.typeBien} onChange={e => set('typeBien', e.target.value)}
                    className={`mt-1 block w-full border rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500 ${errors.typeBien ? 'border-red-400' : 'border-gray-300'}`}
                  >
                    <option value="">Sélectionner...</option>
                    {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {errors.typeBien && <p className="text-red-500 text-xs mt-1">{errors.typeBien}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="surface" className="block text-sm font-medium text-gray-700">
                      <FaRulerCombined className="inline mr-1.5 text-gray-400" /> Surface (m²)
                    </label>
                    <input
                      type="number" id="surface" min="0"
                      value={form.surface} onChange={e => set('surface', e.target.value)}
                      placeholder="Ex : 120"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="nbBiens" className="block text-sm font-medium text-gray-700">
                      <FaLayerGroup className="inline mr-1.5 text-gray-400" /> Nb. biens à gérer
                    </label>
                    <input
                      type="number" id="nbBiens" min="1"
                      value={form.nbBiens} onChange={e => set('nbBiens', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="loyerSouhaite" className="block text-sm font-medium text-gray-700">
                    <FaMoneyBillWave className="inline mr-1.5 text-gray-400" /> Loyer souhaité (FCFA)
                  </label>
                  <input
                    type="number" id="loyerSouhaite" min="0"
                    value={form.loyerSouhaite} onChange={e => set('loyerSouhaite', e.target.value)}
                    placeholder="Ex : 250000"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                    Message (optionnel)
                  </label>
                  <textarea
                    id="message" rows="3"
                    value={form.message} onChange={e => set('message', e.target.value)}
                    placeholder="Précisions sur votre bien ou votre besoin..."
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition duration-300 flex items-center justify-center gap-2"
                >
                  Continuer <FaArrowRight />
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-100 mb-2">
                  <FaBuilding className="text-emerald-600 flex-shrink-0" />
                  <div className="text-xs text-gray-600 min-w-0">
                    <span className="font-semibold text-gray-800">{form.typeBien}</span>
                    {form.surface && <span> · {form.surface} m²</span>}
                    {form.adresseBien && <span> · {form.adresseBien}</span>}
                  </div>
                  <button type="button" onClick={() => setStep(1)}
                    className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs underline flex-shrink-0">
                    Modifier
                  </button>
                </div>

                <div>
                  <label htmlFor="nom" className="block text-sm font-medium text-gray-700">
                    <FaUser className="inline mr-1.5 text-gray-400" /> Nom complet *
                  </label>
                  <input
                    type="text" id="nom" required
                    value={form.nom} onChange={e => set('nom', e.target.value)}
                    className={`mt-1 block w-full border rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500 ${errors.nom ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    <FaEnvelope className="inline mr-1.5 text-gray-400" /> Email *
                  </label>
                  <input
                    type="email" id="email" required
                    value={form.email} onChange={e => set('email', e.target.value)}
                    className={`mt-1 block w-full border rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500 ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="telephone" className="block text-sm font-medium text-gray-700">
                    <FaPhone className="inline mr-1.5 text-gray-400" /> Téléphone (optionnel)
                  </label>
                  <input
                    type="tel" id="telephone"
                    value={form.telephone} onChange={e => set('telephone', e.target.value)}
                    placeholder="+242 06 000 00 00"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-gray-600 border border-gray-200 hover:border-gray-300 transition">
                    <FaArrowLeft /> Retour
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? <FaSpinner className="animate-spin" /> : <FaPaperPlane />}
                    <span>{sending ? 'Envoi...' : 'Envoyer ma demande'}</span>
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default DevisModal;
