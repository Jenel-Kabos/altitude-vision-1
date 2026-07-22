"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  BUILT_TYPES,
  LAND_TYPES,
  ROOM_TYPES,
} from "../../constants/valuationPropertyTypes";
import {
  ConstructionStep,
  ContactStep,
  DocumentsStep,
  EconomicsStep,
  EquipmentStep,
  LandStep,
  LocationStep,
  NeedStep,
  PropertyTypeStep,
  ReviewStep,
  RoomsStep,
} from "./EstimationWizardSteps";

const DRAFT_KEY = "altimmo-estimation-draft-v2";
const DRAFT_VERSION = 2;
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
const blankNumbers = (keys) => Object.fromEntries(keys.map((key) => [key, ""]));
export const INITIAL_PUBLIC_ESTIMATION = {
  publicFormVersion: 2,
  website: "",
  valuationPurpose: "",
  urgency: "",
  requestedValueType: "",
  typeBien: "",
  transaction: "vente",
  location: {
    country: "Congo",
    city: "",
    district: "",
    neighborhood: "",
    microZone: "",
    street: "",
    zoneType: "",
    latitude: "",
    longitude: "",
  },
  land: {
    ...blankNumbers(["surface", "streetFrontage", "depth", "facades"]),
    unit: "m²",
    shape: "",
    topography: "",
    slope: "",
    accessibility: "",
    pavedRoad: false,
    floodRisk: "",
    erosionRisk: "",
    fenced: false,
    serviced: false,
    waterAvailable: false,
    electricityAvailable: false,
  },
  construction: {
    ...blankNumbers([
      "builtSurface",
      "livingSurface",
      "floors",
      "buildings",
      "constructionYear",
      "renovationYear",
    ]),
    condition: "",
    finishLevel: "",
    roofType: "",
    walls: "",
    flooring: "",
    joinery: "",
    plumbing: "",
    electricity: "",
    renovationNeeded: false,
  },
  rooms: {
    ...blankNumbers([
      "bedrooms",
      "livingRooms",
      "kitchens",
      "bathrooms",
      "toilets",
      "offices",
      "shops",
      "apartments",
      "garages",
      "terraces",
      "balconies",
      "outbuildings",
      "parkingSpaces",
      "units",
      "occupiedUnits",
      "vacantUnits",
    ]),
    otherRooms: "",
  },
  equipment: [],
  equipmentComment: "",
  declaredValues: {
    ...blankNumbers([
      "desiredPrice",
      "purchasePrice",
      "lastKnownEstimate",
      "recentWorksAmount",
      "monthlyRent",
      "charges",
      "tenantCount",
      "occupancyRate",
    ]),
    acquisitionDate: "",
    currentlyListed: false,
    saleUrgency: "",
  },
  contact: {
    lastName: "",
    firstName: "",
    phone: "",
    whatsapp: "",
    email: "",
    preferredContact: "",
    availability: "",
    comment: "",
  },
};

const stepDefinitions = [
  ["need", "Votre besoin", NeedStep],
  ["type", "Type de bien", PropertyTypeStep],
  ["location", "Localisation", LocationStep],
  ["land", "Terrain", LandStep],
  ["construction", "Construction", ConstructionStep],
  ["rooms", "Composition", RoomsStep],
  ["equipment", "Équipements", EquipmentStep],
  ["documents", "Documents et photos", DocumentsStep],
  ["economics", "Informations économiques", EconomicsStep],
  ["contact", "Vos coordonnées", ContactStep],
  ["review", "Vérification et envoi", ReviewStep],
];
const relevantSteps = (type) =>
  stepDefinitions
    .filter(([key]) => key !== "land" || LAND_TYPES.has(type))
    .filter(([key]) => key !== "construction" || BUILT_TYPES.has(type))
    .filter(([key]) => key !== "rooms" || ROOM_TYPES.has(type));
