export type UserRole = 'guest' | 'partner' | 'admin';

// ─── Pass / Benefit (for /pass/[id] route) ────────────────────────────────

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

// ─── Flask wallet types ───────────────────────────────────────────────────

export type FlaskEntitlement = {
  id: string;
  title: string;
  partner_name: string;
  description?: string;
};

export type FlaskPricedOffer = {
  id: string;
  title: string;
  partner_name: string;
  description?: string;
  partner_payout_rappen: number;
};

export type FlaskTransaction = {
  id: string;
  type: string;
  amount_rappen: number;
  created_at: string;
};

export type FlaskWallet = {
  guest_id: string;
  guest_card_id: string;
  balance_chf: number;
  entitlements: FlaskEntitlement[];
  available_priced_offers: FlaskPricedOffer[];
  recent_transactions: FlaskTransaction[];
};

export type FlaskRedemption = {
  id: string;
  offer_title: string;
  amount_rappen: number;
  created_at: string;
  type: string;
  reversed: boolean;
  settlement_status: string | null;
};

export type FlaskDashboard = {
  pending_chf: number;
  pending_count: number;
  batched_chf: number;
  batched_count: number;
  settled_chf: number;
  settled_count: number;
  recent_redemptions: FlaskRedemption[];
};

export type FlaskBatch = {
  id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_rappen: number;
  redemption_count: number;
  payment_reference: string;
  status: 'draft' | 'submitted' | 'confirmed' | 'failed';
  pain001_file_path: string | null;
  created_at: string;
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
