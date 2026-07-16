"use client";
import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const propertyIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const includedIcon = new L.DivIcon({
  className: "",
  html: '<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:#16a34a;box-shadow:0 1px 5px #334155"></span>',
  iconSize: [18, 18],
});
const excludedIcon = new L.DivIcon({
  className: "",
  html: '<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:#94a3b8;box-shadow:0 1px 5px #334155"></span>',
  iconSize: [18, 18],
});

function DraggableProperty({ position, onDraftMove }) {
  useMapEvents({
    click: (event) =>
      onDraftMove({ latitude: event.latlng.lat, longitude: event.latlng.lng }),
  });
  return (
    <Marker
      position={position}
      icon={propertyIcon}
      draggable
      eventHandlers={{
        dragend: (event) => {
          const point = event.target.getLatLng();
          onDraftMove({ latitude: point.lat, longitude: point.lng });
        },
      }}
    >
      <Popup>Bien expertisé — position provisoire</Popup>
    </Marker>
  );
}
function MapActions({ command, positions }) {
  const map = useMap();
  useEffect(() => {
    if (command.startsWith("property") && positions[0])
      map.flyTo(positions[0], 16);
    if (command.startsWith("all") && positions.length)
      map.fitBounds(positions, { padding: [30, 30], maxZoom: 16 });
    if (command.startsWith("focus:")) {
      const [, latitude, longitude] = command.split(":");
      if (
        Number.isFinite(Number(latitude)) &&
        Number.isFinite(Number(longitude))
      )
        map.flyTo([Number(latitude), Number(longitude)], 17);
    }
  }, [command, map, positions]);
  return null;
}

export default function EstimationMapLeaflet({
  draft,
  comparables,
  radius,
  command,
  onDraftMove,
}) {
  const position = [draft.latitude, draft.longitude];
  const positions = [
    position,
    ...comparables.map((item) => [item.latitude, item.longitude]),
  ];
  return (
    <MapContainer
      center={position}
      zoom={14}
      className="h-full min-h-80 w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <DraggableProperty position={position} onDraftMove={onDraftMove} />
      {radius > 0 && (
        <Circle
          center={position}
          radius={radius * 1000}
          pathOptions={{ color: "#2563eb", fillOpacity: 0.04 }}
        />
      )}
      {comparables.map((item, index) => (
        <Marker
          key={item._id || index}
          position={[item.latitude, item.longitude]}
          icon={item.included === false ? excludedIcon : includedIcon}
        >
          <Tooltip>{item.source}</Tooltip>
          <Popup>
            <strong>{item.source}</strong>
            <br />
            Distance directe : {item.distance ?? "—"} km
            <br />
            Similarité : {item.similarity ?? "—"} %
          </Popup>
        </Marker>
      ))}
      <MapActions command={command} positions={positions} />
    </MapContainer>
  );
}
