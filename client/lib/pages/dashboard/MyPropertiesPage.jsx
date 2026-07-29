"use client";

import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  getMyProperties,
  createProperty,
  updateProperty,
  deleteProperty
} from "../../services/propertyService";
import PropertyForm from "../../components/dashboard/PropertyForm";
import confirm from '@/lib/utils/confirm';
import { Building2 } from 'lucide-react';
import { DashboardCard, DashboardPage, DashboardPageHeader, DashboardState } from '../../components/dashboard/DashboardUI';

const MyPropertiesPage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  
  const [formData, setFormData] = useState(initialFormData());
  const [existingImages, setExistingImages] = useState([]);

  function initialFormData() {
    return {
      title: "",
      description: "",
      price: "",
      pole: "Altimmo",
      status: "vente",
      availability: "Disponible",
      type: "",
      address: {
        arrondissement: "",
        street: "",
        city: "Brazzaville",
      },
      surface: "",
      bedrooms: "",
      bathrooms: "",
      amenities: "",
      latitude: -4.266,
      longitude: 15.283,
      images: [],
    };
  }

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const res = await getMyProperties();
      setProperties(res);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des biens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleDelete = async (id) => {
    if (!await confirm("Voulez-vous vraiment supprimer ce bien ?", { title: 'Supprimer le bien', danger: true })) return;
    try {
      await deleteProperty(id);
      toast.success("Bien supprimé !");
      setProperties(properties.filter((p) => p._id !== id));
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleEditClick = (property) => {
    setEditingProperty(property);
    setFormData({
      ...initialFormData(),
      ...property,
      address: {
        arrondissement: property.address_arrondissement || "",
        street: property.address_street || "",
        city: property.address_city || "Brazzaville",
      },
      amenities: property.amenities ? property.amenities.join(", ") : "",
      // Utilisation du champ 'location' (GeoJSON) pour récupérer les coordonnées
      latitude: property.location?.coordinates[1] || -4.266,
      longitude: property.location?.coordinates[0] || 15.283,
      images: [],
    });
    setExistingImages(property.images || []);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const data = new FormData();
      const { address, amenities, images, ...otherFields } = formData;

      // 1. Champs principaux
      Object.entries(otherFields).forEach(([k, v]) => v !== "" && data.append(k, v));

      // 2. Adresse
      data.append("address[street]", address.street);
      data.append("address[arrondissement]", address.arrondissement);
      data.append("address[city]", address.city);

      // 3. Équipements
      amenities.split(",").map(a => a.trim()).filter(Boolean).forEach(a => data.append("amenities", a));

      // 4. Géolocalisation (Envoi sous forme de chaîne JSON)
      // Ceci est CORRECT et nécessaire pour envoyer un objet GeoJSON via FormData
      data.append("location", JSON.stringify({ 
          type: "Point", 
          coordinates: [formData.longitude, formData.latitude] 
      }));

      // 5. Images (Nouveaux fichiers)
      images.forEach(file => data.append("images", file));

      if (editingProperty) {
        // 6. Si MISE A JOUR, envoyer la liste des images existantes à conserver
        existingImages.forEach(url => data.append("existingImages", url));
        
        const updated = await updateProperty(editingProperty._id, data);
        setProperties(properties.map(p => p._id === editingProperty._id ? updated : p));
        toast.success("Bien mis à jour !");
      } else {
        // 6. Si CRÉATION
        const created = await createProperty(data);
        setProperties([created, ...properties]);
        toast.success("Bien ajouté !");
      }

      // Reset formulaire
      setEditingProperty(null);
      setFormData(initialFormData());
      setExistingImages([]);
    } catch (error) {
      console.error(error); 
      const errorMessage = error.response?.data?.message || error.message || "Erreur lors de la sauvegarde.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingProperty(null);
    setFormData(initialFormData());
    setExistingImages([]);
  };

  if (loading && properties.length === 0) return <DashboardState type="loading" title="Chargement de vos biens…" />;

  return (
    <DashboardPage>
      <DashboardPageHeader icon={Building2} title="Mes biens immobiliers" description="Ajoutez, modifiez et suivez vos annonces immobilières." />

      {/* Formulaire */}
      <DashboardCard className="mb-8">
        <h3 className="text-xl font-semibold mb-4">{editingProperty ? "Modifier le bien" : "Ajouter un nouveau bien"}</h3>
        <PropertyForm
          formData={formData}
          setFormData={setFormData}
          existingImages={existingImages}
          setExistingImages={setExistingImages}
          onSubmit={handleFormSubmit}
          loading={loading}
          isEditing={Boolean(editingProperty)}
        />
        {editingProperty && (
          <button
            onClick={handleCancelEdit}
            className="mt-2 text-gray-600 hover:underline"
          >
            Annuler
          </button>
        )}
      </DashboardCard>

      {/* Liste des propriétés */}
      {properties.length === 0 && !loading ? (
        <DashboardState title="Aucun bien disponible" description="Ajoutez votre premier bien avec le formulaire ci-dessus." />
      ) : (
        properties.map((property) => (
          <DashboardCard key={property._id} className="mb-4">
            <h3 className="text-xl font-semibold">{property.title}</h3>
            <p>{property.description}</p>
            <p>Prix : {property.price} FCFA</p>
            <p>Adresse : {property.address_arrondissement}, {property.address_street}, {property.address_city}</p>
            <p>Type : {property.type}</p>
            <p>Chambres : {property.bedrooms}, Salles de bain : {property.bathrooms}</p>
            <div className="flex gap-2 flex-wrap">
              {property.amenities?.map((a) => (
                <span key={a} className="bg-gray-200 px-2 py-1 rounded">{a}</span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleEditClick(property)} className="bg-gold text-white px-3 py-1 rounded">Modifier</button>
              <button onClick={() => handleDelete(property._id)} className="bg-red-600 text-white px-3 py-1 rounded">Supprimer</button>
            </div>
          </DashboardCard>
        ))
      )}
    </DashboardPage>
  );
};

export default MyPropertiesPage;
