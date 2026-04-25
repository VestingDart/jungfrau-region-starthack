import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Mountain, ShieldCheck, Snowflake } from "lucide-react";
import AlpineBackground from "./AlpineBackground";

type LayoutProps = {
  children: ReactNode;
  area?: "Guest Wallet" | "Partner Console" | "Admin Dashboard" | "Welcome";
  nav?: Array<{ href: string; label: string }>;
};

export default function Layout({ children, area = "Welcome", nav = [] }: LayoutProps) {
  return (
    <>
      <AlpineBackground />
      <div className="mx-auto min-h-screen w-full max-w-[1460px] p-0 sm:p-5">
        <div className="min-h-[calc(100vh-40px)] overflow-hidden border border-white/60 bg-white/35 shadow-[0_25px_80px_rgba(20,55,82,.16)] backdrop-blur-xl sm:rounded-[28px]">
          <header className="flex flex-col gap-4 border-b border-white/50 bg-white/35 px-5 py-4 backdrop-blur-xl lg:h-20 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-center gap-3 font-black uppercase tracking-[.2em] text-slate-800">
              <Mountain className="h-10 w-10 text-alpine" strokeWidth={1.8} />
              <span className="grid h-7 w-7 place-items-center rounded-md bg-swiss text-sm font-black text-white">+</span>
              <span>Jungfrau Pass</span>
            </div>
            {nav.length > 0 && (
              <nav className="flex flex-wrap gap-2" aria-label={`${area} navigation`}>
                {nav.map((item) => (
                  <a key={item.href} className="rounded-full bg-white/45 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-white/75 hover:text-slate-900" href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/55 px-3 py-2 font-bold shadow-soft">
                <Snowflake className="h-4 w-4 text-alpine" /> 12 C Grindelwald
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/55 px-3 py-2 font-bold shadow-soft">
                <ShieldCheck className="h-4 w-4 text-pine" /> {area}
              </span>
            </div>
          </header>
          <motion.main
            className="px-4 py-6 sm:px-8"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {children}
          </motion.main>
        </div>
      </div>
    </>
  );
}
