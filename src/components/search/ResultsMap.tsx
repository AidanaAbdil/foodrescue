"use client";
// The homepage's map view: one pin per store. Loaded only in the browser
// (see ResultsMapLoader), because Leaflet needs `window`.
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

export type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  label: string; // e.g. "3 пакета · от 990 ₸" or "Сейчас пакетов нет"
  count: number; // bags on sale (0 = grey pin)
  href: string;
};

type Props = {
  places: MapPlace[];
  center: { lat: number; lng: number; zoom: number } | null; // the chosen city, if any
  me: { lat: number; lng: number } | null; // "near me" position
  labels: { open: string; you: string };
};

// A round pin with the number of bags; grey when nothing is on sale.
const pin = (count: number) =>
  L.divIcon({
    className: "",
    html: `<div style="display:grid;place-items:center;min-width:32px;height:32px;padding:0 8px;border-radius:999px;background:${
      count > 0 ? "#c2553a" : "#a8a29e"
    };color:#fff;font:700 14px/1 system-ui,sans-serif;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${count > 0 ? count : "·"}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

const youIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Show all pins (and "me"), or the chosen city when there are none.
function FitView({ places, center, me }: Omit<Props, "labels">) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = places.map((place) => [place.lat, place.lng]);
    if (me) points.push([me.lat, me.lng]);
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
    else if (center) map.setView([center.lat, center.lng], center.zoom);
  }, [map, places, center, me]);
  return null;
}

function NeutralCredit() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  }, [map]);
  return null;
}

export default function ResultsMap({ places, center, me, labels }: Props) {
  // Without a city: start over Kazakhstan; FitView then zooms to the pins.
  const start = center ?? { lat: 48.0, lng: 68.0, zoom: 5 };
  return (
    <MapContainer center={[start.lat, start.lng]} zoom={start.zoom} scrollWheelZoom={false}
      className="h-[65vh] min-h-80 w-full rounded-2xl ring-1 ring-stone-200">
      {/* OpenStreetMap tiles: free, need attribution. At scale, switch to a tile provider (e.g. 2GIS). */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <NeutralCredit />
      <FitView places={places} center={center} me={me} />
      {me && <Marker position={[me.lat, me.lng]} icon={youIcon} title={labels.you} />}
      {places.map((place) => (
        <Marker key={place.id} position={[place.lat, place.lng]} icon={pin(place.count)} title={place.name}>
          <Popup>
            <strong>{place.name}</strong>
            <br />
            {place.label}
            <br />
            <a href={place.href}>{labels.open}</a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
