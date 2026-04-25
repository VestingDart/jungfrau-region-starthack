import { GUEST_SEED, PARTNER_SEED, ADMIN_CREDENTIALS } from './seedData';

export type Role = 'guest' | 'partner' | 'admin';

export interface Session {
  role: Role;
  id: string;
  name: string;
  username: string;
  cardId?: string;
  flaskApiKey?: string;
}

export interface GuestRecord {
  id: string;
  passId: string;
  cardId: string;
  inviteCode: string;
  username: string;
  password: string;
  guestName: string;
  inviteUsed: boolean;
}

export interface PartnerRecord {
  id: string;
  name: string;
  username: string;
  password: string;
  category: string;
  status: 'active' | 'inactive';
  flaskApiKey: string;
}

const KEYS = { SESSION: 'jfr_session', GUESTS: 'jfr_guests', PARTNERS: 'jfr_partners' } as const;

function getGuests(): GuestRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(KEYS.GUESTS);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  const initial: GuestRecord[] = GUEST_SEED.map(g => ({ ...g, inviteUsed: true }));
  localStorage.setItem(KEYS.GUESTS, JSON.stringify(initial));
  return initial;
}

function saveGuests(guests: GuestRecord[]): void {
  localStorage.setItem(KEYS.GUESTS, JSON.stringify(guests));
}

export function getPartners(): PartnerRecord[] {
  if (typeof window === 'undefined') return PARTNER_SEED as PartnerRecord[];
  try {
    const stored = localStorage.getItem(KEYS.PARTNERS);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  localStorage.setItem(KEYS.PARTNERS, JSON.stringify(PARTNER_SEED));
  return PARTNER_SEED as PartnerRecord[];
}

function savePartners(partners: PartnerRecord[]): void {
  localStorage.setItem(KEYS.PARTNERS, JSON.stringify(partners));
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(KEYS.SESSION);
    return stored ? (JSON.parse(stored) as Session) : null;
  } catch { return null; }
}

function saveSession(session: Session): void {
  localStorage.setItem(KEYS.SESSION, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(KEYS.SESSION);
}

export function loginGuest(username: string, password: string): Session | null {
  const guest = getGuests().find(g => g.username === username && g.password === password && g.inviteUsed);
  if (!guest) return null;
  const session: Session = { role: 'guest', id: guest.id, name: guest.guestName, username: guest.username, cardId: guest.cardId };
  saveSession(session);
  return session;
}

export function loginPartner(username: string, password: string): Session | null {
  const partner = getPartners().find(p => p.username === username && p.password === password && p.status === 'active');
  if (!partner) return null;
  const session: Session = { role: 'partner', id: partner.id, name: partner.name, username: partner.username, flaskApiKey: partner.flaskApiKey };
  saveSession(session);
  return session;
}

export function loginAdmin(username: string, password: string): Session | null {
  if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) return null;
  const session: Session = { role: 'admin', id: 'admin', name: 'Administrator', username: 'admin' };
  saveSession(session);
  return session;
}

export function validateInviteCode(code: string): { valid: boolean; alreadyUsed: boolean; guestName?: string } {
  const guest = getGuests().find(g => g.inviteCode === code);
  if (!guest) return { valid: false, alreadyUsed: false };
  if (guest.inviteUsed) return { valid: true, alreadyUsed: true, guestName: guest.guestName };
  return { valid: true, alreadyUsed: false, guestName: guest.guestName };
}

export function registerGuest(inviteCode: string, username: string, password: string): { ok: boolean; error?: string; session?: Session } {
  const guests = getGuests();
  const idx = guests.findIndex(g => g.inviteCode === inviteCode);
  if (idx === -1) return { ok: false, error: 'Invalid invite code. Please check your hotel booking confirmation.' };
  if (guests[idx].inviteUsed) return { ok: false, error: 'This invite code has already been used.' };
  if (guests.some(g => g.username === username)) return { ok: false, error: 'Username already taken. Please choose another.' };
  if (username.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
  if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

  guests[idx] = { ...guests[idx], username, password, inviteUsed: true };
  saveGuests(guests);

  const session: Session = { role: 'guest', id: guests[idx].id, name: guests[idx].guestName, username, cardId: guests[idx].cardId };
  saveSession(session);
  return { ok: true, session };
}

export function addPartner(data: Omit<PartnerRecord, 'id' | 'status'>): PartnerRecord {
  const partners = getPartners();
  const newPartner: PartnerRecord = { ...data, id: `partner-${Date.now()}`, status: 'active' };
  partners.push(newPartner);
  savePartners(partners);
  return newPartner;
}

export function deletePartner(id: string): void {
  savePartners(getPartners().filter(p => p.id !== id));
}
