export type PassStatus = 'provisioned' | 'active' | 'expired';

export type Pass = {
  id: string;
  guestName: string;
  status: PassStatus;
  walletBalanceChf: number;
  validUntil: string;
  sustainabilityPoints: number;
};

export type Benefit = {
  id: string;
  title: string;
  description: string;
  partnerName: string;
  isRedeemable: boolean;
  redeemableOnce: boolean;
  redeemedAt: string | null;
  redemptionToken: string;
};

export type PassResponse = {
  pass: Pass;
  benefits: Benefit[];
};

export type Transaction = {
  id: string;
  type: 'redemption' | 'deposit' | 'cashback' | 'payment';
  description: string;
  partnerName?: string;
  offerTitle?: string;
  amountChf: number;
  at: string;
};

export type TransactionHistoryResponse = {
  transactions: Transaction[];
};

export type RecentTransaction = {
  description: string;
  amountChf: number;
  at: string;
};

export type BalanceResponse = {
  balanceChf: number;
  recentTransaction: RecentTransaction | null;
};