const validate = (key, form, files) => {
  const errors = {};
  if (key === "need" && !form.valuationPurpose)
    errors.valuationPurpose = "Choisissez votre objectif.";
  if (key === "type" && !form.typeBien)
    errors.typeBien = "Choisissez un type de bien.";
  if (key === "location") {
    if (!form.location.city.trim()) errors.city = "La ville est requise.";
    if (!form.location.neighborhood.trim())
      errors.neighborhood = "Le quartier est requis.";
    if (
      form.location.latitude !== "" &&
      !(
        Number(form.location.latitude) >= -90 &&
        Number(form.location.latitude) <= 90
      )
    )
      errors.latitude = "Latitude invalide.";
    if (
      form.location.longitude !== "" &&
      !(
        Number(form.location.longitude) >= -180 &&
        Number(form.location.longitude) <= 180
      )
    )
      errors.longitude = "Longitude invalide.";
  }
  if (key === "land" && !(Number(form.land.surface) > 0))
    errors.landSurface = "Indiquez une surface positive.";
  if (key === "construction" && !(Number(form.construction.builtSurface) > 0))
    errors.builtSurface = "Indiquez une surface bâtie positive.";
  if (key === "contact") {
    if (!form.contact.lastName.trim()) errors.lastName = "Le nom est requis.";
    if (!/^[+\d][\d\s().-]{6,24}$/.test(form.contact.phone))
      errors.phone = "Téléphone invalide.";
    if (!/^\S+@\S+\.\S+$/.test(form.contact.email))
      errors.email = "Email invalide.";
  }
  if (
    key === "documents" &&
    [...files.photos, ...files.documents].some(
      (file) => file.size > 8 * 1024 * 1024,
    )
  )
    errors.files = "Chaque fichier doit peser 8 Mo maximum.";
  return errors;
};

