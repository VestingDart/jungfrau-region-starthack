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
  { id: 'partner-1', name: 'Harder Kulm Mountain Railway', username: 'harderkulm', password: 'partner123', category: 'mountain_railway', status: 'active', flaskApiKey: 'key-jungfraubahnen' },
  { id: 'partner-2', name: 'Lake Thun Cruise',             username: 'thuncruise',  password: 'partner456', category: 'cruise',           status: 'active', flaskApiKey: 'key-outdoor'        },
  { id: 'partner-3', name: 'BOB Railway',                  username: 'bobrailway',  password: 'partner789', category: 'transport',        status: 'active', flaskApiKey: 'key-skirental'      },
];

export const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };
