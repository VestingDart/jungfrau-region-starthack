export interface Activity {
  id: string;
  title: string;
  description: string;
  category: 'hiking' | 'skiing' | 'sightseeing' | 'adventure';
  difficulty?: 'easy' | 'medium' | 'hard';
  duration: string;
  lat: number;
  lng: number;
  season: 'summer' | 'winter' | 'both';
}

export const ACTIVITIES: Activity[] = [
  // ── Year-round ─────────────────────────────────────────────────────────────
  {
    id: 'a1', season: 'both',
    title: 'Jungfraujoch — Top of Europe',
    description: "Europe's highest railway station at 3,454 m. Iconic glacier views and the Sphinx Observatory.",
    category: 'sightseeing', duration: 'Full day', lat: 46.5473, lng: 7.9854,
  },
  {
    id: 'a4', season: 'both',
    title: 'Kleine Scheidegg',
    description: 'Mountain pass between Grindelwald and Wengen — gateway to the Jungfraubahn. Spectacular in any season.',
    category: 'sightseeing', duration: '2 h', lat: 46.5853, lng: 7.9597,
  },

  // ── Summer only ─────────────────────────────────────────────────────────────
  {
    id: 'a2', season: 'summer',
    title: 'Grindelwald First Cliff Walk',
    description: 'Thrilling suspension bridge and cliff walk with panoramic views over Grindelwald valley.',
    category: 'hiking', difficulty: 'easy', duration: '2–3 h', lat: 46.6620, lng: 8.0583,
  },
  {
    id: 'a3', season: 'summer',
    title: 'Männlichen Panorama Hike',
    description: 'Classic ridge hike with unobstructed views of the Eiger, Mönch and Jungfrau.',
    category: 'hiking', difficulty: 'medium', duration: '3–4 h', lat: 46.6232, lng: 7.9412,
  },
  {
    id: 'a5', season: 'summer',
    title: 'Lauterbrunnen Waterfalls',
    description: 'Valley of 72 waterfalls including the famous Staubbach Falls.',
    category: 'hiking', difficulty: 'easy', duration: '1–2 h', lat: 46.5938, lng: 7.9077,
  },
  {
    id: 'a7', season: 'summer',
    title: 'Harder Kulm Hike',
    description: 'Hike up from Interlaken to the Two-Lakes View — panorama over Lakes Thun and Brienz.',
    category: 'hiking', difficulty: 'medium', duration: '2–3 h', lat: 46.6891, lng: 7.8627,
  },
  {
    id: 'a8', season: 'summer',
    title: 'Schynige Platte Alpine Garden',
    description: 'Alpine botanical garden at 2,000 m with 700+ native plant species. Open June–October.',
    category: 'sightseeing', duration: '3–4 h', lat: 46.6604, lng: 7.9117,
  },
  {
    id: 'a9', season: 'summer',
    title: 'Canyoning Lütschine',
    description: 'Half-day canyoning adventure through the gorges of the Lütschine river near Interlaken.',
    category: 'adventure', difficulty: 'medium', duration: '3 h', lat: 46.6732, lng: 7.9246,
  },
  {
    id: 'a10', season: 'summer',
    title: 'Grindelwald Glacier Gorge',
    description: 'Walk through the dramatic ice-carved gorge at the foot of the Lower Grindelwald Glacier.',
    category: 'sightseeing', duration: '1–2 h', lat: 46.6167, lng: 8.0417,
  },

  // ── Winter only ─────────────────────────────────────────────────────────────
  {
    id: 'a6', season: 'winter',
    title: 'Mürren Ski Area',
    description: 'Car-free village with access to the Schilthorn. World-class skiing and snowboarding.',
    category: 'skiing', difficulty: 'medium', duration: 'Full day', lat: 46.5588, lng: 7.8929,
  },
  {
    id: 'w1', season: 'winter',
    title: 'Grindelwald-First Ski Area',
    description: '43 km of varied pistes from 2,525 m served by the spectacular gondola from Grindelwald.',
    category: 'skiing', difficulty: 'medium', duration: 'Full day', lat: 46.6600, lng: 8.0560,
  },
  {
    id: 'w2', season: 'winter',
    title: 'Wengen Ski Area',
    description: 'Traditional car-free resort above the Lauterbrunnen valley with 57 km of groomed pistes and panoramic Eiger views.',
    category: 'skiing', difficulty: 'medium', duration: 'Full day', lat: 46.6062, lng: 7.9324,
  },
  {
    id: 'w3', season: 'winter',
    title: 'Schilthorn / Piz Gloria',
    description: '360° panorama at 2,970 m, famous as a James Bond filming location. Reached by cable car from Mürren.',
    category: 'sightseeing', duration: '3–4 h', lat: 46.5584, lng: 7.8316,
  },
  {
    id: 'w4', season: 'winter',
    title: 'Snowshoe Tour Mürren',
    description: 'Guided snowshoe tours from Mürren through pristine winter landscapes with views of the Eiger north face.',
    category: 'adventure', difficulty: 'easy', duration: '2–3 h', lat: 46.5620, lng: 7.9000,
  },
  {
    id: 'w5', season: 'winter',
    title: 'First-Bussalp Sledging Run',
    description: '7 km natural sledging run from First (2,168 m) down to Bussalp — one of Switzerland\'s longest and most exhilarating.',
    category: 'adventure', difficulty: 'easy', duration: '2 h', lat: 46.6500, lng: 8.0400,
  },
  {
    id: 'w6', season: 'winter',
    title: 'Lauterbrunnen Winter Walk',
    description: 'A serene winter stroll through the snow-draped valley of 72 waterfalls, with the frozen Staubbach Falls as centrepiece.',
    category: 'hiking', difficulty: 'easy', duration: '1–2 h', lat: 46.5930, lng: 7.9080,
  },
  {
    id: 'w7', season: 'winter',
    title: 'Cross-Country Skiing Interlaken',
    description: '30 km of groomed cross-country trails winding through snow-covered meadows and lakeside forests around Interlaken.',
    category: 'skiing', difficulty: 'easy', duration: '3 h', lat: 46.6870, lng: 7.8540,
  },
  {
    id: 'w8', season: 'winter',
    title: 'Grindelwald Outdoor Ice Rink',
    description: 'Outdoor ice rink in the shadow of the Eiger north face. Hire skates on site and glide under one of the world\'s great mountains.',
    category: 'sightseeing', duration: '1–2 h', lat: 46.6242, lng: 8.0364,
  },
];

export const CATEGORY_COLORS: Record<Activity['category'], string> = {
  hiking:      '#3D7252',
  skiing:      '#2D5396',
  sightseeing: '#C4950E',
  adventure:   '#C5202E',
};

export const CATEGORY_ICONS: Record<Activity['category'], string> = {
  hiking:      '🥾',
  skiing:      '⛷️',
  sightseeing: '🔭',
  adventure:   '🧗',
};
