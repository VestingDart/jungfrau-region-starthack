export default function StatusPill({ status }: { status: string }) {
  const color =
    status === "confirmed" || status === "settled"
      ? "bg-emerald-100 text-emerald-800"
      : status === "pending" || status === "draft"
        ? "bg-amber-100 text-amber-800"
        : status === "reversed" || status === "failed"
          ? "bg-red-100 text-red-800"
          : "bg-sky-100 text-sky-800";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ${color}`}>{status}</span>;
}
