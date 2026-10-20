import type { CSSProperties, ReactElement } from "react";
import type { Reading } from "~/server/ai";

/**
 * Devanagari glyphs need a font that actually carries the conjuncts. The
 * exporter already declares 'Noto Sans Devanagari' through its @font-face
 * rules, so mantra text points at that family explicitly and can never fall
 * back to tofu boxes.
 */
const DEVANAGARI_FONT: CSSProperties = { fontFamily: "'Noto Sans Devanagari', serif" };

export interface AiReadingProps {
  reading: Reading;
}

function row(label: string, value: string): ReactElement {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-200">{value}</dd>
    </div>
  );
}

export default function AiReading({ reading }: AiReadingProps) {
  const primary = reading.primary ?? [];
  const remedies = reading.remedies ?? [];
  const brief = reading.wallpaperBrief;

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------- condition */}
      <section className="rounded-xl border border-amber-500/25 bg-neutral-900/70 p-4">
        <h3 className="text-xs uppercase tracking-widest text-neutral-400">Your condition</h3>
        <p className="mt-1 font-serif text-lg text-amber-200">{reading.condition}</p>

        {primary.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {primary.map((area, i) => (
              <li key={`${area}-${i}`}
                className="rounded-full border border-amber-500/25 bg-black/40 px-3 py-1 text-xs capitalize text-amber-200">
                {area}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------ reading */}
      <section className="rounded-xl border border-amber-500/25 bg-neutral-900/70 p-4">
        <h3 className="text-xs uppercase tracking-widest text-neutral-400">Reading</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-200">{reading.reading}</p>
      </section>

      {/* ----------------------------------------------------------- remedies */}
      <section className="rounded-xl border border-amber-500/25 bg-neutral-900/70 p-4">
        <h3 className="text-xs uppercase tracking-widest text-neutral-400">Remedies</h3>
        {remedies.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-400">No remedies were returned for this chart.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {remedies.map((r, i) => (
              <article key={`${r.title}-${i}`} className="rounded-xl border border-amber-500/25 bg-black/30 p-3">
                <h4 className="font-serif text-base text-amber-200">{r.title}</h4>
                {r.detail && <p className="mt-1 text-xs leading-relaxed text-neutral-400">{r.detail}</p>}

                {r.mantraDevanagari && (
                  <p className="mt-3 font-serif text-xl leading-relaxed text-amber-100" style={DEVANAGARI_FONT}>
                    {r.mantraDevanagari}
                  </p>
                )}
                {r.mantraRoman && <p className="mt-1 text-xs italic text-neutral-400">{r.mantraRoman}</p>}

                <dl className="mt-2 space-y-1 text-xs">
                  {r.deity && row("Deity", r.deity)}
                  {r.day && row("Best day", r.day)}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- affirmation */}
      {reading.affirmation && (
        <blockquote className="rounded-xl border border-amber-500/25 bg-neutral-900/70 p-4">
          <p className="font-serif text-base italic leading-relaxed text-amber-200">&ldquo;{reading.affirmation}&rdquo;</p>
        </blockquote>
      )}

      {/* ----------------------------------------------------- wallpaper brief */}
      {brief && (
        <section className="rounded-xl border border-amber-500/25 bg-neutral-900/70 p-4">
          <h3 className="text-xs uppercase tracking-widest text-neutral-400">Art direction</h3>
          <dl className="mt-2 space-y-1 text-xs">
            {brief.mood && row("Mood", brief.mood)}
            {brief.palette && row("Palette", brief.palette)}
            {brief.motifs && row("Motifs", brief.motifs)}
            {brief.inscription && row("Inscription", brief.inscription)}
          </dl>
        </section>
      )}
    </div>
  );
}