export default function PublicEstimationWizard() {
  const [form, setForm] = useState(INITIAL_PUBLIC_ESTIMATION);
  const [files, setFiles] = useState({ photos: [], documents: [] });
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(null);
  const headingRef = useRef(null);
  const submittingRef = useRef(false);
  const steps = useMemo(() => relevantSteps(form.typeBien), [form.typeBien]);
  const [stepKey, stepLabel, Step] = steps[stepIndex] || steps[0];
  const percent = Math.min(
    99,
    Math.round((stepIndex / Math.max(1, steps.length)) * 100),
  );
  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors({});
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (
        saved?.draftVersion === DRAFT_VERSION &&
        Date.now() - saved.savedAt < DRAFT_TTL
      ) {
        if (
          window.confirm(
            "Un brouillon récent existe. Souhaitez-vous le reprendre ?",
          )
        )
          setForm({ ...INITIAL_PUBLIC_ESTIMATION, ...saved.form });
      } else if (saved) localStorage.removeItem(DRAFT_KEY);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user)
        setForm((current) => ({
          ...current,
          contact: {
            ...current.contact,
            lastName: current.contact.lastName || user.name || "",
            email: current.contact.email || user.email || "",
            phone: current.contact.phone || user.phone || "",
          },
        }));
    } catch {}
  }, []);
  useEffect(() => {
    // Une soumission réussie doit définitivement supprimer le brouillon.
    // L'ajout de `success` force aussi le cleanup du debounce encore en vol,
    // qui pouvait auparavant réécrire localStorage après removeItem().
    if (success) return undefined;
    const id = setTimeout(() => {
      const safe = JSON.parse(JSON.stringify(form));
      delete safe._locationError;
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          draftVersion: DRAFT_VERSION,
          savedAt: Date.now(),
          form: safe,
        }),
      );
    }, 400);
    return () => clearTimeout(id);
  }, [form, success]);
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);
  const next = () => {
    const nextErrors = validate(stepKey, form, files);
    if (Object.keys(nextErrors).length) return setErrors(nextErrors);
    setErrors({});
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  };
  const previous = () => {
    setErrors({});
    setStepIndex((index) => Math.max(0, index - 1));
  };
  const clearDraft = () => {
    if (window.confirm("Supprimer le brouillon enregistré ?")) {
      localStorage.removeItem(DRAFT_KEY);
      setForm(INITIAL_PUBLIC_ESTIMATION);
      setFiles({ photos: [], documents: [] });
      setStepIndex(0);
    }
  };
  const submit = async () => {
    if (submittingRef.current) return;
    const contactErrors = validate("contact", form, files);
    if (Object.keys(contactErrors).length) {
      setErrors(contactErrors);
      setStepIndex(steps.findIndex(([key]) => key === "contact"));
      return;
    }
    if (!confirmed)
      return setErrors({
        confirmed: "Confirmez les informations avant l’envoi.",
      });
    submittingRef.current = true;
    setSending(true);
    setUploadProgress(0);
    try {
      const payload = {
        ...form,
        surface: Number(form.land.surface || form.construction.builtSurface),
        adresse: [
          form.location.street,
          form.location.neighborhood,
          form.location.city,
        ]
          .filter(Boolean)
          .join(", "),
        chambres: form.rooms.bedrooms,
        etat: form.construction.condition,
      };
      delete payload._locationError;
      const body = new FormData();
      body.append("payload", JSON.stringify(payload));
      files.photos.forEach((file) => body.append("photos", file));
      files.documents.forEach((file) => body.append("documents", file));
      const response = await api.post("/estimation", body, {
        onUploadProgress: (event) => {
          if (event.total)
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      localStorage.removeItem(DRAFT_KEY);
      setSuccess(response.data?.data);
    } catch (error) {
      setErrors({
        submit: error.response?.data?.message || "Envoi impossible. Réessayez.",
      });
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  };
  if (success)
    return (
      <section
        className="rounded-3xl bg-white p-6 text-slate-900 sm:p-8"
        aria-live="polite"
      >
        <h3 className="text-2xl font-black">Demande reçue</h3>
        <p className="mt-3">
          Référence : <strong>{success.reference}</strong>
        </p>
        <p>Statut : {success.statut}</p>
        <p className="mt-3 text-sm">
          L’équipe Altimmo examinera le dossier et pourra demander une visite ou
          des informations complémentaires.
        </p>
        <a
          className="mt-5 inline-block rounded bg-slate-900 px-4 py-3 font-bold text-white"
          href="/altimmo"
        >
          Retour à Altimmo
        </a>
      </section>
    );
  const stepProps =
    stepKey === "documents"
      ? { files, setFiles, errors }
      : stepKey === "review"
        ? { form, files, confirmed, setConfirmed }
        : { form, set, errors };
  return (
    <section className="rounded-3xl bg-white p-4 text-slate-900 shadow-2xl sm:p-8">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            Étape {stepIndex + 1} sur {steps.length}
          </span>
          <button
            type="button"
            onClick={clearDraft}
            className="text-xs underline"
          >
            Supprimer le brouillon
          </button>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded bg-slate-200"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={percent}
        >
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {percent}% · {steps.length - stepIndex - 1} étape(s) restante(s)
        </p>
      </div>
      <h3
        ref={headingRef}
        tabIndex="-1"
        className="mb-5 text-xl font-black outline-none"
      >
        {stepLabel}
      </h3>
      <div aria-live="polite">
        {errors.submit && (
          <p className="mb-3 rounded bg-red-50 p-3 text-red-800">
            {errors.submit}
          </p>
        )}
        <Step {...stepProps} />
        {errors.confirmed && (
          <p className="mt-3 text-sm text-red-700">⚠ {errors.confirmed}</p>
        )}
      </div>
      <input
        className="hidden"
        tabIndex="-1"
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={(event) => set("website", event.target.value)}
      />
      <div className="sticky bottom-0 mt-6 flex justify-between gap-3 border-t bg-white/95 pt-4">
        <button
          type="button"
          onClick={previous}
          disabled={stepIndex === 0}
          className="rounded-xl border px-4 py-3 font-bold disabled:opacity-30"
        >
          Précédent
        </button>
        {stepKey === "review" ? (
          <button
            type="button"
            disabled={sending}
            onClick={submit}
            className="rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950"
          >
            {sending ? `Envoi… ${uploadProgress}%` : "Envoyer la demande"}
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
          >
            Suivant
          </button>
        )}
      </div>
    </section>
  );
}
