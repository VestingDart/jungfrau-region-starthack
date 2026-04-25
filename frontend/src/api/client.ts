export type ApiOptions = RequestInit & {
  body?: BodyInit | Record<string, unknown> | null;
  apiKey?: string;
  adminKey?: string;
  idempotencyKey?: string;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.apiKey) headers.set("X-API-Key", options.apiKey);
  if (options.adminKey) headers.set("X-Admin-Key", options.adminKey);
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);

  const response = await fetch(path, {
    ...options,
    headers,
    body:
      options.body && typeof options.body === "object" && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : (options.body as BodyInit | undefined)
  });

  const text = await response.text();
  const data = text ? safeJson(text) : {};
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data ? String(data.error) : text;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type CheckinResponse = {
  guest: Guest;
  issued_entitlements: Array<{ id: string; offer_title: string }>;
};

export type Guest = {
  id: string;
  guest_card_id: string;
  email?: string;
  booking_ref?: string;
  check_in: string;
  check_out: string;
};

export type Entitlement = {
  id: string;
  title: string;
  description?: string;
  partner_name: string;
  expires_at?: string;
};

export type Offer = {
  id: string;
  title: string;
  description?: string;
  partner_name: string;
  partner_payout_rappen: number;
};

export type WalletTransaction = {
  id: string;
  type: string;
  amount_rappen: number;
  running_balance_rappen: number;
  created_at: string;
};

export type WalletResponse = {
  guest: Guest;
  balance_chf: number;
  entitlements: Entitlement[];
  available_priced_offers: Offer[];
  recent_transactions: WalletTransaction[];
};

export type QrResponse = {
  qr_token: string;
  jti: string;
  expires_in_seconds: number;
};

export type PartnerDashboard = {
  partner: { id: string; name: string };
  pending_chf: number;
  pending_count: number;
  batched_chf: number;
  batched_count: number;
  settled_chf: number;
  settled_count: number;
  recent_redemptions: Redemption[];
};

export type Redemption = {
  id: string;
  offer_title: string;
  type: string;
  amount_rappen: number;
  settlement_status?: string;
  reversed?: number;
  created_at: string;
};

export type RedeemResponse = {
  ok: boolean;
  redemption_id: string;
  offer_title: string;
  amount_chf: number;
  type: string;
  message: string;
};

export type Batch = {
  id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_rappen: number;
  redemption_count: number;
  payment_reference: string;
  pain001_file_path?: string;
  status: string;
  created_at: string;
};

export type SettlementRun = {
  batches: Array<{ batch_id: string; partner_name: string; total_chf: number }>;
  pain001_file: string | null;
  total_chf?: number;
  transfer_count?: number;
  message: string;
};

export const api = {
  checkin: (guest_card_id: string) =>
    request<CheckinResponse>("/api/checkin", {
      method: "POST",
      body: { guest_card_id, check_in: "2026-04-25", check_out: "2026-04-29" }
    }),
  wallet: (guestId: string) => request<WalletResponse>(`/api/wallet/${guestId}`),
  topup: (guestId: string, amount_chf: number) =>
    request<{ checkout_url: string }>(`/api/wallet/${guestId}/topup`, {
      method: "POST",
      idempotencyKey: `topup-${Date.now()}`,
      body: { amount_chf, payment_method: "twint" }
    }),
  qr: (body: { guest_id: string; entitlement_id?: string; offer_id?: string }) =>
    request<QrResponse>("/api/qr/generate", { method: "POST", body }),
  partnerDashboard: (apiKey: string) =>
    request<PartnerDashboard>("/api/partner/dashboard", { apiKey }),
  redeem: (apiKey: string, qr_token: string) =>
    request<RedeemResponse>("/api/redeem", {
      method: "POST",
      apiKey,
      idempotencyKey: `redeem-${Date.now()}-${Math.random()}`,
      body: { qr_token }
    }),
  refund: (apiKey: string, redemption_id: string) =>
    request("/api/partner/refund", {
      method: "POST",
      apiKey,
      idempotencyKey: `refund-${Date.now()}`,
      body: { redemption_id, reason: "manual refund (demo)" }
    }),
  runSettlement: (adminKey: string) =>
    request<SettlementRun>("/api/admin/settlement/run", {
      method: "POST",
      adminKey,
      body: { period_start: "2020-01-01", period_end: "2099-12-31" }
    }),
  batches: (adminKey: string) =>
    request<{ batches: Batch[] }>("/api/admin/settlement/batches", { adminKey }),
  pain001: async (adminKey: string, batchId: string) => {
    const response = await fetch(`/api/admin/settlement/pain001/${batchId}`, {
      headers: { "X-Admin-Key": adminKey }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  },
  confirmSettlement: (adminKey: string, batch_id: string, bank_transaction_ref: string) =>
    request("/api/admin/settlement/confirm", {
      method: "POST",
      adminKey,
      body: { batch_id, bank_transaction_ref }
    }),
  reseed: (adminKey: string) => request("/api/admin/seed", { method: "POST", adminKey })
};
