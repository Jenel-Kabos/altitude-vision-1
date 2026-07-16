"use client";
import { useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { updateComparable } from "../../services/estimationService";

const field = "w-full rounded border border-slate-200 px-2 py-2 text-sm";
const numericKeys = new Set([
  "latitude",
  "longitude",
  "landSurface",
  "builtSurface",
  "askingPrice",
  "negotiatedPrice",
  "concludedPrice",
  "weight",
]);
export default function ComparableEditor({
  estimationId,
  comparable,
  onSaved,
  onClose,
  notify,
}) {
  const [form, setForm] = useState({
    ...comparable,
    date: comparable.date
      ? new Date(comparable.date).toISOString().slice(0, 10)
      : "",
  });
  const [busy, setBusy] = useState(false);
  const selectedPrice =
    form.priceType === "conclu"
      ? form.concludedPrice
      : form.priceType === "negocie"
        ? form.negotiatedPrice
        : form.askingPrice;
  const surface = Number(form.landSurface || form.builtSurface);
  const preview =
    Number(selectedPrice) > 0 && surface > 0
      ? Number(selectedPrice) / surface
      : null;
  const recency = useMemo(
    () =>
      form.date && !Number.isNaN(new Date(form.date).getTime())
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(form.date).getTime()) / 2629800000,
            ),
          )
        : null,
    [form.date],
  );
  const set = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  const submit = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        numericKeys.has(key) && value !== "" ? Number(value) : value,
      ]),
    );
    setBusy(true);
    try {
      const result = await updateComparable(
        estimationId,
        comparable._id,
        payload,
      );
      onSaved(result.estimation);
      notify(
        result.calculationStale
          ? "Comparable enregistré. Un nouveau calcul est recommandé."
          : "Comparable enregistré.",
      );
      onClose();
    } catch (error) {
      notify(error.response?.data?.message || "Comparable invalide.", "error");
    } finally {
      setBusy(false);
    }
  };
  const inputs = [
    ["source", "Source"],
    ["internalReference", "Référence"],
    ["date", "Date"],
    ["city", "Ville"],
    ["district", "Arrondissement"],
    ["neighborhood", "Quartier"],
    ["microZone", "Micro-zone"],
    ["latitude", "Latitude"],
    ["longitude", "Longitude"],
    ["propertyType", "Type de bien"],
    ["condition", "État"],
    ["landSurface", "Surface terrain"],
    ["builtSurface", "Surface bâtie"],
    ["askingPrice", "Prix demandé"],
    ["negotiatedPrice", "Prix négocié"],
    ["concludedPrice", "Prix conclu"],
    ["weight", "Poids retenu"],
  ];
  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-xl border-2 border-blue-200 bg-blue-50/30 p-3"
    >
      <div className="flex justify-between">
        <h4 className="font-black">Modifier le comparable</h4>
        <button type="button" onClick={onClose} aria-label="Fermer l’éditeur">
          <X />
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-bold">
          Type de source
          <select
            className={`${field} mt-1`}
            value={form.sourceType || ""}
            onChange={set("sourceType")}
          >
            <option value="reference_manuelle">Manuel</option>
            <option value="annonce_altimmo">Annonce Altimmo</option>
            <option value="transaction_altimmo">Transaction Altimmo</option>
            <option value="partenaire">Partenaire</option>
            <option value="autre">Autre</option>
          </select>
        </label>
        <label className="text-xs font-bold">
          Type de prix
          <select
            className={`${field} mt-1`}
            value={form.priceType || ""}
            onChange={set("priceType")}
          >
            <option value="demande">Demandé</option>
            <option value="negocie">Négocié</option>
            <option value="conclu">Conclu</option>
          </select>
        </label>
        <label className="text-xs font-bold">
          Confiance
          <select
            className={`${field} mt-1`}
            value={form.sourceConfidence || ""}
            onChange={set("sourceConfidence")}
          >
            <option value="faible">Faible</option>
            <option value="moyen">Moyen</option>
            <option value="bon">Bon</option>
            <option value="élevé">Élevé</option>
          </select>
        </label>
        {inputs.map(([key, label]) => (
          <label key={key} className="text-xs font-bold">
            {label}
            <input
              className={`${field} mt-1`}
              type={
                ["date"].includes(key)
                  ? "date"
                  : numericKeys.has(key)
                    ? "number"
                    : "text"
              }
              step={numericKeys.has(key) ? "any" : undefined}
              min={key === "weight" ? 0 : undefined}
              max={key === "weight" ? 1 : undefined}
              value={form[key] ?? ""}
              onChange={set(key)}
            />
          </label>
        ))}
      </div>
      <label className="mt-2 block text-xs font-bold">
        Notes et justification du prix conclu
        <textarea
          className={`${field} mt-1`}
          value={form.notes || ""}
          onChange={set("notes")}
        />
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={form.included !== false}
          onChange={set("included")}
        />
        Inclus dans le calcul
      </label>
      {form.included === false && (
        <label className="mt-2 block text-xs font-bold">
          Justification d’exclusion
          <textarea
            className={`${field} mt-1`}
            required
            value={form.exclusionReason || ""}
            onChange={set("exclusionReason")}
          />
        </label>
      )}
      <div className="mt-3 grid gap-2 rounded bg-white p-3 text-xs sm:grid-cols-4">
        <p>
          Prix/m² :{" "}
          <strong>
            {preview == null
              ? "Calcul indisponible"
              : `${Math.round(preview).toLocaleString("fr-FR")} XAF`}
          </strong>
        </p>
        <p>
          Distance directe :{" "}
          <strong>{comparable.distance ?? "Non renseigné"} km</strong>
        </p>
        <p>
          Similarité :{" "}
          <strong>{comparable.similarity ?? "Non renseigné"}%</strong>
        </p>
        <p>
          Récence :{" "}
          <strong>
            {recency == null ? "Non renseignée" : `${recency} mois`}
          </strong>
        </p>
      </div>
      {comparable.similarityDetails?.explanation?.length > 0 && (
        <ul className="mt-2 text-xs text-slate-600">
          {comparable.similarityDetails.explanation.map((item) => (
            <li key={item.factor}>
              {item.factor} : {item.level}
            </li>
          ))}
        </ul>
      )}
      <button
        disabled={busy}
        className="mt-3 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white"
      >
        <Save className="mr-1 inline h-4 w-4" />
        Enregistrer
      </button>
    </form>
  );
}
