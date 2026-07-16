"use client";
import dynamic from "next/dynamic";
import { VALUATION_PROPERTY_TYPES } from "../../constants/valuationPropertyTypes";

const Map = dynamic(() => import("../dashboard/EstimationMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="grid h-72 place-items-center rounded bg-slate-100">
      Chargement de la carte…
    </div>
  ),
});
export const input =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 focus:border-amber-500 focus:outline-none";
export const Field = ({ label, error, required, children }) => (
  <label className="block text-sm font-bold text-slate-700">
    {label}
    {required && (
      <span aria-hidden="true" className="text-red-600">
        {" "}
        *
      </span>
    )}
    {children}
    {error && (
      <span className="mt-1 block text-xs text-red-700">⚠ {error}</span>
    )}
  </label>
);
const numberField = (label, key, form, set, options = {}) => (
  <Field label={label}>
    <input
      className={input}
      inputMode="decimal"
      type="number"
      min="0"
      step="any"
      value={form[key] ?? ""}
      onChange={(event) => set(key, event.target.value)}
      {...options}
    />
  </Field>
);

export function NeedStep({ form, set, errors }) {
  return (
    <div className="grid gap-4">
      <p className="rounded bg-amber-50 p-3 text-sm">
        Cette demande permet d’obtenir un avis de valeur immobilier. Une visite
        et des vérifications complémentaires peuvent être nécessaires.
      </p>
      <Field
        label="Pourquoi souhaitez-vous cette estimation ?"
        required
        error={errors.valuationPurpose}
      >
        <select
          className={input}
          value={form.valuationPurpose}
          onChange={(event) => set("valuationPurpose", event.target.value)}
        >
          <option value="">Sélectionnez</option>
          {[
            "Vente",
            "Achat",
            "Location",
            "Mise en garantie",
            "Succession",
            "Donation",
            "Investissement",
            "Assurance",
            "Partage familial",
            "Autre",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Urgence">
        <select
          className={input}
          value={form.urgency}
          onChange={(event) => set("urgency", event.target.value)}
        >
          <option value="">Non précisée</option>
          <option>Sans urgence</option>
          <option>Dans le mois</option>
          <option>Rapidement</option>
        </select>
      </Field>
      <Field label="Type de valeur recherchée">
        <select
          className={input}
          value={form.requestedValueType}
          onChange={(event) => set("requestedValueType", event.target.value)}
        >
          <option value="">Avis général</option>
          <option>Valeur de vente</option>
          <option>Valeur locative</option>
          <option>Valeur pour garantie</option>
        </select>
      </Field>
    </div>
  );
}
export function PropertyTypeStep({ form, set, errors }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {VALUATION_PROPERTY_TYPES.map((item) => (
        <button
          type="button"
          key={item.value}
          onClick={() => set("typeBien", item.value)}
          className={`rounded-xl border p-4 text-left ${form.typeBien === item.value ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white"}`}
          aria-pressed={form.typeBien === item.value}
        >
          <strong>{item.label}</strong>
          <span className="mt-1 block text-xs text-slate-500">
            {item.description}
          </span>
        </button>
      ))}
      {errors.typeBien && (
        <p className="text-sm text-red-700 sm:col-span-2">
          ⚠ {errors.typeBien}
        </p>
      )}
    </div>
  );
}
export function LocationStep({ form, set, errors }) {
  const location = form.location;
  const update = (key, value) => set("location", { ...location, [key]: value });
  const hasCoordinates =
    location.latitude !== "" &&
    location.longitude !== "" &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude));
  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        if (window.confirm("Utiliser cette position pour votre demande ?"))
          set("location", {
            ...location,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
      },
      () =>
        set("_locationError", "Position indisponible ou autorisation refusée."),
    );
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pays">
          <input
            className={input}
            value={location.country}
            onChange={(event) => update("country", event.target.value)}
          />
        </Field>
        <Field label="Ville" required error={errors.city}>
          <input
            className={input}
            value={location.city}
            onChange={(event) => update("city", event.target.value)}
          />
        </Field>
        <Field label="Arrondissement ou commune">
          <input
            className={input}
            value={location.district}
            onChange={(event) => update("district", event.target.value)}
          />
        </Field>
        <Field label="Quartier" required error={errors.neighborhood}>
          <input
            className={input}
            value={location.neighborhood}
            onChange={(event) => update("neighborhood", event.target.value)}
          />
        </Field>
        <Field label="Micro-zone">
          <input
            className={input}
            value={location.microZone}
            onChange={(event) => update("microZone", event.target.value)}
          />
        </Field>
        <Field label="Avenue ou repère">
          <input
            className={input}
            value={location.street}
            onChange={(event) => update("street", event.target.value)}
          />
        </Field>
        <Field label="Type de zone">
          <select
            className={input}
            value={location.zoneType}
            onChange={(event) => update("zoneType", event.target.value)}
          >
            <option value="">Non précisé</option>
            <option value="urbaine">Urbaine</option>
            <option value="périurbaine">Périurbaine</option>
            <option value="rurale">Rurale</option>
          </select>
        </Field>
        <Field label="Latitude" error={errors.latitude}>
          <input
            className={input}
            type="number"
            step="any"
            value={location.latitude}
            onChange={(event) => update("latitude", event.target.value)}
          />
        </Field>
        <Field label="Longitude" error={errors.longitude}>
          <input
            className={input}
            type="number"
            step="any"
            value={location.longitude}
            onChange={(event) => update("longitude", event.target.value)}
          />
        </Field>
      </div>
      <button
        type="button"
        onClick={locate}
        className="w-fit rounded-lg border px-3 py-2 text-sm font-bold"
      >
        Utiliser ma position
      </button>
      {form._locationError && (
        <p className="text-sm text-amber-700">{form._locationError}</p>
      )}
      {hasCoordinates ? (
        <div className="overflow-hidden rounded-xl border">
          <Map
            draft={{
              latitude: Number(location.latitude),
              longitude: Number(location.longitude),
            }}
            comparables={[]}
            radius={0}
            command=""
            onDraftMove={(point) => set("location", { ...location, ...point })}
          />
        </div>
      ) : (
        <p className="rounded bg-slate-100 p-4 text-sm">
          La carte est facultative. Saisissez des coordonnées pour l’afficher.
        </p>
      )}
    </div>
  );
}
export function LandStep({ form, set, errors }) {
  const land = form.land;
  const update = (key, value) => set("land", { ...land, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Surface du terrain" required error={errors.landSurface}>
        <input
          className={input}
          inputMode="decimal"
          type="number"
          min="0"
          value={land.surface}
          onChange={(event) => update("surface", event.target.value)}
        />
      </Field>
      <Field label="Unité">
        <select
          className={input}
          value={land.unit}
          onChange={(event) => update("unit", event.target.value)}
        >
          <option>m²</option>
          <option>hectare</option>
        </select>
      </Field>
      {[
        ["shape", "Forme"],
        ["streetFrontage", "Façade approximative"],
        ["depth", "Profondeur"],
        ["facades", "Nombre de façades"],
        ["topography", "Topographie"],
        ["slope", "Pente"],
        ["accessibility", "Accessible toute l’année ?"],
        ["floodRisk", "Risque d’inondation connu"],
        ["erosionRisk", "Risque d’érosion connu"],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={input}
            value={land[key]}
            onChange={(event) => update(key, event.target.value)}
          />
        </Field>
      ))}
      {[
        ["pavedRoad", "Route goudronnée"],
        ["fenced", "Terrain clôturé"],
        ["serviced", "Terrain viabilisé"],
        ["waterAvailable", "Eau disponible"],
        ["electricityAvailable", "Électricité disponible"],
      ].map(([key, label]) => (
        <label
          key={key}
          className="flex items-center gap-2 rounded border p-3 text-sm"
        >
          <input
            type="checkbox"
            checked={land[key]}
            onChange={(event) => update(key, event.target.checked)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
export function ConstructionStep({ form, set, errors }) {
  const data = form.construction;
  const update = (key, value) => set("construction", { ...data, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Surface bâtie" required error={errors.builtSurface}>
        <input
          className={input}
          type="number"
          min="0"
          value={data.builtSurface}
          onChange={(event) => update("builtSurface", event.target.value)}
        />
      </Field>
      {[
        ["livingSurface", "Surface habitable"],
        ["floors", "Nombre de niveaux"],
        ["buildings", "Nombre de bâtiments"],
        ["constructionYear", "Année approximative"],
        ["renovationYear", "Année de rénovation"],
        ["finishLevel", "Niveau de finition"],
        ["roofType", "Type de toiture"],
        ["walls", "Murs"],
        ["flooring", "Sol"],
        ["joinery", "Menuiseries"],
        ["plumbing", "Plomberie"],
        ["electricity", "Électricité"],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={input}
            type={
              key.includes("Year") ||
              ["floors", "buildings", "livingSurface"].includes(key)
                ? "number"
                : "text"
            }
            value={data[key]}
            onChange={(event) => update(key, event.target.value)}
          />
        </Field>
      ))}
      <Field label="État général">
        <select
          className={input}
          value={data.condition}
          onChange={(event) => update("condition", event.target.value)}
        >
          <option value="">Non précisé</option>
          {[
            "Neuf",
            "Excellent",
            "Bon",
            "Moyen",
            "À rénover",
            "Très dégradé",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={data.renovationNeeded}
          onChange={(event) => update("renovationNeeded", event.target.checked)}
        />
        Des rénovations sont-elles nécessaires ?
      </label>
    </div>
  );
}
export function RoomsStep({ form, set }) {
  const rooms = form.rooms;
  const update = (key, value) => set("rooms", { ...rooms, [key]: value });
  const fields = [
    ["bedrooms", "Chambres"],
    ["livingRooms", "Salons"],
    ["kitchens", "Cuisines"],
    ["bathrooms", "Salles de bain"],
    ["toilets", "Toilettes"],
    ["offices", "Bureaux"],
    ["shops", "Boutiques"],
    ["apartments", "Appartements"],
    ["garages", "Garages"],
    ["terraces", "Terrasses"],
    ["balconies", "Balcons"],
    ["outbuildings", "Dépendances"],
    ["parkingSpaces", "Places de parking"],
    ["units", "Unités"],
    ["occupiedUnits", "Unités occupées"],
    ["vacantUnits", "Unités libres"],
  ];
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
      {fields.map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={input}
            type="number"
            min="0"
            value={rooms[key]}
            onChange={(event) => update(key, event.target.value)}
          />
        </Field>
      ))}
      <Field label="Autres pièces">
        <input
          className={input}
          value={rooms.otherRooms}
          onChange={(event) => update("otherRooms", event.target.value)}
        />
      </Field>
    </div>
  );
}
export function EquipmentStep({ form, set }) {
  const items = [
    "Forage",
    "Château d’eau",
    "Raccordement eau",
    "Raccordement électricité",
    "Groupe électrogène",
    "Panneaux solaires",
    "Climatisation",
    "Piscine",
    "Jardin",
    "Parking",
    "Garage",
    "Ascenseur",
    "Vidéosurveillance",
    "Internet / fibre",
    "Système anti-incendie",
    "Clôture",
    "Gardiennage",
  ];
  const toggle = (item) =>
    set(
      "equipment",
      form.equipment.includes(item)
        ? form.equipment.filter((value) => value !== item)
        : [...form.equipment, item],
    );
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <label
            key={item}
            className="flex items-center gap-2 rounded border p-3"
          >
            <input
              type="checkbox"
              checked={form.equipment.includes(item)}
              onChange={() => toggle(item)}
            />
            {item}
          </label>
        ))}
      </div>
      <Field label="Autres équipements">
        <textarea
          className={input}
          value={form.equipmentComment}
          onChange={(event) => set("equipmentComment", event.target.value)}
        />
      </Field>
    </div>
  );
}
export function DocumentsStep({ files, setFiles, errors }) {
  const add = (key, list) =>
    setFiles((current) => ({
      ...current,
      [key]: [...current[key], ...Array.from(list)].slice(
        0,
        key === "photos" ? 5 : 3,
      ),
    }));
  return (
    <div className="space-y-4">
      <p className="rounded bg-amber-50 p-3 text-sm">
        N’envoyez pas de document contenant des informations sensibles inutiles.
      </p>
      <Field label="Photos (JPG, PNG ou WebP, 5 maximum)" error={errors.files}>
        <input
          className={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          capture="environment"
          onChange={(event) => add("photos", event.target.files)}
        />
      </Field>
      <Field label="Documents facultatifs (images ou PDF, 3 maximum)">
        <input
          className={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onChange={(event) => add("documents", event.target.files)}
        />
      </Field>
      {["photos", "documents"].map((key) => (
        <ul key={key} className="space-y-1 text-sm">
          {files[key].map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex justify-between rounded bg-slate-100 p-2"
            >
              <span>
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} Mo
              </span>
              <button
                type="button"
                onClick={() =>
                  setFiles((current) => ({
                    ...current,
                    [key]: current[key].filter((_, i) => i !== index),
                  }))
                }
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
export function EconomicsStep({ form, set }) {
  const data = form.declaredValues;
  const update = (key, value) =>
    set("declaredValues", { ...data, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <p className="rounded bg-blue-50 p-3 text-sm sm:col-span-2">
        Ces informations sont facultatives et servent uniquement à améliorer
        l’analyse. Elles ne constituent pas une valeur de marché.
      </p>
      {[
        ["desiredPrice", "Prix souhaité"],
        ["purchasePrice", "Prix d’achat initial"],
        ["lastKnownEstimate", "Dernière estimation connue"],
        ["recentWorksAmount", "Travaux récents"],
        ["monthlyRent", "Loyers mensuels"],
        ["charges", "Charges"],
        ["tenantCount", "Nombre de locataires"],
        ["occupancyRate", "Occupation approximative (%)"],
      ].map(([key, label]) => numberField(label, key, data, update))}
      <Field label="Date d’acquisition">
        <input
          className={input}
          type="date"
          value={data.acquisitionDate}
          onChange={(event) => update("acquisitionDate", event.target.value)}
        />
      </Field>
      <Field label="Urgence de vente">
        <input
          className={input}
          value={data.saleUrgency}
          onChange={(event) => update("saleUrgency", event.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={data.currentlyListed}
          onChange={(event) => update("currentlyListed", event.target.checked)}
        />
        Bien actuellement proposé
      </label>
    </div>
  );
}
export function ContactStep({ form, set, errors }) {
  const data = form.contact;
  const update = (key, value) => set("contact", { ...data, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nom" required error={errors.lastName}>
        <input
          className={input}
          autoComplete="family-name"
          value={data.lastName}
          onChange={(event) => update("lastName", event.target.value)}
        />
      </Field>
      <Field label="Prénom">
        <input
          className={input}
          autoComplete="given-name"
          value={data.firstName}
          onChange={(event) => update("firstName", event.target.value)}
        />
      </Field>
      <Field label="Téléphone" required error={errors.phone}>
        <input
          className={input}
          inputMode="tel"
          autoComplete="tel"
          value={data.phone}
          onChange={(event) => update("phone", event.target.value)}
        />
      </Field>
      <Field label="WhatsApp">
        <input
          className={input}
          inputMode="tel"
          value={data.whatsapp}
          onChange={(event) => update("whatsapp", event.target.value)}
        />
      </Field>
      <Field label="Email" required error={errors.email}>
        <input
          className={input}
          type="email"
          autoComplete="email"
          value={data.email}
          onChange={(event) => update("email", event.target.value)}
        />
      </Field>
      <Field label="Contact préféré">
        <select
          className={input}
          value={data.preferredContact}
          onChange={(event) => update("preferredContact", event.target.value)}
        >
          <option value="">Non précisé</option>
          <option>Téléphone</option>
          <option>WhatsApp</option>
          <option>Email</option>
        </select>
      </Field>
      <Field label="Disponibilité">
        <input
          className={input}
          value={data.availability}
          onChange={(event) => update("availability", event.target.value)}
        />
      </Field>
      <Field label="Commentaire">
        <textarea
          className={input}
          value={data.comment}
          onChange={(event) => update("comment", event.target.value)}
        />
      </Field>
    </div>
  );
}
export function ReviewStep({ form, files, confirmed, setConfirmed }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Objectif", form.valuationPurpose],
          ["Type", form.typeBien],
          [
            "Localisation",
            [form.location.neighborhood, form.location.city]
              .filter(Boolean)
              .join(", "),
          ],
          [
            "Terrain",
            form.land.surface
              ? `${form.land.surface} ${form.land.unit}`
              : "Non renseigné",
          ],
          ["Surface bâtie", form.construction.builtSurface || "Non renseigné"],
          ["Équipements", form.equipment.join(", ") || "Aucun indiqué"],
          [
            "Fichiers",
            `${files.photos.length} photo(s), ${files.documents.length} document(s)`,
          ],
          ["Prix déclaré", form.declaredValues.desiredPrice || "Non renseigné"],
          [
            "Contact",
            `${form.contact.firstName} ${form.contact.lastName} · ${form.contact.phone}`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded bg-slate-100 p-3">
            <strong>{label}</strong>
            <p>{value}</p>
          </div>
        ))}
      </div>
      <label className="flex items-start gap-2 rounded border p-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        Je confirme que les informations transmises sont exactes à ma
        connaissance et j’accepte qu’Altimmo les utilise pour traiter ma
        demande.
      </label>
      <p className="text-xs text-slate-500">
        Cet envoi constitue une demande d’avis de valeur. Une validation par le
        staff et des vérifications complémentaires restent nécessaires.
      </p>
    </div>
  );
}
