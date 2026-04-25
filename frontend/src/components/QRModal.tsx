import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import Button from "./Button";

export default function QRModal({ token, title, ttl, onClose }: { token: string | null; title: string; ttl: number; onClose: () => void }) {
  const [seconds, setSeconds] = useState(ttl);
  const [image, setImage] = useState("");
  const open = Boolean(token);

  useEffect(() => {
    if (!token) return;
    setSeconds(ttl);
    QRCode.toDataURL(token, { width: 280, margin: 2, color: { dark: "#0f3a5b", light: "#ffffff" } }).then(setImage);
  }, [token, ttl]);

  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(id);
          onClose();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [token, onClose]);

  const shortToken = useMemo(() => token ?? "", [token]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="w-full max-w-md rounded-3xl border border-white/70 bg-white/85 p-6 text-center shadow-[0_30px_90px_rgba(4,18,30,.35)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Show to partner</div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">Expires in <span className="font-black text-swiss">{seconds}s</span></p>
            {image && <img className="mx-auto my-5 rounded-2xl border-[10px] border-white shadow-soft" src={image} alt="Redemption QR code" />}
            <div className="max-h-24 overflow-auto rounded-xl bg-white/70 p-3 text-left font-mono text-[11px] text-slate-500">{shortToken}</div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button variant="ghost" onClick={() => navigator.clipboard.writeText(shortToken)}>Copy token</Button>
              <Button onClick={onClose}>Close</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
