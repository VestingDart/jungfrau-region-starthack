export interface GuestSeed {
  id: string;
  passId: string;
  cardId: string;
  inviteCode: string;
  username: string;
  password: string;
  guestName: string;
}

export interface PartnerSeed {
  id: string;
  name: string;
  username: string;
  password: string;
  category: string;
  status: 'active' | 'inactive';
  flaskApiKey: string;
}

export const GUEST_SEED: GuestSeed[] = [
  { id: 'guest-1', passId: 'pass-anna-tokyo',   cardId: 'JFR-2026-A0001', inviteCode: 'JFPASS-A1B2', username: 'anna_tokyo',   password: 'welcome1', guestName: 'Anna Müller'  },
  { id: 'guest-2', passId: 'pass-james-london', cardId: 'JFR-2026-A0002', inviteCode: 'JFPASS-C3D4', username: 'james_ldn',    password: 'welcome2', guestName: 'James Chen'   },
  { id: 'guest-3', passId: 'pass-marie-paris',  cardId: 'JFR-2026-A0001', inviteCode: 'JFPASS-E5F6', username: 'marie_paris',  password: 'welcome3', guestName: 'Marie Dubois' },
  { id: 'guest-4', passId: 'pass-lucas-berlin', cardId: 'JFR-2026-A0002', inviteCode: 'JFPASS-G7H8', username: 'lucas_berlin', password: 'welcome4', guestName: 'Lucas Weber'  },
  { id: 'guest-5', passId: 'pass-yuki-osaka',   cardId: 'JFR-2026-A0001', inviteCode: 'JFPASS-I9J0', username: 'yuki_osaka',   password: 'welcome5', guestName: 'Yuki Tanaka'  },
];

export const PARTNER_SEED: PartnerSeed[] = [
  { id: 'partner-1', name: 'Jungfraubahnen',               username: 'jungfraubahnen', password: 'partner123', category: 'mountain_railway', status: 'active', flaskApiKey: 'key-jungfraubahnen' },
  { id: 'partner-2', name: 'Outdoor Interlaken',           username: 'outdoor',        password: 'partner456', category: 'outdoor',          status: 'active', flaskApiKey: 'key-outdoor'        },
  { id: 'partner-3', name: 'Wengen Ski Rental',            username: 'wengenskirental',password: 'partner789', category: 'ski_rental',       status: 'active', flaskApiKey: 'key-skirental'      },
  { id: 'partner-4', name: 'Bäckerei Müller Grindelwald',  username: 'baeckerei',      password: 'partner321', category: 'food',             status: 'active', flaskApiKey: 'key-baeckerei'      },
  { id: 'partner-5', name: 'Restaurant Bergblick Mürren',  username: 'bergblick',      password: 'partner654', category: 'restaurant',       status: 'active', flaskApiKey: 'key-bergblick'      },
];

export const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };
