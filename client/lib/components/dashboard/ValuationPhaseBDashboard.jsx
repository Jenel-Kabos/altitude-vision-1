"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  compareEstimations,
  getLaboratoryStatistics,
  getMarketHistory,
} from "../../services/estimationService";

const money = (value) =>
  Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("fr-FR")} XAF`
    : "—";
export default function ValuationPhaseBDashboard({ estimations, notify }) {
  const [statistics, setStatistics] = useState(null);
  const [history, setHistory] = useState([]);
  const [period, setPeriod] = useState("month");
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    city: "",
    propertyType: "",
    status: "",
    transactionType: "",
    priceType: "",
    sourceType: "",
  });
  const statusCount = (name) =>
    statistics?.byStatus?.find((item) => item._id === name)?.count || 0;
  const chartHistory = useMemo(() => {
    const periods = {};
    history.forEach((item) => {
      periods[item.period] ||= { period: item.period };
      periods[item.period][`average_${item.priceType}`] = item.average;
    });
    return Object.values(periods);
  }, [history]);
  const comparisonExtremes = useMemo(() => {
    const values = comparison
      .map((item) => item.value?.recommended)
      .filter(Number.isFinite);
    const confidence = comparison
      .map((item) => item.confidenceScore)
      .filter(Number.isFinite);
    return {
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      confidence: confidence.length ? Math.max(...confidence) : null,
    };
  }, [comparison]);
  useEffect(() => {
    let active = true;
    Promise.all([
      getLaboratoryStatistics(filters),
      getMarketHistory({ period, ...filters }),
    ])
      .then(([stats, series]) => {
        if (active) {
          setStatistics(stats);
          setHistory(series);
        }
      })
      .catch(() =>
        notify("Certaines analyses Phase B sont indisponibles.", "error"),
      );
    return () => {
      active = false;
    };
  }, [
    period,
    filters.from,
    filters.to,
    filters.city,
    filters.propertyType,
    filters.status,
    filters.transactionType,
    filters.priceType,
    filters.sourceType,
  ]);
  const toggle = (id) =>
    setSelected((items) =>
      items.includes(id)
        ? items.filter((item) => item !== id)
        : items.length < 4
          ? [...items, id]
          : items,
    );
  const compare = async () => {
    if (selected.length < 2)
      return notify("Sélectionnez de 2 à 4 dossiers.", "error");
    setBusy(true);
    try {
      setComparison(await compareEstimations(selected));
    } catch (error) {
      notify(
        error.response?.data?.message || "Comparaison impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-black">
        Cockpit décisionnel, marché et comparaison
      </summary>
      <div className="mt-4 space-y-6">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <input
            aria-label="Filtre ville cockpit"
            className="rounded border px-2 py-2 text-sm"
            placeholder="Ville"
            value={filters.city}
            onChange={(event) =>
              setFilters({ ...filters, city: event.target.value })
            }
          />
          <input
            aria-label="Filtre type cockpit"
            className="rounded border px-2 py-2 text-sm"
            placeholder="Type de bien"
            value={filters.propertyType}
            onChange={(event) =>
              setFilters({ ...filters, propertyType: event.target.value })
            }
          />
          <select
            aria-label="Filtre statut cockpit"
            className="rounded border px-2 py-2 text-sm"
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
          >
            <option value="">Tous statuts</option>
            <option>En attente</option>
            <option>En cours</option>
            <option>En attente de validation</option>
            <option>Validée</option>
            <option>Rapport publié</option>
          </select>
          <input
            aria-label="Début cockpit"
            type="date"
            className="rounded border px-2 py-2 text-sm"
            value={filters.from}
            onChange={(event) =>
              setFilters({ ...filters, from: event.target.value })
            }
          />
          <input
            aria-label="Fin cockpit"
            type="date"
            className="rounded border px-2 py-2 text-sm"
            value={filters.to}
            onChange={(event) =>
              setFilters({ ...filters, to: event.target.value })
            }
          />
          <select
            aria-label="Type de prix marché"
            className="rounded border px-2 py-2 text-sm"
            value={filters.priceType}
            onChange={(event) =>
              setFilters({ ...filters, priceType: event.target.value })
            }
          >
            <option value="">Tous prix</option>
            <option value="demande">Demandé</option>
            <option value="negocie">Négocié</option>
            <option value="conclu">Conclu</option>
          </select>
        </div>
        <section>
          <h3 className="font-bold">Statistiques calculées côté serveur</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Total", statistics?.summary?.total],
              ["Non consultées", statistics?.summary?.unread],
              [
                "En analyse",
                statusCount("En cours") +
                  statusCount("Calcul automatique terminé") +
                  statusCount("Révision expert"),
              ],
              ["À valider", statusCount("En attente de validation")],
              ["Validés", statusCount("Validée")],
              ["Publiés", statusCount("Rapport publié")],
              [
                "Délai moyen (jours)",
                statistics?.summary?.averageProcessingDays != null
                  ? Number(statistics.summary.averageProcessingDays).toFixed(1)
                  : "—",
              ],
              ["Valeur basse cumulée", money(statistics?.summary?.values?.low)],
              [
                "Valeur recommandée cumulée",
                money(statistics?.summary?.values?.recommended),
              ],
              [
                "Valeur haute cumulée",
                money(statistics?.summary?.values?.high),
              ],
              [
                "Confiance moyenne",
                statistics?.summary?.confidenceAverage != null
                  ? `${statistics.summary.confidenceAverage}%`
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <strong>{value ?? "—"}</strong>
              </div>
            ))}
          </div>
          {statistics?.byStatus?.length > 0 && (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statistics.byStatus.map((item) => ({
                    name: item._id,
                    count: item.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">Historique du marché</h3>
            <select
              aria-label="Période historique"
              className="rounded border px-2 py-1 text-sm"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="month">Mois</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Année</option>
            </select>
          </div>
          {history.length ? (
            <>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={money} />
                    <Line
                      name="Demandé"
                      dataKey="average_demande"
                      stroke="#2563eb"
                      connectNulls
                    />
                    <Line
                      name="Négocié"
                      dataKey="average_negocie"
                      stroke="#f59e0b"
                      connectNulls
                    />
                    <Line
                      name="Conclu"
                      dataKey="average_conclu"
                      stroke="#16a34a"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th>Type de prix</th>
                      <th>Moyenne</th>
                      <th>Min–max</th>
                      <th>Échantillon</th>
                      <th>Variation</th>
                      <th>Dispersion</th>
                      <th>Confiance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, index) => (
                      <tr key={`${item.period}-${item.priceType}-${index}`}>
                        <td>{item.period}</td>
                        <td>{item.priceType}</td>
                        <td>{money(item.average)}</td>
                        <td>
                          {money(item.minimum)} – {money(item.maximum)}
                        </td>
                        <td>{money(item.dispersion)}</td>
                        <td>{item.confidenceAverage ?? "—"}/4</td>
                        <td>{item.sampleSize}</td>
                        <td>
                          {item.insufficientData
                            ? "Données insuffisantes"
                            : item.variation == null
                              ? "—"
                              : `${item.variation}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-500">
              Données insuffisantes.
            </p>
          )}
        </section>
        <section>
          <h3 className="font-bold">Comparer 2 à 4 dossiers</h3>
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-auto">
            {estimations.slice(0, 50).map((item) => (
              <label
                key={item._id}
                className="rounded border px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={selected.includes(item._id)}
                  onChange={() => toggle(item._id)}
                />
                Comparer — {item.referenceBien || item.nom}
              </label>
            ))}
          </div>
          <button
            disabled={busy || selected.length < 2}
            onClick={compare}
            className="mt-2 rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            Comparer ({selected.length})
          </button>
          {comparison.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Statut</th>
                    <th>Localisation</th>
                    <th>Type</th>
                    <th>Terrain</th>
                    <th>Bâti</th>
                    <th>Valeur</th>
                    <th>Basse / haute</th>
                    <th>Prix/m²</th>
                    <th>État</th>
                    <th>Confiance</th>
                    <th>Méthodes</th>
                    <th>Rendement net</th>
                    <th>Documents</th>
                    <th>Comparables</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((item) => (
                    <tr key={item.id}>
                      <td>{item.reference}</td>
                      <td>{item.status}</td>
                      <td>
                        {[
                          item.location?.city,
                          item.location?.district,
                          item.location?.neighborhood,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "Non renseigné"}
                      </td>
                      <td>{item.propertyType}</td>
                      <td>{item.landSurface || "—"}</td>
                      <td>{item.builtSurface || "—"}</td>
                      <td
                        className={
                          item.value?.recommended === comparisonExtremes.max
                            ? "bg-emerald-50 font-bold"
                            : item.value?.recommended === comparisonExtremes.min
                              ? "bg-amber-50 font-bold"
                              : ""
                        }
                      >
                        {item.value
                          ? money(item.value.recommended)
                          : "Calcul indisponible"}
                      </td>
                      <td>
                        {item.value
                          ? `${money(item.value.low)} / ${money(item.value.high)}`
                          : "Calcul indisponible"}
                      </td>
                      <td>{money(item.pricePerSqm)}</td>
                      <td>{item.condition || "Non renseigné"}</td>
                      <td
                        className={
                          item.confidenceScore === comparisonExtremes.confidence
                            ? "bg-blue-50 font-bold"
                            : ""
                        }
                      >
                        {item.confidenceScore ?? "Non renseigné"}
                        {item.confidenceScore != null ? "%" : ""}
                      </td>
                      <td>
                        {item.methods?.join(", ") || "Calcul indisponible"}
                      </td>
                      <td>
                        {item.rentalYield == null
                          ? "Non renseigné"
                          : `${item.rentalYield}%`}
                      </td>
                      <td>{item.verifiedDocuments}</td>
                      <td>{item.comparableCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </details>
  );
}
