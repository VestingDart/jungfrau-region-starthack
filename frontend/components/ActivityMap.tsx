'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type Activity, CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/activities';

function makeIcon(category: Activity['category'], active: boolean) {
  const color = CATEGORY_COLORS[category];
  const emoji = CATEGORY_ICONS[category];
  const size = active ? 44 : 36;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 3px 14px rgba(0,0,0,.35);
      border:2px solid #fff;
      display:flex;align-items:center;justify-content:center;
      transition:all .2s;
    "><span style="transform:rotate(45deg);font-size:${active ? 18 : 15}px;line-height:1">${emoji}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function FlyTo({ lat, lng, markerRef }: { lat: number; lng: number; markerRef: React.RefObject<L.Marker | null> }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 13, { duration: 1.2 });
    const t = setTimeout(() => { markerRef.current?.openPopup(); }, 1300);
    return () => clearTimeout(t);
  }, [lat, lng, map, markerRef]);
  return null;
}

interface Props {
  activities: Activity[];
  selected: string | null;
}

export default function ActivityMap({ activities, selected }: Props) {
  const active = activities.find(a => a.id === selected) ?? null;
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  return (
    <MapContainer
      center={[46.63, 7.98]}
      zoom={11}
      minZoom={7}
      style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {activities.map(a => (
        <Marker
          key={a.id}
          position={[a.lat, a.lng]}
          icon={makeIcon(a.category, a.id === selected)}
          ref={el => { markerRefs.current[a.id] = el; }}
        >
          <Popup>
            <div style={{ fontFamily: '-apple-system,sans-serif', minWidth: 160 }}>
              <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '.2rem' }}>{a.title}</div>
              <div style={{ fontSize: '.75rem', color: '#64748B', marginBottom: '.4rem' }}>{a.description}</div>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                <span style={{ background: CATEGORY_COLORS[a.category], color: '#fff', padding: '.1rem .45rem', borderRadius: 20, fontSize: '.65rem', fontWeight: 700 }}>{a.category}</span>
                {a.difficulty && <span style={{ background: '#F2EFE8', color: '#64748B', padding: '.1rem .45rem', borderRadius: 20, fontSize: '.65rem', fontWeight: 600 }}>{a.difficulty}</span>}
                <span style={{ background: '#F2EFE8', color: '#64748B', padding: '.1rem .45rem', borderRadius: 20, fontSize: '.65rem', fontWeight: 600 }}>⏱ {a.duration}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      {active && (
        <FlyTo
          lat={active.lat}
          lng={active.lng}
          markerRef={{ current: markerRefs.current[active.id] ?? null }}
        />
      )}
    </MapContainer>
  );
}
