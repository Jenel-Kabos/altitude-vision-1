"use client";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  addInternalComparable,
  searchInternalComparables,
} from "../../services/estimationService";

const money = (value) =>
  Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("fr-FR")} XAF`
    : "—";
export default function InternalComparableSearch({
  estimation,
  onChange,
  notify,
}) {
  const [filters, setFilters] = useState({
    q: "",
    city: estimation.location?.city || "",
    transactionType: estimation.transaction || "",
    district: "",
    propertyType: "",
    minPrice: "",
    maxPrice: "",
    minSurface: "",
    maxSurface: "",
    radius: "",
    page: 1,
    limit: 10,
  });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const search = async (event, overrides = {}) => {
    event?.preventDefault();
    const params = { ...filters, ...overrides };
    setBusy(true);
    try {
      setData(await searchInternalComparables(estimation._id, params));
    } catch (error) {
      notify(
        error.response?.data?.message || "Recherche Altimmo impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  const add = async (propertyId) => {
    if (!window.confirm("Ajouter cette annonce comme comparable au prix demandé ?")) return;
    setBusy(true);
    try {
      const result = await addInternalComparable(estimation._id, propertyId);
      onChange(result.estimation);
      notify(result.warnings?.[0] || "Annonce ajoutée comme comparable.");
      await search();
    } catch (error) {
      notify(error.response?.data?.message || "Ajout impossible.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
      <h4 className="font-black">Rechercher une annonce Altimmo</h4>
      <p className="mt-1 text-xs text-slate-600">
        Les annonces sont toujours importées comme prix demandés. Elles ne
        prouvent pas une transaction conclue.
      </p>
      <form
        onSubmit={search}
        className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        <input
          aria-label="Recherche annonce"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Titre, type ou zone"
          value={filters.q}
          onChange={(event) =>
            setFilters({ ...filters, q: event.target.value, page: 1 })
          }
        />
        <input
          aria-label="Arrondissement annonce"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Arrondissement"
          value={filters.district}
          onChange={(event) =>
            setFilters({ ...filters, district: event.target.value, page: 1 })
          }
        />
        <input
          aria-label="Type annonce"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Type de bien"
          value={filters.propertyType}
          onChange={(event) =>
            setFilters({
              ...filters,
              propertyType: event.target.value,
              page: 1,
            })
          }
        />
        <input
          aria-label="Ville annonce"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Ville"
          value={filters.city}
          onChange={(event) =>
            setFilters({ ...filters, city: event.target.value, page: 1 })
          }
        />
        <select
          aria-label="Transaction annonce"
          className="rounded border px-3 py-2 text-sm"
          value={filters.transactionType}
          onChange={(event) =>
            setFilters({
              ...filters,
              transactionType: event.target.value,
              page: 1,
            })
          }
        >
          <option value="">Vente ou location</option>
          <option value="vente">Vente</option>
          <option value="location">Location</option>
        </select>
        <input
          aria-label="Prix minimum annonce"
          type="number"
          min="0"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Prix min"
          value={filters.minPrice}
          onChange={(event) =>
            setFilters({ ...filters, minPrice: event.target.value, page: 1 })
          }
        />
        <input
          aria-label="Prix maximum annonce"
          type="number"
          min="0"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Prix max"
          value={filters.maxPrice}
          onChange={(event) =>
            setFilters({ ...filters, maxPrice: event.target.value, page: 1 })
          }
        />
        <input
          aria-label="Surface minimum annonce"
          type="number"
          min="0"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Surface min"
          value={filters.minSurface}
          onChange={(event) =>
            setFilters({ ...filters, minSurface: event.target.value, page: 1 })
          }
        />
        <input
          aria-label="Surface maximum annonce"
          type="number"
          min="0"
          className="rounded border px-3 py-2 text-sm"
          placeholder="Surface max"
          value={filters.maxSurface}
          onChange={(event) =>
            setFilters({ ...filters, maxSurface: event.target.value, page: 1 })
          }
        />
        {Number.isFinite(Number(estimation.location?.latitude)) &&
          Number.isFinite(Number(estimation.location?.longitude)) && (
            <input
              aria-label="Rayon annonce"
              type="number"
              min="0"
              max="100"
              className="rounded border px-3 py-2 text-sm"
              placeholder="Rayon km"
              value={filters.radius}
              onChange={(event) =>
                setFilters({ ...filters, radius: event.target.value, page: 1 })
              }
            />
          )}
        <button
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white"
        >
          <Search className="mr-1 inline h-4 w-4" />
          Rechercher
        </button>
      </form>
      {data && (
        <div className="mt-3 space-y-2">
          {data.items.map((item) => (
            <article
              key={item._id}
              className="grid gap-2 rounded border bg-white p-3 text-sm sm:grid-cols-[1fr_auto]"
            >
              <div>
                <strong>{item.title}</strong>
                <p>
                  {item.type} · {item.address?.city || "—"} /{" "}
                  {item.address?.arrondissement || "—"} · {item.surface} m²
                </p>
                <p>
                  {money(item.price)} · {money(item.valuation?.pricePerSqm)}/m²
                  · distance directe {item.valuation?.distance ?? "—"} km
                </p>
                <p className="text-xs text-slate-500">
                  Similarité proposée {item.valuation?.score ?? "—"} % · poids{" "}
                  {item.valuation?.suggestedWeight ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  Prix demandé · {item.availability} · validation{" "}
                  {item.statusAdmin} · publié le{" "}
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString("fr-FR")
                    : "Non renseigné"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || item.alreadyAdded}
                onClick={() => add(item._id)}
                className="self-center rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300"
              >
                <Plus className="mr-1 inline h-4 w-4" />
                {item.alreadyAdded ? "Déjà ajouté" : "Ajouter"}
              </button>
            </article>
          ))}
          {!data.items.length && (
            <p className="p-3 text-center text-sm text-slate-500">
              Aucune annonce correspondante.
            </p>
          )}
          <div className="flex justify-between text-xs">
            <button
              type="button"
              disabled={data.pagination.page <= 1 || busy}
              onClick={() => {
                const page = data.pagination.page - 1;
                setFilters({ ...filters, page });
                search(null, { page });
              }}
            >
              Précédent
            </button>
            <span>
              Page {data.pagination.page} / {Math.max(1, data.pagination.pages)}
            </span>
            <button
              type="button"
              disabled={data.pagination.page >= data.pagination.pages || busy}
              onClick={() => {
                const page = data.pagination.page + 1;
                setFilters({ ...filters, page });
                search(null, { page });
              }}
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
