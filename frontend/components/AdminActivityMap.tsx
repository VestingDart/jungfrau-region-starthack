'use client';

import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ACTIVITIES, CATEGORY_COLORS } from '@/lib/activities';
import type { Activity } from '@/lib/activities';
import { useLanguage } from '@/lib/language';

interface ActivityStat {
  activity_id: string;
  activity_title: string;
  category: string;
  views: number;
}

interface Props {
  stats: ActivityStat[];
  activities?: Activity[];
}

export default function AdminActivityMap({ stats, activities = ACTIVITIES }: Props) {
  const { t } = useLanguage();
  const maxViews = stats.reduce((m, s) => Math.max(m, s.views), 1);
  const statMap = Object.fromEntries(stats.map(s => [s.activity_id, s]));

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
      {activities.map(a => {
        const stat = statMap[a.id];
        const views = stat?.views ?? 0;
        const radius = views > 0 ? 6 + (views / maxViews) * 14 : 4;
        const color = CATEGORY_COLORS[a.category];
        const opacity = views > 0 ? 0.75 : 0.2;
        return (
          <CircleMarker
            key={a.id}
            center={[a.lat, a.lng]}
            radius={radius}
            pathOptions={{
              fillColor: color,
              fillOpacity: opacity,
              color: color,
              weight: views > 0 ? 2 : 1,
              opacity: views > 0 ? 0.9 : 0.35,
            }}
          >
            <Tooltip direction="top" offset={[0, -radius]} permanent={false}>
              <div style={{ fontFamily: '-apple-system,sans-serif', minWidth: 120 }}>
                <div style={{ fontWeight: 700, fontSize: '.82rem' }}>{a.title}</div>
                <div style={{ fontSize: '.72rem', color: '#64748B', marginTop: '.15rem' }}>
                  {views > 0
                    ? `${views} ${views === 1 ? t('common.view') : t('common.views')}`
                    : t('admin.noActivityViews').split(' —')[0]}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
