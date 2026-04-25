import { useCallback, useEffect, useState } from "react";
import { Banknote, CheckCircle2, RotateCcw, ScanLine, Send, TimerReset } from "lucide-react";
import { api, PartnerDashboard, RedeemResponse } from "../api/client";
import Button from "../components/Button";
import GlassCard from "../components/GlassCard";
import Layout from "../components/Layout";
import MetricCard from "../components/MetricCard";
import StatusPill from "../components/StatusPill";

const partners = [
  ["key-jungfraubahnen", "Jungfraubahnen"],
  ["key-baeckerei", "Backerei Muller Grindelwald"],
  ["key-outdoor", "Outdoor Interlaken"],
  ["key-skirental", "Wengen Ski Rental"],
  ["key-bergblick", "Restaurant Bergblick Murren"]
];

export default function PartnerPage() {
  const [apiKey, setApiKey] = useState(partners[0][0]);
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [token, setToken] = useState("");
  const [result, setResult] = useState<RedeemResponse | null>(null);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (key = apiKey) => {
    try {
      setDashboard(await api.partnerDashboard(key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard load failed");
    }
  }, [apiKey]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function redeem() {
    if (!token.trim()) {
      setError("Paste a QR token first.");
      return;
    }
    try {
      setError("");
      const approved = await api.redeem(apiKey, token.trim());
      setResult(approved);
      setToken("");
      loadDashboard();
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Redemption failed");
    }
  }

  async function refund(redemptionId: string) {
    try {
      await api.refund(apiKey, redemptionId);
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed");
    }
  }

  return (
    <Layout area="Partner Console" nav={[{ href: "#redeem", label: "Redeem" }, { href: "#payouts", label: "Payouts" }, { href: "#redemptions", label: "Redemptions" }]}>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <GlassCard className="p-6">
              <div className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Partner account</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{dashboard?.partner.name ?? "Jungfrau partner"}</h1>
              <p className="mt-2 text-sm text-slate-600">Verified redemption and payout console for the Jungfrau Pass network.</p>
            </GlassCard>
            <GlassCard className="p-6">
              <label className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Select partner API key</label>
              <select className="input mt-3" value={apiKey} onChange={(event) => { setApiKey(event.target.value); loadDashboard(event.target.value); }}>
                {partners.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
            </GlassCard>
          </div>

          <GlassCard id="redeem" className="p-6">
            <h2 className="section-title">Redeem QR token</h2>
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="scanner-frame">
                <ScanLine className="h-12 w-12 text-white/80" />
                <div className="scan-beam" />
              </div>
              <div>
                <textarea className="input min-h-40 font-mono text-xs" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste the guest wallet JWT token here..." />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={redeem}><Send className="h-4 w-4" /> Redeem</Button>
                  <Button variant="ghost" onClick={() => setToken("")}>Clear</Button>
                </div>
                {result && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>{result.message}</strong><div>Redemption ID: {result.redemption_id}</div></div>}
                {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
              </div>
            </div>
          </GlassCard>

          <section id="payouts">
            <h2 className="section-title">Payout summary</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Pending" value={`CHF ${(dashboard?.pending_chf ?? 0).toFixed(2)}`} detail={`${dashboard?.pending_count ?? 0} transactions`} icon={<TimerReset />} />
              <MetricCard label="Batched" value={`CHF ${(dashboard?.batched_chf ?? 0).toFixed(2)}`} detail={`${dashboard?.batched_count ?? 0} transactions`} icon={<Banknote />} />
              <MetricCard label="Settled" value={`CHF ${(dashboard?.settled_chf ?? 0).toFixed(2)}`} detail={`${dashboard?.settled_count ?? 0} transactions`} icon={<CheckCircle2 />} />
            </div>
          </section>

          <section id="redemptions">
            <h2 className="section-title">Recent redemptions</h2>
            <GlassCard className="overflow-hidden">
              {dashboard?.recent_redemptions.length ? dashboard.recent_redemptions.map((redemption) => {
                const status = redemption.reversed ? "reversed" : redemption.settlement_status ?? "pending";
                return (
                  <div key={redemption.id} className="grid gap-3 border-b border-slate-200/60 p-4 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
                    <div><div className="font-black text-slate-900">{redemption.offer_title}</div><div className="text-sm text-slate-500">{new Date(redemption.created_at).toLocaleString("en-CH")} · {redemption.type}</div></div>
                    <strong>CHF {(redemption.amount_rappen / 100).toFixed(2)}</strong>
                    <div className="flex items-center gap-2">
                      <StatusPill status={status} />
                      {status === "pending" && <Button variant="ghost" onClick={() => refund(redemption.id)}><RotateCcw className="h-4 w-4" /> Refund</Button>}
                    </div>
                  </div>
                );
              }) : <div className="p-6 text-center text-slate-500">No redemptions yet for this partner</div>}
            </GlassCard>
          </section>
        </section>
        <aside className="xl:sticky xl:top-6">
          <GlassCard className="p-6">
            <div className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Last redemption</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{result ? "Approved" : "Waiting for scan"}</h3>
            <p className="mt-2 text-sm text-slate-600">{result?.message ?? "Paste a token from the guest wallet to approve an entitlement or wallet spend."}</p>
          </GlassCard>
        </aside>
      </div>
    </Layout>
  );
}
