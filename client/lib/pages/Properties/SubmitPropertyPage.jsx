"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, CheckCircle2, ImagePlus, Loader2, ShieldCheck, X } from 'lucide-react';
import { addProperty } from '../../services/propertyService';
import { useAuth } from '../../context/AuthContext';
import { VILLES, getArrondissementsFor } from '../../constants/locations';
import { PROPERTY_TYPES } from '../../constants/propertyTypes';
import styles from './SubmitPropertyPage.module.css';

const AMENITIES = ['Climatisation', 'Piscine', 'Jardin', 'Garage', 'Sécurité 24/7', 'Balcon', 'Wi-Fi', 'Cuisine Équipée', 'Gardien', 'Groupe Électrogène'];
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const initialForm = {
  title: '', description: '', price: '', pole: 'Altimmo', status: 'vente', type: 'Appartement', availability: 'Disponible',
  address: { street: '', arrondissement: '', city: 'Brazzaville' }, surface: '', bedrooms: '', bathrooms: '', amenities: [],
  latitude: -4.266, longitude: 15.283, images: [],
};

function Section({ number, title, introduction, id, children }) {
  return <section className={styles.section} id={id} aria-labelledby={`${id}-title`}><header className={styles.sectionHeader}><span className={styles.sectionNumber} aria-hidden="true">{number}</span><div><h2 id={`${id}-title`}>{title}</h2>{introduction && <p>{introduction}</p>}</div></header>{children}</section>;
}
function FieldError({ id, children }) {
  return children ? <p id={`${id}-error`} className={styles.fieldError}><AlertCircle aria-hidden="true" />{children}</p> : null;
}
const describedBy = (errors, name) => errors[name] ? `${name}-error` : undefined;

