import { Building2, LayoutDashboard, WalletCards } from "lucide-react";
import Layout from "../components/Layout";
import RoleCard from "../components/RoleCard";

export default function WelcomePage() {
  return (
    <Layout area="Welcome">
      <section className="grid min-h-[calc(100vh-140px)] content-center gap-10 py-8">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[.28em] text-slate-500">Digital tourism wallet</div>
          <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-950 sm:text-7xl">Jungfrau Pass</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            A premium wallet for guest benefits, partner redemptions, and Swiss settlement workflows across the Jungfrau Region.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <RoleCard to="/guest" title="Guest Wallet" text="Manage a stay pass, top up balance, unlock bundled benefits, and generate live QR codes." icon={<WalletCards />} />
          <RoleCard to="/partner" title="Partner Console" text="Redeem QR tokens, view pending payouts, and refund eligible transactions." icon={<Building2 />} />
          <RoleCard to="/admin" title="Admin Dashboard" text="Run settlement batches, inspect pain.001 XML, and confirm payouts." icon={<LayoutDashboard />} />
        </div>
      </section>
    </Layout>
  );
}
