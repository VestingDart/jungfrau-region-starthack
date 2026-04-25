import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CreditCard, QrCode, RefreshCw, RotateCw, Sparkles } from "lucide-react";
import { api, Entitlement, Guest, Offer, WalletResponse } from "../api/client";
import Button from "../components/Button";
import GlassCard from "../components/GlassCard";
import Layout from "../components/Layout";
import QRModal from "../components/QRModal";

const demoCards = ["JFR-2026-A0001", "JFR-2026-A0002"];

export default function GuestPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestId, setGuestId] = useState("");
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [topup, setTopup] = useState(200);
  const [message, setMessage] = useState("");
  const [qr, setQr] = useState<{ token: string; title: string; ttl: number } | null>(null);
  const [passFlipped, setPassFlipped] = useState(false);
  const [passQr, setPassQr] = useState("");

  const loadWallet = useCallback(
    async (id = guestId) => {
      if (!id) return;
      setWallet(await api.wallet(id));
    },
    [guestId]
  );

  useEffect(() => {
    async function loadGuests() {
      try {
        const loaded = await Promise.all(demoCards.map((card) => api.checkin(card)));
        const nextGuests = loaded.map((item) => item.guest);
        setGuests(nextGuests);
        setGuestId(nextGuests[0]?.id ?? "");
        if (nextGuests[0]) setWallet(await api.wallet(nextGuests[0].id));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load demo guests");
      }
    }
    loadGuests();
  }, []);

  const activeGuest = useMemo(() => guests.find((guest) => guest.id === guestId), [guests, guestId]);
  const guestName = useMemo(() => {
    const emailName = activeGuest?.email?.split("@")[0] ?? "Jungfrau Guest";
    return emailName.replace(/[._-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }, [activeGuest]);

  useEffect(() => {
    if (!activeGuest) return;
    const payload = JSON.stringify({
      type: "jungfrau-pass",
      guest_id: activeGuest.id,
      guest_card_id: activeGuest.guest_card_id,
      name: guestName
    });
    QRCode.toDataURL(payload, {
      width: 220,
      margin: 2,
      color: { dark: "#0f3a5b", light: "#ffffff" }
    }).then(setPassQr);
  }, [activeGuest, guestName]);

  async function topupWallet() {
    try {
      const result = await api.topup(guestId, topup);
      window.open(result.checkout_url, "_blank", "width=520,height=460");
      setMessage("Complete payment in the popup, then refresh the wallet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Top-up failed");
    }
  }

  async function generateQr(item: Entitlement | Offer, type: "entitlement" | "offer") {
    try {
      const result = await api.qr(type === "entitlement" ? { guest_id: guestId, entitlement_id: item.id } : { guest_id: guestId, offer_id: item.id });
      setQr({ token: result.qr_token, ttl: result.expires_in_seconds, title: item.title });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR generation failed");
    }
  }

  return (
    <Layout area="Guest Wallet" nav={[{ href: "#wallet", label: "Wallet" }, { href: "#entitlements", label: "Entitlements" }, { href: "#offers", label: "Offers" }, { href: "#activity", label: "Activity" }]}>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div id="wallet" className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_380px]">
            <GlassCard className="relative overflow-hidden p-7">
              <div className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Wallet balance</div>
              <div className="mt-4 text-5xl font-black tracking-tight text-slate-950">CHF {wallet?.balance_chf.toFixed(2) ?? "0.00"}</div>
              <div className="mt-6 flex flex-wrap gap-3">
                <input className="input max-w-36" type="number" value={topup} min={10} step={10} onChange={(event) => setTopup(Number(event.target.value))} />
                <Button onClick={topupWallet} variant="primary"><CreditCard className="h-4 w-4" /> Top up</Button>
                <Button onClick={() => loadWallet()} variant="ghost"><RefreshCw className="h-4 w-4" /> Refresh</Button>
              </div>
              {message && <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p>}
            </GlassCard>

            <GlassCard className="p-6">
              <div className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Active pass</div>
              <select className="input mt-4" value={guestId} onChange={(event) => { setGuestId(event.target.value); setPassFlipped(false); loadWallet(event.target.value); }}>
                {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.guest_card_id} ({guest.email ?? "guest"})</option>)}
              </select>
              <div className="mt-4 rounded-2xl bg-white/60 p-4 text-sm text-slate-600">
                <strong className="block text-slate-900">{activeGuest?.guest_card_id ?? "Loading pass"}</strong>
                Valid {activeGuest?.check_in} to {activeGuest?.check_out}
              </div>
            </GlassCard>
          </div>

          <section id="entitlements">
            <h2 className="section-title">Your entitlements</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {wallet?.entitlements.map((item) => (
                <GlassCard key={item.id} className="grid grid-cols-[48px_1fr_auto] items-center gap-4 p-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100 text-alpine"><Sparkles /></div>
                  <div><div className="font-black text-slate-900">{item.title}</div><div className="text-sm text-slate-500">{item.partner_name}</div></div>
                  <Button onClick={() => generateQr(item, "entitlement")} className="px-3">Use</Button>
                </GlassCard>
              ))}
            </div>
          </section>

          <section id="offers">
            <h2 className="section-title">Available offers</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {wallet?.available_priced_offers.map((offer) => {
                const price = offer.partner_payout_rappen / 100;
                return (
                  <GlassCard key={offer.id} className="overflow-hidden">
                    <div className="h-24 bg-[linear-gradient(135deg,#dceff8,#6f9fba_55%,#f8fcff)]" />
                    <div className="p-4">
                      <div className="font-black text-slate-900">{offer.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{offer.partner_name}</div>
                      <div className="mt-4 flex items-center justify-between">
                        <strong>CHF {price.toFixed(2)}</strong>
                        <Button disabled={(wallet?.balance_chf ?? 0) < price} onClick={() => generateQr(offer, "offer")} variant="ghost">QR</Button>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </section>

          <section id="activity">
            <h2 className="section-title">Recent activity</h2>
            <GlassCard className="overflow-hidden">
              {wallet?.recent_transactions.length ? wallet.recent_transactions.map((tx) => (
                <div key={tx.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200/60 p-4 last:border-b-0">
                  <div><div className="font-black capitalize text-slate-900">{tx.type.replace("_", " ")}</div><div className="text-sm text-slate-500">{new Date(tx.created_at).toLocaleString("en-CH")}</div></div>
                  <strong className={tx.amount_rappen >= 0 ? "text-pine" : "text-red-700"}>{tx.amount_rappen >= 0 ? "+" : "-"}CHF {Math.abs(tx.amount_rappen / 100).toFixed(2)}</strong>
                </div>
              )) : <div className="p-6 text-center text-slate-500">No activity yet</div>}
            </GlassCard>
          </section>
        </section>

        <aside className="xl:sticky xl:top-6">
          <GlassCard className="p-5">
            <div className="pass-scene">
              <button className={`pass-flipper ${passFlipped ? "is-flipped" : ""}`} onClick={() => setPassFlipped((current) => !current)} type="button" aria-label="Flip Jungfrau Pass">
                <div className="pass-face pass-front">
                  <div className="pass-mountains" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-5 text-left text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[.24em] text-white/55">Jungfrau Pass</div>
                        <div className="mt-1 text-xs font-bold text-white/70">Digital Guest Wallet</div>
                      </div>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-swiss text-base font-black shadow-lg">+</span>
                    </div>
                    <div>
                      <div className="text-2xl font-black leading-none tracking-tight">{guestName}</div>
                      <div className="mt-2 font-mono text-xs font-bold uppercase tracking-[.16em] text-white/55">{activeGuest?.guest_card_id ?? "JFR-2026"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                        <div className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Guest ID</div>
                        <div className="mt-1 truncate font-mono text-xs font-bold text-white/85">{activeGuest?.id ?? "Loading"}</div>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
                        <div className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Balance</div>
                        <div className="mt-1 text-lg font-black">CHF {wallet?.balance_chf.toFixed(2) ?? "0.00"}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pass-face pass-back">
                  <div className="pass-back-stripe" />
                  <div className="relative z-10 flex h-full items-center justify-between gap-4 p-5 text-left">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[.2em] text-slate-500">Pass identity QR</div>
                      <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{guestName}</div>
                      <div className="mt-2 max-w-[150px] truncate font-mono text-xs font-bold text-slate-600">{activeGuest?.guest_card_id ?? "JFR-2026"}</div>
                      <div className="mt-5 h-8 rounded-lg bg-slate-900/90" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-soft">
                      {passQr ? <img className="h-28 w-28" src={passQr} alt="Guest pass QR code" /> : <QrCode className="h-28 w-28 text-alpine" />}
                    </div>
                  </div>
                </div>
              </button>
            </div>
            <Button className="mt-5 w-full" variant="ghost" onClick={() => setPassFlipped((current) => !current)}>
              <RotateCw className="h-4 w-4" /> {passFlipped ? "Show pass front" : "Show QR back"}
            </Button>
            <div className="mt-4 rounded-2xl bg-white/60 p-4 text-center text-sm text-slate-500">
              Tap the pass to turn it. Benefit and offer QR codes are generated from the lists on the left.
            </div>
          </GlassCard>
        </aside>
      </div>
      <QRModal token={qr?.token ?? null} ttl={qr?.ttl ?? 60} title={qr?.title ?? "Redemption QR"} onClose={() => { setQr(null); loadWallet(); }} />
    </Layout>
  );
}
