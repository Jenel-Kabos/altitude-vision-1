"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, MapPinned, Save } from "lucide-react";

const Map = dynamic(() => import("./EstimationMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-80 place-items-center bg-slate-100 text-sm text-slate-500">
      Chargement de la carte…
    </div>
  ),
});
const validCoordinate = (value, min, max) =>
  value !== "" && value != null &&
  Number.isFinite(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;

export default function EstimationMapPanel({ estimation, onSave, notify }) {
  const stored = estimation.location || {};
  const [draft, setDraft] = useState({
    latitude: stored.latitude ?? "",
    longitude: stored.longitude ?? "",
  });
  const [radius, setRadius] = useState(20);
  const [command, setCommand] = useState("");
  useEffect(
    () =>
      setDraft({
        latitude: stored.latitude ?? "",
        longitude: stored.longitude ?? "",
      }),
    [estimation._id, stored.latitude, stored.longitude],
  );
  useEffect(() => {
    const focus = (event) => {
      const { latitude, longitude } = event.detail || {};
      if (
        validCoordinate(latitude, -90, 90) &&
        validCoordinate(longitude, -180, 180)
      )
        setCommand(`focus:${latitude}:${longitude}:${Date.now()}`);
    };
    window.addEventListener("valuation:focus-comparable", focus);
    return () =>
      window.removeEventListener("valuation:focus-comparable", focus);
  }, []);
  const valid =
    validCoordinate(draft.latitude, -90, 90) &&
    validCoordinate(draft.longitude, -180, 180);
  const dirty =
    String(draft.latitude) !== String(stored.latitude ?? "") ||
    String(draft.longitude) !== String(stored.longitude ?? "");
  const comparables = useMemo(
    () =>
      (estimation.comparables || []).filter(
        (item) =>
          validCoordinate(item.latitude, -90, 90) &&
          validCoordinate(item.longitude, -180, 180) &&
          (!(radius > 0) || item.distance == null || item.distance <= radius),
      ),
    [estimation.comparables, radius],
  );
  const save = () => {
    if (!valid) return notify("Latitude ou longitude invalide.", "error");
    onSave({
      location: {
        ...stored,
        latitude: Number(draft.latitude),
        longitude: Number(draft.longitude),
      },
    });
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold">
          Latitude
          <input
            aria-label="Latitude carte"
            type="number"
            step="any"
            min="-90"
            max="90"
            className="mt-1 w-full rounded border px-2 py-2"
            value={draft.latitude}
            onChange={(event) =>
              setDraft({ ...draft, latitude: event.target.value })
            }
          />
        </label>
        <label className="text-xs font-bold">
          Longitude
          <input
            aria-label="Longitude carte"
            type="number"
            step="any"
            min="-180"
            max="180"
            className="mt-1 w-full rounded border px-2 py-2"
            value={draft.longitude}
            onChange={(event) =>
              setDraft({ ...draft, longitude: event.target.value })
            }
          />
        </label>
        <label className="text-xs font-bold">
          Rayon (km)
          <input
            aria-label="Rayon comparables"
            type="number"
            min="0"
            max="100"
            className="mt-1 w-full rounded border px-2 py-2"
            value={radius}
            onChange={(event) => {
              const value = Number(event.target.value) || 0;
              setRadius(value);
              window.dispatchEvent(
                new CustomEvent("valuation:radius-change", {
                  detail: { radius: value },
                }),
              );
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setCommand(`property:${Date.now()}`)}
          className="self-end rounded bg-slate-100 px-3 py-2 text-xs font-bold"
        >
          <LocateFixed className="mr-1 inline h-4 w-4" />
          Bien
        </button>
        <button
          type="button"
          onClick={() => setCommand(`all:${Date.now()}`)}
          className="self-end rounded bg-slate-100 px-3 py-2 text-xs font-bold"
        >
          <MapPinned className="mr-1 inline h-4 w-4" />
          Tout voir
        </button>
      </div>
      {dirty && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">
          Coordonnées non enregistrées. Le déplacement du marqueur ne modifie
          pas le dossier automatiquement.
        </p>
      )}
      {!valid ? (
        <div className="grid min-h-80 place-items-center rounded border border-dashed text-center text-sm text-slate-500">
          Aucune coordonnée utilisable.
          <br />
          Saisissez une latitude et une longitude valides.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Map
            draft={{
              latitude: Number(draft.latitude),
              longitude: Number(draft.longitude),
            }}
            comparables={comparables}
            radius={radius}
            command={command}
            onDraftMove={(point) => setDraft(point)}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p>
          <span className="mr-3">
            <i className="mr-1 inline-block h-3 w-3 rounded-full bg-green-600" />
            Inclus
          </span>
          <span>
            <i className="mr-1 inline-block h-3 w-3 rounded-full bg-slate-400" />
            Exclu
          </span>{" "}
          · Distances directes uniquement
        </p>
        <button
          type="button"
          disabled={!valid || !dirty}
          onClick={save}
          className="rounded bg-blue-600 px-3 py-2 font-bold text-white disabled:opacity-40"
        >
          <Save className="mr-1 inline h-4 w-4" />
          Utiliser ces coordonnées
        </button>
      </div>
    </div>
  );
}
