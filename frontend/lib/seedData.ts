import type { PassResponse, BalanceResponse, Transaction, TransactionHistoryResponse } from '@/shared/types';

const SIMULATED_TRANSACTIONS = [
  { description: 'Restaurant Goldener Anker', amountChf: -24.50 },
  { description: 'Cable car Männlichen', amountChf: -18.00 },
  { description: 'Cashback earned', amountChf: 2.50 },
  { description: 'Lake Brienz cruise', amountChf: -12.00 },
  { description: 'Supermarket Coop Interlaken', amountChf: -8.70 },
  { description: 'Hotel deposit refund', amountChf: 15.00 },
  { description: 'Jungfrau Railways ticket', amountChf: -32.00 },
  { description: 'Sustainability bonus', amountChf: 5.00 },
];

export function getSimulatedBalance(id: string): BalanceResponse | null {
  const data = seedData[id];
  if (!data) return null;

  const INTERVAL_MS = 8000;
  const slot = Math.floor(Date.now() / INTERVAL_MS);
  const txIndex = slot % SIMULATED_TRANSACTIONS.length;

  let balance = data.pass.walletBalanceChf;
  for (let i = 0; i <= txIndex; i++) {
    balance += SIMULATED_TRANSACTIONS[i].amountChf;
  }

  return {
    balanceChf: Math.round(balance * 100) / 100,
    recentTransaction: {
      ...SIMULATED_TRANSACTIONS[txIndex],
      at: new Date(slot * INTERVAL_MS).toISOString(),
    },
  };
}

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

const transactionHistory: Record<string, Transaction[]> = {
  'demo-anna': [
    {
      id: 't1',
      type: 'deposit',
      description: 'Hotel deposit loaded',
      amountChf: 50.00,
      at: '2026-04-20T14:00:00.000Z',
    },
    {
      id: 't2',
      type: 'payment',
      description: 'Dinner at restaurant',
      partnerName: 'Restaurant Goldener Anker',
      amountChf: -24.50,
      at: '2026-04-21T19:15:00.000Z',
    },
    {
      id: 't3',
      type: 'redemption',
      description: '15% discount applied',
      partnerName: 'BLS Schifffahrt',
      offerTitle: 'Lake Thun Cruise',
      amountChf: -12.00,
      at: '2026-04-23T14:32:00.000Z',
    },
    {
      id: 't4',
      type: 'cashback',
      description: 'Sustainability bonus',
      amountChf: 2.50,
      at: '2026-04-24T08:00:00.000Z',
    },
    {
      id: 't5',
      type: 'payment',
      description: 'Cable car ticket',
      partnerName: 'Harder Kulm',
      offerTitle: 'Harder Kulm Mountain Railway',
      amountChf: -18.00,
      at: '2026-04-24T10:45:00.000Z',
    },
    {
      id: 't6',
      type: 'payment',
      description: 'Groceries',
      partnerName: 'Supermarket Coop Interlaken',
      amountChf: -8.70,
      at: '2026-04-25T09:30:00.000Z',
    },
    {
      id: 't7',
      type: 'cashback',
      description: 'BOB train ride bonus',
      amountChf: 1.50,
      at: '2026-04-25T11:00:00.000Z',
    },
  ],
};

export function getTransactionHistory(id: string): TransactionHistoryResponse | null {
  const txs = transactionHistory[id];
  if (!txs) return null;
  return { transactions: [...txs].reverse() };
}
