import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { createProperty } from "../../services/propertyService";

const AddMyPropertyPage = () => {
  const { user } = useAuth(); // Récupération de l'utilisateur connecté

  const [property, setProperty] = useState({
    title: "",
    description: "",
    price: "",
    address: "",
    city: "",
    type: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
  });

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Mise à jour des champs du formulaire
  const handleChange = (e) => {
    setProperty({ ...property, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("⚠️ Vous devez être connecté pour ajouter un bien.");
      return;
    }

    if (!image) {
      toast.error("Veuillez sélectionner une image pour votre propriété.");
      return;
    }

    const formData = new FormData();
    for (const key in property) {
      formData.append(key, property[key]);
    }
    formData.append("image", image);
    formData.append("ownerId", user._id); // associe automatiquement le bien au propriétaire connecté

    try {
      setLoading(true);
      const newProperty = await createProperty(formData); // Utilise l'API centralisée
      toast.success("✅ Votre bien a été ajouté avec succès !");
      console.log("Bien créé :", newProperty);

      // Réinitialisation du formulaire
      setProperty({
        title: "",
        description: "",
        price: "",
        address: "",
        city: "",
        type: "",
        bedrooms: "",
        bathrooms: "",
        area: "",
      });
      setImage(null);
    } catch (error) {
      console.error(error);
      toast.error("❌ Erreur lors de l'ajout du bien. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-form max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-6">Ajouter ma Propriété</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input name="title" placeholder="Titre" value={property.title} onChange={handleChange} required className="input-field" />
        <textarea name="description" placeholder="Description" value={property.description} onChange={handleChange} required className="input-field" />
        <input name="price" type="number" placeholder="Prix" value={property.price} onChange={handleChange} required className="input-field" />
        <input name="address" placeholder="Adresse" value={property.address} onChange={handleChange} required className="input-field" />
        <input name="city" placeholder="Ville" value={property.city} onChange={handleChange} required className="input-field" />
        <input name="type" placeholder="Type (Maison, Villa, Studio…)" value={property.type} onChange={handleChange} required className="input-field" />
        <input name="bedrooms" type="number" placeholder="Chambres" value={property.bedrooms} onChange={handleChange} required className="input-field" />
        <input name="bathrooms" type="number" placeholder="Salles de bain" value={property.bathrooms} onChange={handleChange} required className="input-field" />
        <input name="area" type="number" placeholder="Surface (m²)" value={property.area} onChange={handleChange} required className="input-field" />

        <input type="file" onChange={handleImageChange} required />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md mt-2 transition disabled:opacity-50"
        >
          {loading ? "Ajout en cours..." : "Ajouter ma propriété"}
        </button>
      </form>
    </div>
  );
};

export default AddMyPropertyPage;
