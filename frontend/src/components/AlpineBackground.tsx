export default function AlpineBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-glacier">
      <div className="absolute inset-0 scale-105 bg-[url('/images/jungfrau-panorama.jpg')] bg-cover bg-center opacity-95 blur-[6px] saturate-[1.02]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(255,255,255,.78),transparent_26%),linear-gradient(180deg,rgba(238,248,252,.30),rgba(247,251,253,.58)_54%,rgba(247,250,251,.76))]" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/68 via-white/38 to-white/16 backdrop-blur-[1px]" />
      <div className="absolute bottom-[19%] right-0 h-2 w-[34vw] rounded-l-full bg-swiss/65 shadow-[0_0_28px_rgba(220,0,24,.25)]" />
      <div className="absolute bottom-[17.7%] right-0 h-1 w-[30vw] rounded-l-full bg-gold/70" />
    </div>
  );
}
