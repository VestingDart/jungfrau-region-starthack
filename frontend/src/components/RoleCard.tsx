import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function RoleCard({ to, title, text, icon }: { to: string; title: string; text: string; icon: ReactNode }) {
  return (
    <motion.div whileHover={{ y: -8, scale: 1.015 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
      <Link to={to} className="block h-full rounded-2xl border border-white/70 bg-white/65 p-6 text-slate-900 shadow-soft backdrop-blur-xl transition hover:bg-white/80">
        <div className="mb-10 grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-white">{icon}</div>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
        <div className="mt-8 text-sm font-black text-alpine">Enter space</div>
      </Link>
    </motion.div>
  );
}
