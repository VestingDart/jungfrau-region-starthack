import type { PassResponse } from '@/shared/types';

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
