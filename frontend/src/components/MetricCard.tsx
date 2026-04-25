import { ReactNode } from "react";
import GlassCard from "./GlassCard";

export default function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: ReactNode }) {
  return (
    <GlassCard className="flex items-center justify-between gap-4 p-5">
      <div>
        <div className="text-sm font-bold text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-black tracking-tight text-slate-900">{value}</div>
        {detail && <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div>}
      </div>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100 text-alpine">{icon}</div>
    </GlassCard>
  );
}
