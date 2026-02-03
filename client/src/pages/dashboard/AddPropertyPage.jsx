import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { addProperty } from "../../services/propertyService";
import PropertyForm from "../../components/dashboard/PropertyForm";

const AddPropertyPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    pole: "Altimmo",
    status: "vente",
    type: "Appartement",
    availability: "Disponible",
    address: { street: "", district: "", city: "Brazzaville" },
    surface: "",
    bedrooms: "",
    bathrooms: "",
// ✅ AJOUT DES NOUVEAUX CHAMPS
    livingRooms: "", // Nombre de salons (ou 'pièces de vie' si le backend l'accepte)
    constructionType: "Béton armé", // Type de construction (valeur par défaut)
    kitchens: "", // Nombre de cuisines
// FIN AJOUT
    amenities: "", 
    latitude: -4.266, 
    longitude: 15.283,
    images: [], // ⭐ Contiendra des objets File
  });

  const [loading, setLoading] = useState(false);
  const [redirect, setRedirect] = useState(false); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("📤 [AddPropertyPage] Début de la soumission");
      console.log("📦 [AddPropertyPage] formData:", formData);
      
      // ✅ VALIDATION : Vérifier qu'il y a au moins une image
      if (!formData.images || formData.images.length === 0) {
        toast.error("Veuillez ajouter au moins une image");
        setLoading(false);
        return;
      }

      const data = new FormData();

      // Déstructuration pour isoler les champs complexes/fichiers
      const { address, amenities, images, latitude, longitude, ...otherFields } = formData;
      
      // 1. Champs principaux (texte et nombres, inclut les nouveaux champs)
      Object.entries(otherFields).forEach(([key, value]) => {
        // Append seulement si la valeur n'est pas vide
        if (value !== "" && value !== null && value !== undefined) {
          data.append(key, value);
          // console.log(`   ✅ ${key}:`, value);
        }
      });
      
      // 2. Latitude et longitude (requis)
      data.append('latitude', latitude);
      data.append('longitude', longitude);

      // 3. Address (Envoyé en JSON)
      data.append("address", JSON.stringify(address));

      // 4. Amenities (Envoyé en JSON)
      const amenitiesArray = typeof amenities === 'string'
        ? amenities.split(",").map(a => a.trim()).filter(Boolean)
        : (Array.isArray(amenities) ? amenities : []);
      
      data.append("amenities", JSON.stringify(amenitiesArray));

      // 5. Images (Fichiers bruts)
      if (images && images.length > 0) {
        images.forEach((file) => {
          if (file instanceof File) {
            data.append("images", file);
          }
        });
      }

      // 6. Location (GeoJSON - Envoyé en JSON)
      const locationData = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
      data.append("location", JSON.stringify(locationData));

      console.log("🚀 [AddPropertyPage] Envoi de la requête à l'API...");
      
      // Appel à l'API
      const response = await addProperty(data);
      
      console.log("✅ [AddPropertyPage] Propriété créée avec succès:", response);
      
      toast.success("Bien ajouté avec succès !");
      setRedirect(true); 
      
    } catch (err) {
      console.error("❌ [AddPropertyPage] Erreur complète:", err);
      const errorMessage = 
        err.response?.data?.message || 
        err.message || 
        "Erreur lors de l'ajout du bien."; 
      
      toast.error(errorMessage);

    } finally {
      setLoading(false);
    }
  };

  // Effet pour rediriger après l'affichage du toast
  useEffect(() => {
    if (redirect) {
      const timer = setTimeout(() => {
        navigate("/dashboard/properties");
      }, 1500); 
      return () => clearTimeout(timer); 
    }
  }, [redirect, navigate]);

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold text-primary mb-6">Ajouter un nouveau bien</h2>
      <PropertyForm
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </div>
  );
};

export default AddPropertyPage;