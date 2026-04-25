import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileCode2, Play, RefreshCw, Shield, WalletCards } from "lucide-react";
import { api, Batch, SettlementRun } from "../api/client";
import Button from "../components/Button";
import GlassCard from "../components/GlassCard";
import Layout from "../components/Layout";
import MetricCard from "../components/MetricCard";
import StatusPill from "../components/StatusPill";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("admin-dev-key");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [result, setResult] = useState<SettlementRun | null>(null);
  const [xml, setXml] = useState("<pain.001 preview>\nSelect View XML on a settlement batch.\n</pain.001 preview>");
  const [message, setMessage] = useState("");

  const loadBatches = useCallback(async () => {
    try {
      setBatches((await api.batches(adminKey)).batches);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load batches");
    }
  }, [adminKey]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const totals = useMemo(() => {
    const submitted = batches.filter((batch) => batch.status === "submitted" || batch.status === "draft");
    const confirmed = batches.filter((batch) => batch.status === "confirmed");
    return {
      pending: submitted.reduce((sum, batch) => sum + batch.total_rappen, 0) / 100,
      submitted: submitted.length,
      confirmed: confirmed.reduce((sum, batch) => sum + batch.total_rappen, 0) / 100
    };
  }, [batches]);

  async function runSettlement() {
    try {
      const next = await api.runSettlement(adminKey);
      setResult(next);
      setMessage(next.message);
      loadBatches();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settlement failed");
    }
  }

  async function resetDemo() {
    if (!window.confirm("Wipe and reseed all demo data?")) return;
    await api.reseed(adminKey);
    setResult(null);
    setXml("<pain.001 preview>\nDemo data was reset. Run settlement to create a new file.\n</pain.001 preview>");
    loadBatches();
  }

  async function viewXml(batchId: string) {
    try {
      setXml(await api.pain001(adminKey, batchId));
      document.getElementById("xml-preview")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "XML load failed");
    }
  }

  async function confirmBatch(batchId: string) {
    const ref = window.prompt("Enter bank transaction reference:", `SIC-${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 10000)}`);
    if (!ref) return;
    await api.confirmSettlement(adminKey, batchId, ref);
    loadBatches();
  }

  return (
    <Layout area="Admin Dashboard" nav={[{ href: "#overview", label: "Overview" }, { href: "#workflow", label: "Workflow" }, { href: "#xml-preview", label: "XML" }, { href: "#batches", label: "Batches" }]}>
      <div className="space-y-6">
        <section id="overview" className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <GlassCard className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Admin access</div><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Secure settlement console</h1></div>
              <Shield className="h-10 w-10 text-alpine" />
            </div>
            <label className="mt-5 block text-xs font-black uppercase tracking-[.2em] text-slate-500">Admin key</label>
            <input className="input mt-2 font-mono text-sm font-bold" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} />
            {message && <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p>}
          </GlassCard>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Open payout volume" value={`CHF ${totals.pending.toFixed(2)}`} icon={<WalletCards />} />
            <MetricCard label="Submitted batches" value={String(totals.submitted)} icon={<FileCode2 />} />
            <MetricCard label="Confirmed payouts" value={`CHF ${totals.confirmed.toFixed(2)}`} icon={<CheckCircle2 />} />
          </div>
        </section>

        <section id="workflow" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
          <GlassCard className="p-6">
            <h2 className="section-title">Settlement workflow</h2>
            <div className="grid gap-3 rounded-2xl border border-slate-200/70 bg-white/45 p-3 sm:grid-cols-4">
              {["Configure", "Generate", "Review XML", "Confirm paid"].map((step, index) => <div key={step} className="rounded-xl bg-white/65 p-3 text-sm font-black text-slate-700">{index + 1}. {step}</div>)}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={runSettlement}><Play className="h-4 w-4" /> Generate settlement batch</Button>
              <Button variant="ghost" onClick={resetDemo}><RefreshCw className="h-4 w-4" /> Reset demo data</Button>
              <Button variant="ghost" onClick={loadBatches}>Refresh batches</Button>
            </div>
            <div className="mt-5 rounded-2xl bg-white/55 p-4 text-sm text-slate-600">
              {result ? <><strong className="text-slate-900">{result.batches.length} batch(es), CHF {(result.total_chf ?? 0).toFixed(2)} total</strong><div className="mt-1">pain.001 file: {result.pain001_file ?? "none"}</div></> : "Ready to generate bank-ready partner settlement files."}
            </div>
          </GlassCard>

          <GlassCard id="xml-preview" className="p-6">
            <h2 className="section-title">pain.001 XML preview</h2>
            <pre className="max-h-[380px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-cyan-100">{xml}</pre>
            <Button className="mt-4" variant="ghost" onClick={() => navigator.clipboard.writeText(xml)}>Copy XML</Button>
          </GlassCard>
        </section>

        <section id="batches">
          <GlassCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 p-5">
              <div><h2 className="text-xl font-black tracking-tight text-slate-950">Settlement batches</h2><p className="text-sm text-slate-500">Review generated files and mark bank payments as paid.</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="bg-white/40 text-xs uppercase tracking-[.14em] text-slate-500">
                  <tr><th className="p-4">Partner</th><th>Period</th><th>Total</th><th>Redemptions</th><th>Reference</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {batches.length ? batches.map((batch) => (
                    <tr key={batch.id} className="border-t border-slate-200/70">
                      <td className="p-4 font-black text-slate-900">{batch.partner_name}<div className="text-xs font-semibold text-slate-500">{new Date(batch.created_at).toLocaleString("en-CH")}</div></td>
                      <td>{batch.period_start.slice(0, 10)} to {batch.period_end.slice(0, 10)}</td>
                      <td className="font-black">CHF {(batch.total_rappen / 100).toFixed(2)}</td>
                      <td>{batch.redemption_count}</td>
                      <td className="font-mono text-xs text-slate-500">{batch.payment_reference}</td>
                      <td><StatusPill status={batch.status} /></td>
                      <td><div className="flex gap-2">{batch.pain001_file_path && <Button variant="ghost" onClick={() => viewXml(batch.id)}>View XML</Button>}{["submitted", "draft"].includes(batch.status) && <Button variant="green" onClick={() => confirmBatch(batch.id)}>Mark paid</Button>}</div></td>
                    </tr>
                  )) : <tr><td colSpan={7} className="p-6 text-center text-slate-500">No batches yet. Run settlement to create one.</td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </section>
      </div>
    </Layout>
  );
}
