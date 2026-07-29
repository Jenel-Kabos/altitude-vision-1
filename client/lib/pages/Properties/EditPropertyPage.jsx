"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { getPropertyById, updateProperty } from '../../services/propertyService';
import LoadingSpinner from '../../components/UI/LoadingSpinner.jsx';
import PropertyForm from '../../components/dashboard/PropertyForm';
import { createEmptyPropertyForm, mapPropertyToFormValues } from '../../utils/propertyFormValues';

const EditPropertyPage = () => {
  const { id } = useParams() || {};
  const router = useRouter();
  const [formData, setFormData] = useState(createEmptyPropertyForm);
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getPropertyById(id)
      .then((property) => {
        if (cancelled) return;
        setFormData(mapPropertyToFormValues(property));
        setExistingImages(property.images || []);
        loadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setError('Impossible de charger les données du bien.');
          toast.error('Erreur lors du chargement du bien');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const submitHandler = async (event) => {
    event.preventDefault();
    if (!loadedRef.current || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = new FormData();
      const { images, latitude, longitude, address, amenities, ...fields } = formData;
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) data.append(key, value);
      });
      data.append('latitude', latitude);
      data.append('longitude', longitude);
      data.append('address', JSON.stringify(address));
      const amenitiesArray = typeof amenities === 'string'
        ? amenities.split(',').map((item) => item.trim()).filter(Boolean)
        : (Array.isArray(amenities) ? amenities : []);
      data.append('amenities', JSON.stringify(amenitiesArray));
      data.append('location', JSON.stringify({ type: 'Point', coordinates: [longitude, latitude] }));
      existingImages.forEach((url) => data.append('existingImages', url));
      images.forEach((file) => data.append('images', file));
      await updateProperty(id, data);
      toast.success('Bien mis à jour avec succès !');
      router.push(`/immobilier/property/${id}`);
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'La mise à jour a échoué.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !loadedRef.current) return <LoadingSpinner />;

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white p-4 sm:p-8 rounded-2xl shadow-md">
        {error && <p className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</p>}
        <PropertyForm formData={formData} setFormData={setFormData}
          existingImages={existingImages} setExistingImages={setExistingImages}
          onSubmit={submitHandler} loading={loading} isEditing />
      </div>
    </div>
  );
};

export default EditPropertyPage;
