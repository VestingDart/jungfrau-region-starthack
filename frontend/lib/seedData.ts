import type { PassResponse, BalanceResponse, TransactionHistoryResponse } from '@/shared/types';

export type BenefitTab = 'active' | 'alwayson' | 'redeemed';

export interface Benefit {
  id: string;
  title: string;
  subtitle: string;
  partner: string;
  color: string;
  once: boolean;
  tab: BenefitTab;
}

export const GUEST = {
  balance: 50.00,
  flag: '🇯🇵',
};

export const TRANSACTIONS: Array<{ id: number; label: string; amount: number; time: string }> = [
  { id: 1, label: 'Lake Thun Cruise', amount: -12.75, time: '23 Apr, 14:32' },
  { id: 2, label: 'BOB Bahn Interlaken–Grindelwald', amount: -8.50, time: '22 Apr, 09:15' },
  { id: 3, label: 'Harder Kulm Mountain Railway', amount: -22.00, time: '21 Apr, 11:40' },
  { id: 4, label: 'Wallet top-up', amount: 100.00, time: '20 Apr, 10:00' },
  { id: 5, label: 'Jungfraujoch Top of Europe', amount: -6.50, time: '19 Apr, 08:25' },
  { id: 6, label: 'Eiger Walk Café', amount: -4.20, time: '18 Apr, 13:10' },
];

export const BENEFITS: Benefit[] = [
  {
    id: 'b1',
    title: 'Harder Kulm Mountain Railway',
    subtitle: '20% discount on the funicular ride to Harder Kulm viewpoint.',
    partner: 'Harder Kulm',
    color: '#E2001A',
    once: true,
    tab: 'active',
  },
  {
    id: 'b2',
    title: 'Jungfraujoch – Top of Europe',
    subtitle: '10% off the Jungfrau Railway to the highest railway station in Europe.',
    partner: 'Jungfrau Railways',
    color: '#1D4ED8',
    once: true,
    tab: 'active',
  },
  {
    id: 'b3',
    title: 'Interlaken Scooter Rental',
    subtitle: '1 hour free e-scooter rental in Interlaken town centre.',
    partner: 'Interlaken Scooter Rental',
    color: '#059669',
    once: true,
    tab: 'active',
  },
  {
    id: 'b4',
    title: 'Regional Public Transport',
    subtitle: 'Unlimited free travel on BOB, SPB, and BLS bus lines in the region.',
    partner: 'BLS AG',
    color: '#7C3AED',
    once: false,
    tab: 'alwayson',
  },
  {
    id: 'b5',
    title: 'Interlaken Open-Air Pool',
    subtitle: 'Free entry to the Interlaken outdoor swimming complex.',
    partner: 'Stadt Interlaken',
    color: '#0EA5E9',
    once: false,
    tab: 'alwayson',
  },
  {
    id: 'b6',
    title: 'Lake Thun Cruise',
    subtitle: '15% discount on BLS Schifffahrt boat tours on Lake Thun.',
    partner: 'BLS Schifffahrt',
    color: '#0369A1',
    once: true,
    tab: 'redeemed',
  },
];

export interface RecentRedemption {
  id: string;
  name: string;
  benefit: string;
  time: string;
}

export const RECENT_REDEMPTIONS: RecentRedemption[] = [
  { id: 'r1', name: 'Anna Tanaka', benefit: '20% Harder Kulm', time: 'vor 3 Min.' },
  { id: 'r2', name: 'Liam O\'Brien', benefit: 'BOB Tagesticket', time: 'vor 8 Min.' },
  { id: 'r3', name: 'Sophie Müller', benefit: 'Welcome Drink', time: 'vor 14 Min.' },
  { id: 'r4', name: 'Marco Silvestri', benefit: 'First Cliff Walk', time: 'vor 22 Min.' },
  { id: 'r5', name: 'Kenji Tanaka', benefit: '10% Jungfraujoch', time: 'vor 31 Min.' },
];

export const PARTNER_WEEK_DATA: Array<{ day: string; count: number }> = [
  { day: 'Mo', count: 34 },
  { day: 'Di', count: 41 },
  { day: 'Mi', count: 28 },
  { day: 'Do', count: 55 },
  { day: 'Fr', count: 62 },
  { day: 'Sa', count: 89 },
  { day: 'So', count: 47 },
];

export const seedData: Record<string, PassResponse> = {
  'demo-anna': {
    pass: {
      id: 'demo-anna',
      guestName: 'Anna Tanaka',
      status: 'active',
      walletBalanceChf: 50.00,
      validUntil: '2026-04-28T00:00:00.000Z',
      sustainabilityPoints: 45,
    },
    benefits: [
      {
        id: 'b1',
        title: 'Harder Kulm Mountain Railway',
        description: '20% discount',
        partnerName: 'Harder Kulm',
        isRedeemable: true,
        redeemableOnce: true,
        redeemedAt: null,
        redemptionToken: 'JR-HK20-7F3A9C',
      },
      {
        id: 'b2',
        title: 'Interlaken Scooter Rental',
        description: '1 hour free',
        partnerName: 'Interlaken Scooter Rental',
        isRedeemable: true,
        redeemableOnce: true,
        redeemedAt: null,
        redemptionToken: 'JR-SC60-B4E2D1',
      },
      {
        id: 'b3',
        title: 'Public Transport Interlaken Region',
        description: 'Free',
        partnerName: 'BLS AG',
        isRedeemable: true,
        redeemableOnce: false,
        redeemedAt: null,
        redemptionToken: 'JR-PT00-A1C5E8',
      },
      {
        id: 'b4',
        title: 'Lake Thun Cruise',
        description: '15% discount',
        partnerName: 'BLS Schifffahrt',
        isRedeemable: false,
        redeemableOnce: true,
        redeemedAt: '2026-04-23T14:32:00.000Z',
        redemptionToken: 'JR-LT15-F9A3B7',
      },
      {
        id: 'b5',
        title: 'Jungfraujoch Top of Europe',
        description: '10% discount',
        partnerName: 'Jungfrau Railways',
        isRedeemable: true,
        redeemableOnce: true,
        redeemedAt: null,
        redemptionToken: 'JR-JJ10-D6E8F2',
      },
    ],
  },
};

export function getPassById(id: string): PassResponse | null {
  return seedData[id] ?? null;
}

export function getSimulatedBalance(id: string): BalanceResponse | null {
  const entry = seedData[id];
  if (!entry) return null;
  return {
    balanceChf: entry.pass.walletBalanceChf,
    recentTransaction: {
      description: 'Wallet top-up',
      amountChf: 100.00,
      at: '2026-04-20T10:00:00.000Z',
    },
  };
}

export function getTransactionHistory(id: string): TransactionHistoryResponse | null {
  const entry = seedData[id];
  if (!entry) return null;
  return {
    transactions: TRANSACTIONS.map((tx) => ({
      id: String(tx.id),
      type: (tx.amount > 0 ? 'deposit' : 'redemption') as 'deposit' | 'redemption',
      description: tx.label,
      amountChf: tx.amount,
      at: tx.time,
    })),
  };
}
