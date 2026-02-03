// client/src/components/modals/AltcomQuoteRequestModal.jsx
import React, { useState } from "react";

const AltcomQuoteRequestModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null; // Ne rien afficher si modal fermée

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Demande de devis envoyée !");
    onClose(); // Fermer la modal après soumission
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Demande de devis</h2>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">
            Nom :
            <input
              type="text"
              className="border rounded w-full p-2 mt-1"
              required
            />
          </label>
          <label className="block mb-2">
            Email :
            <input
              type="email"
              className="border rounded w-full p-2 mt-1"
              required
            />
          </label>
          <label className="block mb-4">
            Description :
            <textarea
              className="border rounded w-full p-2 mt-1"
              required
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 px-4 py-2 border rounded"
            >
              Annuler
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
              Envoyer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AltcomQuoteRequestModal;
