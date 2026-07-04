"use client";

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ClickMarker = ({ latitude, longitude, onMove }) => {
  useMapEvents({
    click(e) { onMove({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return (
    <Marker
      position={[latitude, longitude]}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const latlng = e.target.getLatLng();
          onMove({ lat: latlng.lat, lng: latlng.lng });
        },
      }}
    />
  );
};

const MapLeaflet = ({ latitude, longitude, onMove }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <MapContainer
      ref={mapRef}
      center={[latitude, longitude]}
      zoom={16}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickMarker latitude={latitude} longitude={longitude} onMove={onMove} />
    </MapContainer>
  );
};

export default MapLeaflet;
