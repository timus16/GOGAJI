import { createFileRoute } from "@tanstack/react-router";
import Generator from "~/components/Generator";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="min-h-dvh bg-[#0b0805] bg-[radial-gradient(120%_80%_at_50%_-10%,#2a1a0d_0%,#0b0805_60%)] text-neutral-100">
      <header className="mx-auto w-full max-w-6xl px-5 pt-14 text-center sm:pt-20">
        <p className="text-[0.7rem] uppercase tracking-[0.45em] text-amber-300/80">Vedic wallpaper studio</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-amber-100 sm:text-6xl">
          Your kundli, drawn as art you can carry
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-neutral-300/90 sm:text-base">
          Give your birth date, time and place. We work out your moon nakshatra and pada, your rising sign,
          your ruling planet — then draw the wallpaper from that: the planet's own yantra grid, your
          nakshatra's symbol and deity, your activation mantra in Devanagari, and the kundli square itself.
          Four styles, phone and desktop downloads, nothing stored.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-400">
          <span className="rounded-full border border-white/15 px-3 py-1">Lāhiri sidereal chart</span>
          <span className="rounded-full border border-white/15 px-3 py-1">Computed in your browser</span>
          <span className="rounded-full border border-white/15 px-3 py-1">No account, no upload</span>
        </div>
      </header>
      <div className="pb-10 pt-12">
        <Generator />
      </div>
      <footer className="mx-auto max-w-6xl px-5 pb-14 text-center text-[0.7rem] leading-relaxed text-neutral-500">
        Wallpapers are an honest derivation of the birth chart: nakshatra, pada, lagna, planetary positions and
        the classical planetary yantra. Vedic content is compiled from standard jyotiṣa references and is
        marked provisional in <code className="text-neutral-400">src/content/vedic-mapping.ts</code>.
      </footer>
    </main>
  );
}
