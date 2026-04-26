export interface Activity {
  id: string;
  title: string;
  description: string;
  category: 'hiking' | 'skiing' | 'sightseeing' | 'adventure';
  difficulty?: 'easy' | 'medium' | 'hard';
  duration: string;
  lat: number;
  lng: number;
}

export const ACTIVITIES: Activity[] = [
  { id: 'a1',  title: 'Jungfraujoch — Top of Europe',   description: "Europe's highest railway station at 3,454 m. Iconic glacier views and the Sphinx Observatory.", category: 'sightseeing', duration: 'Full day', lat: 46.5473, lng: 7.9854 },
  { id: 'a2',  title: 'Grindelwald First Cliff Walk',    description: 'Thrilling suspension bridge and cliff walk with panoramic views over Grindelwald valley.',         category: 'hiking',      difficulty: 'easy',   duration: '2–3 h',    lat: 46.6620, lng: 8.0583 },
  { id: 'a3',  title: 'Männlichen Panorama Hike',        description: 'Classic ridge hike with unobstructed views of the Eiger, Mönch and Jungfrau.',                     category: 'hiking',      difficulty: 'medium', duration: '3–4 h',    lat: 46.6232, lng: 7.9412 },
  { id: 'a4',  title: 'Kleine Scheidegg',                description: 'Mountain pass between Grindelwald and Wengen — gateway to the Jungfraubahn.',                      category: 'sightseeing', duration: '2 h',      lat: 46.5853, lng: 7.9597 },
  { id: 'a5',  title: 'Lauterbrunnen Waterfalls',        description: 'Valley of 72 waterfalls including the famous Staubbach Falls.',                                     category: 'hiking',      difficulty: 'easy',   duration: '1–2 h',    lat: 46.5938, lng: 7.9077 },
  { id: 'a6',  title: 'Mürren Ski Area',                 description: 'Car-free village with access to the Schilthorn. World-class skiing and snowboarding.',              category: 'skiing',      difficulty: 'medium', duration: 'Full day', lat: 46.5588, lng: 7.8929 },
  { id: 'a7',  title: 'Harder Kulm Hike',                description: 'Hike up from Interlaken to the Two-Lakes View — panorama over Lakes Thun and Brienz.',             category: 'hiking',      difficulty: 'medium', duration: '2–3 h',    lat: 46.6891, lng: 7.8627 },
  { id: 'a8',  title: 'Schynige Platte Alpine Garden',   description: 'Alpine botanical garden at 2,000 m with 700+ native plant species.',                               category: 'sightseeing', duration: '3–4 h',    lat: 46.6604, lng: 7.9117 },
  { id: 'a9',  title: 'Canyoning Lütschine',             description: 'Half-day canyoning adventure through the gorges of the Lütschine river near Interlaken.',          category: 'adventure',   difficulty: 'medium', duration: '3 h',      lat: 46.6732, lng: 7.9246 },
  { id: 'a10', title: 'Grindelwald Glacier Gorge',       description: 'Walk through the dramatic ice-carved gorge at the foot of the Lower Grindelwald Glacier.',          category: 'sightseeing', duration: '1–2 h',    lat: 46.6167, lng: 8.0417 },
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