export default function SubmitPropertyPage() {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const errorSummaryRef = useRef(null);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const previews = useMemo(() => formData.images.map((file) => ({ file, url: URL.createObjectURL(file) })), [formData.images]);

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => { if (!authLoading && !user) router.replace('/login'); }, [authLoading, user, router]);

  const updateField = ({ target: { name, value } }) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const updateAddress = ({ target: { name, value } }) => {
    setFormData((current) => ({ ...current, address: { ...current.address, [name]: value } }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const updateCity = ({ target: { value } }) => {
    setFormData((current) => ({ ...current, address: { ...current.address, city: value, arrondissement: getArrondissementsFor(value).includes(current.address.arrondissement) ? current.address.arrondissement : '' } }));
    setErrors((current) => ({ ...current, city: undefined, arrondissement: undefined }));
  };
  const toggleAmenity = ({ target: { value, checked } }) => setFormData((current) => ({ ...current, amenities: checked ? [...current.amenities, value] : current.amenities.filter((item) => item !== value) }));
  const selectImages = ({ target }) => {
    const files = Array.from(target.files || []);
    let message = '';
    if (files.some((file) => !IMAGE_TYPES.includes(file.type))) message = 'Choisissez uniquement des images JPG, PNG ou WebP.';
    else if (files.some((file) => file.size > MAX_IMAGE_BYTES)) message = 'Chaque photo doit peser moins de 100 Mo.';
    else if (formData.images.length + files.length > MAX_IMAGES) message = 'Vous pouvez ajouter 10 photos maximum.';
    if (message) {
      setErrors((current) => ({ ...current, images: message }));
    } else {
      setFormData((current) => ({ ...current, images: [...current.images, ...files] }));
      setErrors((current) => ({ ...current, images: undefined }));
    }
    target.value = '';
  };
  const removeImage = (index) => setFormData((current) => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }));
  const validate = () => {
    const next = {};
    if (!formData.title.trim()) next.title = 'Veuillez renseigner le titre.';
    if (!formData.description.trim()) next.description = 'Veuillez renseigner la description.';
    if (!formData.price || Number(formData.price) <= 0) next.price = 'Veuillez renseigner un prix supérieur à zéro.';
    if (!formData.type) next.type = 'Veuillez sélectionner le type de bien.';
    if (!formData.address.city) next.city = 'Veuillez sélectionner la ville.';
    if (!formData.address.arrondissement) next.arrondissement = "Veuillez sélectionner l'arrondissement.";
    if (!formData.surface || Number(formData.surface) <= 0) next.surface = 'Veuillez renseigner une surface supérieure à zéro.';
    if (formData.images.length === 0) next.images = 'Ajoutez au moins une photo du bien.';
    return next;
  };
  const submit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const nextErrors = validate();
    setErrors(nextErrors); setSubmitError(''); setSuccess(false);
    if (Object.keys(nextErrors).length) { requestAnimationFrame(() => errorSummaryRef.current?.focus()); return; }
    submittingRef.current = true; setLoading(true);
    try {
      const payload = new FormData();
      const { images, latitude, longitude, address, amenities, ...fields } = formData;
      Object.entries(fields).forEach(([key, value]) => { if (value !== '' && value !== null && value !== undefined) payload.append(key, value); });
      payload.append('latitude', latitude); payload.append('longitude', longitude);
      payload.append('address', JSON.stringify(address)); payload.append('amenities', JSON.stringify(amenities));
      payload.append('location', JSON.stringify({ type: 'Point', coordinates: [longitude, latitude] }));
      images.forEach((file) => payload.append('images', file));
      const property = await addProperty(payload);
      if (!property?._id) throw new Error('La création du bien n’a pas été confirmée.');
      setSuccess(true); router.push(`/immobilier/property/${property._id}`);
    } catch (error) {
      const status = error.response?.status;
      if (status === 401) { setSubmitError('Votre session a expiré. Reconnectez-vous pour reprendre la soumission.'); router.replace('/login'); }
      else if (status === 403) setSubmitError('Cette soumission est réservée aux propriétaires autorisés. Vos informations sont conservées.');
      else setSubmitError(error.response?.data?.message || 'L’envoi a échoué. Vérifiez votre connexion puis réessayez.');
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally { submittingRef.current = false; setLoading(false); }
  };

  if (authLoading) return <div className={styles.authState} role="status"><Loader2 aria-hidden="true" />Vérification de votre accès…</div>;
  if (!user) return null;
  if (user.role !== 'Proprietaire') return <div className={styles.authState} role="alert"><ShieldCheck aria-hidden="true" /><div><strong>Accès propriétaire requis</strong><p>La soumission directe est réservée aux propriétaires autorisés.</p></div></div>;

  return <div className={styles.page}>
    <header className={styles.hero}><div className={styles.heroInner}><p className={styles.kicker}>Altimmo — publier un bien</p><h1>Confiez-nous votre bien immobilier.</h1><p className={styles.lede}>Présentez-nous votre bien avec précision. Notre équipe vérifiera les informations avant toute mise en ligne.</p><div className={styles.reassurance}><ShieldCheck aria-hidden="true" /><span>Soumission sécurisée · publication après validation</span></div></div></header>
    <div className={styles.shell}>
      <aside className={styles.aside} aria-label="Progression du formulaire"><p>Votre dossier</p><ol>{['Le bien', 'Localisation', 'Caractéristiques', 'Équipements', 'Photos', 'Vérification'].map((label, index) => <li key={label}><a href={`#property-step-${index + 1}`}><span>0{index + 1}</span>{label}</a></li>)}</ol><div className={styles.advice}><strong>Avant de commencer</strong><p>Préparez des photos nettes et vérifiez le prix, la surface et la localisation du bien.</p></div></aside>
      <form className={styles.form} onSubmit={submit} noValidate aria-label="Soumettre un bien immobilier" aria-busy={loading}>
        {(submitError || Object.keys(errors).length > 0) && <div className={styles.errorSummary} role="alert" tabIndex="-1" ref={errorSummaryRef}><AlertCircle aria-hidden="true" /><div><strong>{submitError ? 'Soumission interrompue' : 'Quelques informations sont à compléter'}</strong><p>{submitError || 'Vérifiez les champs indiqués ci-dessous.'}</p></div></div>}
        {success && <div className={styles.success} role="status"><CheckCircle2 aria-hidden="true" />Bien transmis à Altimmo. Redirection en cours…</div>}
        <Section number="01" title="Informations du bien" introduction="Donnez les informations essentielles qui permettront de comprendre votre offre." id="property-step-1"><div className={styles.gridTwo}>
          <div className={styles.fieldWide}><label htmlFor="property-title">Titre du bien <span aria-hidden="true">*</span></label><input id="property-title" name="title" value={formData.title} onChange={updateField} placeholder="Ex. Villa familiale avec jardin" aria-invalid={!!errors.title} aria-describedby={describedBy(errors, 'title')} /><FieldError id="title">{errors.title}</FieldError></div>
          <div className={styles.fieldWide}><label htmlFor="property-description">Description <span aria-hidden="true">*</span></label><textarea id="property-description" name="description" value={formData.description} onChange={updateField} rows="6" placeholder="Décrivez les espaces, l’état du bien et ses principaux atouts." aria-invalid={!!errors.description} aria-describedby={describedBy(errors, 'description')} /><FieldError id="description">{errors.description}</FieldError></div>
          <div><label htmlFor="property-price">Prix <span aria-hidden="true">*</span></label><div className={styles.unitInput}><input id="property-price" name="price" type="number" min="1" inputMode="numeric" value={formData.price} onChange={updateField} placeholder="850000" aria-invalid={!!errors.price} aria-describedby={describedBy(errors, 'price')} /><span>FCFA</span></div><FieldError id="price">{errors.price}</FieldError></div>
          <div><label htmlFor="property-type">Type de bien <span aria-hidden="true">*</span></label><select id="property-type" name="type" value={formData.type} onChange={updateField} aria-invalid={!!errors.type} aria-describedby={describedBy(errors, 'type')}><option value="">Sélectionner un type</option>{PROPERTY_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select><FieldError id="type">{errors.type}</FieldError></div>
        </div></Section>
        <Section number="02" title="Localisation" introduction="Situez le bien avec les données géographiques déjà utilisées par Altimmo." id="property-step-2"><div className={styles.gridTwo}>
          <div><label htmlFor="property-city">Ville <span aria-hidden="true">*</span></label><select id="property-city" name="city" value={formData.address.city} onChange={updateCity} aria-invalid={!!errors.city} aria-describedby={describedBy(errors, 'city')}><option value="">Sélectionner une ville</option>{VILLES.map((city) => <option key={city} value={city}>{city}</option>)}</select><FieldError id="city">{errors.city}</FieldError></div>
          <div><label htmlFor="property-arrondissement">Arrondissement <span aria-hidden="true">*</span></label><select id="property-arrondissement" name="arrondissement" value={formData.address.arrondissement} onChange={updateAddress} disabled={!formData.address.city} aria-invalid={!!errors.arrondissement} aria-describedby={describedBy(errors, 'arrondissement')}><option value="">Sélectionner un arrondissement</option>{getArrondissementsFor(formData.address.city).map((item) => <option key={item} value={item}>{item}</option>)}</select><FieldError id="arrondissement">{errors.arrondissement}</FieldError></div>
          <div className={styles.fieldWide}><label htmlFor="property-street">Rue ou repère <span className={styles.optional}>Optionnel</span></label><input id="property-street" name="street" value={formData.address.street} onChange={updateAddress} placeholder="Ex. Avenue de l’OUA" /></div>
        </div></Section>
        <Section number="03" title="Caractéristiques" introduction="Indiquez les mesures et capacités exactes du bien." id="property-step-3"><div className={styles.gridThree}>
          <div><label htmlFor="property-surface">Surface <span aria-hidden="true">*</span></label><div className={styles.unitInput}><input id="property-surface" name="surface" type="number" min="1" inputMode="decimal" value={formData.surface} onChange={updateField} placeholder="120" aria-invalid={!!errors.surface} aria-describedby={describedBy(errors, 'surface')} /><span>m²</span></div><FieldError id="surface">{errors.surface}</FieldError></div>
          <div><label htmlFor="property-bedrooms">Chambres <span className={styles.optional}>Optionnel</span></label><input id="property-bedrooms" name="bedrooms" type="number" min="0" inputMode="numeric" value={formData.bedrooms} onChange={updateField} placeholder="3" /></div>
          <div><label htmlFor="property-bathrooms">Salles de bain <span className={styles.optional}>Optionnel</span></label><input id="property-bathrooms" name="bathrooms" type="number" min="0" inputMode="numeric" value={formData.bathrooms} onChange={updateField} placeholder="2" /></div>
        </div></Section>
        <Section number="04" title="Équipements" introduction="Sélectionnez uniquement les équipements réellement disponibles." id="property-step-4"><fieldset className={styles.amenities}><legend className="sr-only">Équipements disponibles</legend>{AMENITIES.map((amenity) => <label key={amenity} className={formData.amenities.includes(amenity) ? styles.amenitySelected : undefined}><input type="checkbox" value={amenity} checked={formData.amenities.includes(amenity)} onChange={toggleAmenity} /><span className={styles.checkmark}><Check aria-hidden="true" /></span><span>{amenity}</span></label>)}</fieldset></Section>
        <Section number="05" title="Photos" introduction="Ajoutez des vues nettes et représentatives du bien." id="property-step-5">
          <div className={styles.upload} data-error={!!errors.images}><ImagePlus aria-hidden="true" /><strong>Ajoutez les photos du bien</strong><p>JPG, PNG ou WebP · 10 photos maximum · 100 Mo maximum par photo</p><label htmlFor="property-images" className={styles.uploadButton}>Choisir des photos</label><input id="property-images" className={styles.fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImages} aria-invalid={!!errors.images} aria-describedby={describedBy(errors, 'images')} /></div><FieldError id="images">{errors.images}</FieldError>
          {previews.length > 0 && <><div className={styles.previewHeader}><strong>{previews.length} {previews.length === 1 ? 'photo sélectionnée' : 'photos sélectionnées'}</strong><span>Vous pouvez les retirer avant l’envoi.</span></div><div className={styles.previews}>{previews.map(({ file, url }, index) => <figure key={`${file.name}-${file.lastModified}-${index}`}><img src={url} alt={`Aperçu de ${file.name}`} /><figcaption>{file.name}</figcaption><button type="button" onClick={() => removeImage(index)} aria-label={`Retirer ${file.name}`}><X aria-hidden="true" /></button></figure>)}</div></>}
        </Section>
        <Section number="06" title="Vérification & soumission" introduction="Relisez les informations. La soumission ne publie pas automatiquement le bien." id="property-step-6"><div className={styles.reviewNote}><ShieldCheck aria-hidden="true" /><div><strong>Validation avant publication</strong><p>Votre bien sera transmis avec le statut « En attente ». L’équipe Altimmo pourra vérifier les informations avant sa mise en ligne.</p></div></div><button className={styles.submit} type="submit" disabled={loading}>{loading ? <><Loader2 className={styles.spinner} aria-hidden="true" />Envoi de votre bien…</> : 'Soumettre mon bien'}</button><p className={styles.submitHelp}>Les champs marqués d’un * sont obligatoires.</p></Section>
      </form>
    </div>
  </div>;
}
