import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { apiFormHeaders } from "../../services/api";
import PropertyForm from "./PropertyForm";

const EditPropertyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    pole: "Altimmo",
    status: "vente",
    type: "Appartement",
    availability: "Disponible",
    address_street: "",
    address_district: "",
    address_city: "Brazzaville",
    surface: "",
    bedrooms: "",
    bathrooms: "",
    amenities: "",
    latitude: -4.266,
    longitude: 15.283,
  });

  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const { data } = await api.get(`/properties/${id}`);
        const p = data.data.property;

        setFormData({
          title: p.title || "",
          description: p.description || "",
          price: p.price || "",
          pole: p.pole || "Altimmo",
          status: p.status || "vente",
          type: p.type || "Appartement",
          availability: p.availability || "Disponible",
          address_street: p.address?.street || "",
          address_district: p.address?.district || "",
          address_city: p.address?.city || "Brazzaville",
          surface: p.surface || "",
          bedrooms: p.bedrooms || "",
          bathrooms: p.bathrooms || "",
          amenities: (p.amenities || []).join(", "),
          latitude: p.location?.coordinates?.[1] || -4.266,
          longitude: p.location?.coordinates?.[0] || 15.283,
        });

        setExistingImages(p.images || []);
      } catch (err) {
        console.error(err);
        setError("Impossible de charger les données du bien.");
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = new FormData();
      const { address_street, address_district, address_city, amenities, ...otherFields } = formData;

      Object.entries(otherFields).forEach(([k, v]) => v !== "" && data.append(k, v));
      data.append("address[street]", address_street);
      data.append("address[district]", address_district);
      data.append("address[city]", address_city);

      amenities.split(",").map(a => a.trim()).filter(Boolean).forEach(a => data.append("amenities", a));
      existingImages.forEach(img => data.append("existingImages", img));
      newImages.forEach(file => data.append("images", file));

      data.append("location", JSON.stringify({ type: "Point", coordinates: [formData.longitude, formData.latitude] }));

      await api.put(`/properties/${id}`, data, { headers: apiFormHeaders() });
      navigate(`/propriete/${id}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "La mise à jour a échoué.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !formData.title) return <div className="text-center py-10">Chargement...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold text-primary mb-6">Modifier le bien</h2>
      {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</p>}
      <PropertyForm
        formData={formData}
        setFormData={setFormData}
        existingImages={existingImages}
        setExistingImages={setExistingImages}
        newImages={newImages}
        setNewImages={setNewImages}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </div>
  );
};

export default EditPropertyPage;
