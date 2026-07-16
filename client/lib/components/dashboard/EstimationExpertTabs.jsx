"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  adjustExpertValue,
  getExpertAnalysis,
  scoreComparable,
  updateEstimation,
  deleteComparable,
} from "../../services/estimationService";
import EstimationMapPanel from "./EstimationMapPanel";
import InternalComparableSearch from "./InternalComparableSearch";
import ComparableEditor from "./ComparableEditor";

const TABS = [
  "Vue d’ensemble",
  "Localisation",
  "Terrain",
  "Construction",
  "Pièces",
  "Équipements",
  "Documents",
  "Photos",
  "Comparables",
  "Calculs",
  "Simulateur",
  "Ajustement expert",
  "Anomalies",
  "Historique",
  "Rapport",
];
const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const price = (value) =>
  Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("fr-FR")} XAF`
    : "—";
const newComparable = {
  source: "",
  sourceType: "reference_manuelle",
  internalReference: "",
  sourceConfidence: "faible",
  propertyType: "",
  city: "",
  district: "",
  neighborhood: "",
  landSurface: "",
  builtSurface: "",
  priceType: "demande",
  askingPrice: "",
  negotiatedPrice: "",
  concludedPrice: "",
  date: "",
  condition: "",
  weight: "",
  included: true,
  exclusionReason: "",
  notes: "",
};

export default function EstimationExpertTabs({ estimation, onChange, notify }) {
  const [tab, setTab] = useState("Vue d’ensemble");
  const [analysis, setAnalysis] = useState(null);
  const [comparable, setComparable] = useState(newComparable);
  const [adjustment, setAdjustment] = useState({
    adjustedValue: "",
    justification: "",
  });
  const [busy, setBusy] = useState(false);
  const loadAnalysis = async () => {
    try {
      setAnalysis(await getExpertAnalysis(estimation._id));
    } catch {
      setAnalysis(null);
    }
  };
  useEffect(() => {
    loadAnalysis();
  }, [estimation._id]);
  const save = async (payload) => {
    setBusy(true);
    try {
      onChange(await updateEstimation(estimation._id, payload));
      notify("Dossier enregistré.");
      await loadAnalysis();
    } catch (error) {
      notify(
        error.response?.data?.message || "Enregistrement impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  const addComparable = async (event) => {
    event.preventDefault();
    const amount =
      comparable.priceType === "conclu"
        ? comparable.concludedPrice
        : comparable.priceType === "negocie"
          ? comparable.negotiatedPrice
          : comparable.askingPrice;
    const surface = Number(comparable.landSurface || comparable.builtSurface);
    if (
      !(
        Number(amount) > 0 &&
        surface > 0 &&
        comparable.source &&
        comparable.sourceType &&
        comparable.priceType &&
        comparable.date
      )
    )
      return notify(
        "Source, type de source, type de prix, date, prix et surface positifs sont obligatoires.",
        "error",
      );
    setBusy(true);
    try {
      const scored = await scoreComparable(estimation._id, {
        ...comparable,
        pricePerSqm: Number(amount) / surface,
      });
      const item = {
        ...comparable,
        landSurface: Number(comparable.landSurface) || 0,
        builtSurface: Number(comparable.builtSurface) || 0,
        askingPrice: Number(comparable.askingPrice) || 0,
        negotiatedPrice: Number(comparable.negotiatedPrice) || 0,
        concludedPrice: Number(comparable.concludedPrice) || 0,
        pricePerSqm: Number((Number(amount) / surface).toFixed(2)),
        distance: scored.distance,
        similarity: scored.score,
        similarityDetails: scored.details,
        weight:
          comparable.weight === ""
            ? scored.suggestedWeight
            : Number(comparable.weight),
        included: true,
      };
      const updated = await updateEstimation(estimation._id, {
        comparables: [...(estimation.comparables || []), item],
      });
      onChange(updated);
      setComparable(newComparable);
      notify(scored.warnings?.[0] || "Comparable ajouté.");
      await loadAnalysis();
    } catch (error) {
      notify(error.response?.data?.message || "Comparable invalide.", "error");
    } finally {
      setBusy(false);
    }
  };
  const changeComparable = async (index, patch) => {
    const current = estimation.comparables[index];
    if (
      patch.included === false &&
      !String(patch.exclusionReason || current.exclusionReason || "").trim()
    )
      return notify(
        "Justifiez l’exclusion avant de retirer ce comparable du calcul.",
        "error",
      );
    return save({
      comparables: (estimation.comparables || []).map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    });
  };
  const removeComparable = async (index) =>
    save({
      comparables: (estimation.comparables || []).filter((_, i) => i !== index),
    });
  const submitAdjustment = async (event) => {
    event.preventDefault();
    if (
      !(Number(adjustment.adjustedValue) > 0 && adjustment.justification.trim())
    )
      return notify("Valeur positive et justification obligatoires.", "error");
    setBusy(true);
    try {
      const data = await adjustExpertValue(estimation._id, adjustment);
      onChange(data.estimation);
      notify(data.warning || "Ajustement expert historisé.");
    } catch (error) {
      notify(error.response?.data?.message || "Ajustement refusé.", "error");
    } finally {
      setBusy(false);
    }
  };
  const automatic =
    estimation.currentCalculation?.finalResult?.marketValue?.recommended;
  const manual = estimation.expertValueAdjustment;
  return (
    <section className="mt-5">
      {estimation.currentCalculation &&
        estimation.calculationInputUpdatedAt && (
          <p className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            Les données ont été modifiées. Un nouveau calcul est recommandé. Le
            dernier snapshot reste conservé.
          </p>
        )}
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {TABS.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${tab === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        {tab === "Vue d’ensemble" && (
          <Overview estimation={estimation} confidence={analysis?.confidence} />
        )}{" "}
        {tab === "Localisation" && (
          <div className="space-y-4">
            <Summary
              title="Localisation"
              values={[
                ["Ville", estimation.location?.city],
                ["Arrondissement", estimation.location?.district],
                ["Quartier", estimation.location?.neighborhood],
                ["Adresse", estimation.adresse],
              ]}
            />
            <EstimationMapPanel
              estimation={estimation}
              onSave={save}
              notify={notify}
            />
          </div>
        )}{" "}
        {tab === "Terrain" && (
          <Summary
            title="Terrain"
            values={[
              ["Surface", estimation.land?.surface || estimation.surface],
              ["Forme", estimation.land?.shape],
              ["Topographie", estimation.land?.topography],
            ]}
          />
        )}{" "}
        {tab === "Construction" && (
          <Summary
            title="Construction"
            values={[
              ["Surface bâtie", estimation.construction?.builtSurface],
              ["État", estimation.construction?.condition || estimation.etat],
              [
                "Vétusté",
                estimation.construction?.depreciationRate != null
                  ? `${estimation.construction.depreciationRate}%`
                  : null,
              ],
            ]}
          />
        )}{" "}
        {tab === "Pièces" && (
          <Summary
            title="Pièces"
            values={Object.entries(estimation.rooms || {})}
          />
        )}{" "}
        {tab === "Équipements" && (
          <List title="Équipements" items={estimation.equipment || []} />
        )}{" "}
        {tab === "Documents" && (
          <List
            title="Documents"
            items={(estimation.documents || []).map(
              (item) =>
                `${item.name || "Document"} · ${item.verified ? "Vérifié" : "À vérifier"}`,
            )}
          />
        )}{" "}
        {tab === "Photos" && (
          <List
            title="Photos"
            items={(estimation.photos || []).map(
              (item) => item.label || item.url,
            )}
          />
        )}{" "}
        {tab === "Comparables" && (
          <div className="space-y-4">
            <InternalComparableSearch
              estimation={estimation}
              onChange={onChange}
              notify={notify}
            />
            <ComparablePanel
              estimation={estimation}
              comparable={comparable}
              setComparable={setComparable}
              addComparable={addComparable}
              changeComparable={changeComparable}
              removeComparable={removeComparable}
              busy={busy}
              onChange={onChange}
              notify={notify}
              showOnMap={(item) => {
                setTab("Localisation");
                setTimeout(
                  () =>
                    window.dispatchEvent(
                      new CustomEvent("valuation:focus-comparable", {
                        detail: {
                          latitude: item.latitude,
                          longitude: item.longitude,
                        },
                      }),
                    ),
                  0,
                );
              }}
            />
          </div>
        )}{" "}
        {tab === "Calculs" && (
          <Summary
            title="Calcul"
            values={[
              ["Version", estimation.currentCalculation?.version],
              [
                "Valeur basse",
                price(
                  estimation.currentCalculation?.finalResult?.marketValue?.low,
                ),
              ],
              ["Valeur recommandée", price(automatic)],
              [
                "Valeur haute",
                price(
                  estimation.currentCalculation?.finalResult?.marketValue?.high,
                ),
              ],
            ]}
          />
        )}{" "}
        {tab === "Simulateur" && (
          <p className="text-sm text-slate-600">
            Le simulateur est disponible dans la fiche principale ; ses
            hypothèses ne remplacent pas le calcul validé.
          </p>
        )}{" "}
        {tab === "Ajustement expert" && (
          <form onSubmit={submitAdjustment} className="max-w-xl space-y-3">
            <Summary
              title="Valeur automatique"
              values={[["Recommandée", price(automatic)]]}
            />
            <label className="block text-sm font-bold">
              Valeur ajustée
              <input
                type="number"
                min="1"
                className={`${input} mt-1`}
                value={adjustment.adjustedValue}
                onChange={(e) =>
                  setAdjustment({
                    ...adjustment,
                    adjustedValue: e.target.value,
                  })
                }
              />
            </label>
            <label className="block text-sm font-bold">
              Justification
              <textarea
                required
                className={`${input} mt-1`}
                value={adjustment.justification}
                onChange={(e) =>
                  setAdjustment({
                    ...adjustment,
                    justification: e.target.value,
                  })
                }
              />
            </label>
            <button
              disabled={busy}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
            >
              Valider l’ajustement
            </button>
            {manual && (
              <p className="text-sm">
                Ajustée : <strong>{price(manual.adjustedValue)}</strong> · écart{" "}
                {manual.differencePercent}% · {manual.justification}
              </p>
            )}
          </form>
        )}{" "}
        {tab === "Anomalies" && (
          <Analysis
            anomalies={analysis?.anomalies}
            confidence={analysis?.confidence}
          />
        )}{" "}
        {tab === "Historique" && (
          <List
            title="Historique"
            items={(estimation.workflowHistory || [])
              .slice()
              .reverse()
              .map(
                (item) =>
                  `${item.from || "Création"} → ${item.to} · ${item.comment || ""}`,
              )}
          />
        )}{" "}
        {tab === "Rapport" && (
          <p className="text-sm text-slate-600">
            Le rapport HTML/PDF est accessible après validation et publication.
            Il utilise exclusivement le snapshot publié.
          </p>
        )}
      </div>
    </section>
  );
}
function Overview({ estimation, confidence }) {
  return (
    <div>
      <h3 className="font-black">
        {estimation.referenceBien || estimation.nom}
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        {estimation.typeBien} · {estimation.surface} m² ·{" "}
        {estimation.location?.city || estimation.adresse}
      </p>
      {confidence && (
        <p className="mt-3 rounded bg-blue-50 p-3 text-sm">
          Confiance explicable : <strong>{confidence.total}%</strong>
        </p>
      )}
    </div>
  );
}
function Summary({ title, values }) {
  return (
    <div>
      <h3 className="mb-3 font-black">{title}</h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div key={label} className="rounded bg-slate-50 p-2">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-sm font-semibold">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
function List({ title, items }) {
  return (
    <div>
      <h3 className="mb-3 font-black">{title}</h3>
      {items.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="rounded bg-slate-50 p-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Aucune donnée.</p>
      )}
    </div>
  );
}
function Analysis({ anomalies = [], confidence }) {
  return (
    <div>
      <h3 className="font-black">Anomalies et confiance</h3>
      {confidence && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {confidence.details.map((item) => (
            <p key={item.label} className="rounded bg-slate-50 p-2 text-sm">
              {item.label} :{" "}
              <strong>
                {item.score}/{item.max}
              </strong>
            </p>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {anomalies.length ? (
          anomalies.map((item) => (
            <div
              key={item.code}
              className={`rounded p-3 text-sm ${item.level === "critical" ? "bg-red-50 text-red-800" : item.level === "warning" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}
            >
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              <strong>{item.code}</strong> — {item.message}
              <br />
              <span className="text-xs">{item.suggestion}</span>
            </div>
          ))
        ) : (
          <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mr-2 inline h-4 w-4" />
            Aucune anomalie détectée.
          </p>
        )}
      </div>
    </div>
  );
}
function ComparablePanel({
  estimation,
  comparable,
  setComparable,
  addComparable,
  changeComparable,
  removeComparable,
  busy,
  onChange,
  notify,
  showOnMap,
}) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [radiusFilter, setRadiusFilter] = useState(20);
  useEffect(() => { const updateRadius = event => { setRadiusFilter(Number(event.detail?.radius) || 0); setPage(1); }; window.addEventListener('valuation:radius-change', updateRadius); return () => window.removeEventListener('valuation:radius-change', updateRadius); }, []);
  const pageSize = 10;
  const set = (key) => (event) =>
    setComparable({ ...comparable, [key]: event.target.value });
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (estimation.comparables || [])
      .filter(
        (item) =>
          (!needle ||
            [
              item.source,
              item.city,
              item.district,
              item.neighborhood,
              item.internalReference,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(needle),
            )) &&
          (stateFilter === "all" ||
            (stateFilter === "included"
              ? item.included !== false
              : item.included === false)) &&
          (sourceFilter === "all" || item.sourceType === sourceFilter) &&
          (!(radiusFilter > 0) || item.distance == null || Number(item.distance) <= radiusFilter),
      )
      .sort((a, b) =>
        sort === "similarity"
          ? Number(b.similarity || 0) - Number(a.similarity || 0)
          : sort === "distance"
            ? Number(a.distance ?? Infinity) - Number(b.distance ?? Infinity)
            : new Date(b.date || 0) - new Date(a.date || 0),
      );
  }, [estimation.comparables, query, stateFilter, sourceFilter, sort, radiusFilter]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const removeDedicated = async (item) => {
    if (!window.confirm(`Supprimer le comparable « ${item.source} » ?`)) return;
    try {
      const result = await deleteComparable(estimation._id, item._id);
      onChange(result.estimation);
      notify(
        result.calculationStale
          ? "Comparable supprimé. Un nouveau calcul est recommandé."
          : "Comparable supprimé.",
      );
    } catch (error) {
      notify(
        error.response?.data?.message || "Suppression impossible.",
        "error",
      );
    }
  };
  return (
    <div>
      <h3 className="font-black">Comparables</h3>
      <form
        onSubmit={addComparable}
        className="mt-3 grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-3"
      >
        <input
          required
          className={input}
          placeholder="Source"
          value={comparable.source}
          onChange={set("source")}
        />
        <select
          required
          aria-label="Type de source"
          className={input}
          value={comparable.sourceType}
          onChange={set("sourceType")}
        >
          <option value="reference_manuelle">Référence manuelle</option>
          <option value="annonce_altimmo">Annonce Altimmo</option>
          <option value="transaction_altimmo">Transaction Altimmo</option>
          <option value="partenaire">Partenaire</option>
          <option value="autre">Autre</option>
        </select>
        <input
          className={input}
          placeholder="Référence interne"
          value={comparable.internalReference}
          onChange={set("internalReference")}
        />
        <input
          required
          className={input}
          placeholder="Type de bien"
          value={comparable.propertyType}
          onChange={set("propertyType")}
        />
        <input
          required
          type="date"
          className={input}
          value={comparable.date}
          onChange={set("date")}
        />
        <select
          required
          aria-label="Type de prix"
          className={input}
          value={comparable.priceType}
          onChange={set("priceType")}
        >
          <option value="demande">Prix demandé</option>
          <option value="negocie">Prix négocié</option>
          <option value="conclu">Prix conclu</option>
        </select>
        <input
          type="number"
          min="0.01"
          step="any"
          className={input}
          placeholder="Surface terrain m²"
          value={comparable.landSurface}
          onChange={set("landSurface")}
        />
        <input
          type="number"
          min="0.01"
          step="any"
          className={input}
          placeholder="Surface bâtie m²"
          value={comparable.builtSurface}
          onChange={set("builtSurface")}
        />
        <input
          type="number"
          min="0.01"
          className={input}
          placeholder="Prix demandé"
          value={comparable.askingPrice}
          onChange={set("askingPrice")}
        />
        <input
          type="number"
          min="0.01"
          className={input}
          placeholder="Prix négocié"
          value={comparable.negotiatedPrice}
          onChange={set("negotiatedPrice")}
        />
        <input
          type="number"
          min="0.01"
          className={input}
          placeholder="Prix conclu"
          value={comparable.concludedPrice}
          onChange={set("concludedPrice")}
        />
        <button
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white"
        >
          <Plus className="mr-1 inline h-4 w-4" />
          Ajouter
        </button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <input
          aria-label="Rechercher dans les comparables"
          className={input}
          placeholder="Rechercher source ou zone"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filtrer inclusion"
          className={input}
          value={stateFilter}
          onChange={(event) => {
            setStateFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">Inclus et exclus</option>
          <option value="included">Inclus</option>
          <option value="excluded">Exclus</option>
        </select>
        <select
          aria-label="Filtrer source"
          className={input}
          value={sourceFilter}
          onChange={(event) => {
            setSourceFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">Toutes sources</option>
          <option value="annonce_altimmo">Annonces Altimmo</option>
          <option value="transaction_altimmo">Transactions</option>
          <option value="reference_manuelle">Manuels</option>
          <option value="partenaire">Partenaires</option>
        </select>
        <select
          aria-label="Trier comparables"
          className={input}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="date">Plus récents</option>
          <option value="similarity">Similarité</option>
          <option value="distance">Distance</option>
        </select>
      </div>
      <p className="mt-2 text-xs text-slate-500">Rayon partagé avec la carte : {radiusFilter > 0 ? `${radiusFilter} km` : "sans limite"}</p>
      <div className="mt-4 space-y-2">
        {visible.map((item, index) => (
          <div key={item._id || index} className="rounded border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{item.source}</strong>
              <span>
                {item.included === false ? "Exclu" : "Inclus"} · similarité{" "}
                {item.similarity ?? "—"}% · poids {item.weight ?? "—"}
              </span>
            </div>
            <p>
              {item.propertyType} · {item.pricePerSqm || "—"} XAF/m² ·{" "}
              {item.priceType === "conclu"
                ? "prix conclu"
                : item.priceType === "negocie"
                  ? "prix négocié"
                  : "prix demandé"}
              {item.distance != null ? ` · ${item.distance} km` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Influence{" "}
              {Number(item.weight) >= 0.7
                ? "forte"
                : Number(item.weight) >= 0.4
                  ? "modérée"
                  : "faible"}{" "}
              : similarité, récence, proximité et fiabilité de la source
              déterminent le poids proposé.
            </p>
            <p className="mt-1 text-xs">
              {item.city || "Non renseigné"} ·{" "}
              {item.district || "Non renseigné"} ·{" "}
              {(item.landSurface || item.builtSurface) ?? "Non renseigné"} m² ·{" "}
              {item.date
                ? new Date(item.date).toLocaleDateString("fr-FR")
                : "Non renseigné"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setEditing(editing === item._id ? null : item._id)
                }
                className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700"
              >
                <Pencil className="inline h-3 w-3" /> Modifier
              </button>
              {Number.isFinite(Number(item.latitude)) &&
                Number.isFinite(Number(item.longitude)) && (
                  <button
                    type="button"
                    onClick={() => showOnMap(item)}
                    className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                  >
                    <MapPin className="inline h-3 w-3" /> Voir sur la carte
                  </button>
                )}
              <button
                type="button"
                onClick={() =>
                  item.included === false
                    ? setEditing(item._id)
                    : setEditing(item._id)
                }
                className="rounded bg-slate-100 px-2 py-1 text-xs"
              >
                {item.included === false
                  ? "Réintégrer dans l’éditeur"
                  : "Exclure dans l’éditeur"}
              </button>
              <button
                type="button"
                onClick={() => removeDedicated(item)}
                className="rounded bg-red-50 px-2 py-1 text-xs text-red-700"
              >
                <Trash2 className="inline h-3 w-3" /> Supprimer
              </button>
            </div>
            {editing === item._id && (
              <ComparableEditor
                estimationId={estimation._id}
                comparable={item}
                onSaved={onChange}
                onClose={() => setEditing(null)}
                notify={notify}
              />
            )}
          </div>
        ))}
        {!(estimation.comparables || []).length && (
          <p className="text-sm text-slate-500">Aucun comparable.</p>
        )}
        {filtered.length > pageSize && (
          <div className="flex justify-between text-xs">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Précédent
            </button>
            <span>
              Page {page} / {Math.ceil(filtered.length / pageSize)}
            </span>
            <button
              type="button"
              disabled={page >= Math.ceil(filtered.length / pageSize)}
              onClick={() => setPage((value) => value + 1)}
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
