"use client";
// The Leaflet map itself. Loaded only in the browser (see MapPicker), because
// Leaflet needs `window`.
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Coords } from "@/lib/geo";

// A terracotta pin drawn with CSS (Leaflet's default pin images often break with bundlers).
const pin = L.divIcon({
  className: "",
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#c2553a;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

type Props = {
  center: { lat: number; lng: number; zoom: number };
  coords: Coords | null;
  onPick: (coords: Coords) => void;
};

// Follows the city / chosen point when they change from outside the map.
function FollowView({ center, coords }: Pick<Props, "center" | "coords">) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 15));
    else map.setView([center.lat, center.lng], center.zoom);
  }, [map, center, coords]);
  return null;
}

// Plain "Leaflet" credit (the default one includes a flag icon); the
// OpenStreetMap credit on the tile layer is the one that's required.
function NeutralCredit() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  }, [map]);
  return null;
}

function ClickToPick({ onPick }: Pick<Props, "onPick">) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

export default function StoreMap({ center, coords, onPick }: Props) {
  return (
    <MapContainer
      center={[coords?.lat ?? center.lat, coords?.lng ?? center.lng]}
      zoom={coords ? 15 : center.zoom}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-xl ring-1 ring-stone-300"
    >
      {/* OpenStreetMap tiles: free, need attribution. At scale, switch to a tile provider (e.g. 2GIS). */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <NeutralCredit />
      <FollowView center={center} coords={coords} />
      <ClickToPick onPick={onPick} />
      {coords && (
        <Marker
          position={[coords.lat, coords.lng]}
          icon={pin}
          draggable
          eventHandlers={{ dragend: (event) => onPick((event.target as L.Marker).getLatLng()) }}
        />
      )}
    </MapContainer>
  );
}
