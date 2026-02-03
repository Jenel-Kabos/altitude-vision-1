// client/src/components/modals/AltcomProjectModal.jsx
import React, { useState } from "react";

const AltcomProjectModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Projet enregistré !");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Créer / Modifier un projet</h2>
        <form onSubmit={handleSubmit}>
          <label className="block mb-2">
            Nom du projet :
            <input
              type="text"
              className="border rounded w-full p-2 mt-1"
              required
            />
          </label>
          <label className="block mb-2">
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
            <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AltcomProjectModal;
