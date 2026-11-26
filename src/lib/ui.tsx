import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/* ---------- className utility ---------- */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------- Scroll Reveal (agon-agent) ---------- */
export function Reveal({
  children,
  delay = 0,
  y = 30,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Cinematic Chapter Heading (agon-agent) ---------- */
export function Chapter({
  index,
  title,
  sub,
  accent = 'text-gold',
}: {
  index: string;
  title: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="mb-8 md:mb-12">
      <div className="flex items-center gap-4 md:gap-6">
        <span className={cx('mono text-[10px] md:text-xs tracking-cinema', accent)}>{index}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-gold/40 via-gold/10 to-transparent" />
      </div>
      <h2 className="display mt-4 text-2xl sm:text-3xl md:text-5xl font-semibold uppercase">
        {title}
      </h2>
      {sub && <p className="mt-3 max-w-2xl text-sm md:text-base text-mute leading-relaxed">{sub}</p>}
    </div>
  );
}

/* ---------- Data Readout (agon-agent) ---------- */
export function Readout({
  label,
  value,
  hint,
  tone = 'gold',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'gold' | 'steel' | 'crimson' | 'violet' | 'jade' | 'rust' | 'mute';
}) {
  const toneMap: Record<string, string> = {
    gold: 'text-gold',
    steel: 'text-steel',
    crimson: 'text-crimson',
    violet: 'text-violet',
    jade: 'text-jade',
    rust: 'text-rust',
    mute: 'text-mute',
  };
  return (
    <div className="hair-b border-b py-3 md:py-4">
      <div className="mono text-[9px] md:text-[10px] uppercase tracking-[0.28em] text-mute">{label}</div>
      <div className={cx('mt-1.5 display text-base md:text-xl', toneMap[tone])}>{value}</div>
      {hint && <div className="mt-1 text-[11px] md:text-xs text-mute/80 leading-relaxed">{hint}</div>}
    </div>
  );
}

/* ---------- Eyebrow Tag (agon-agent) ---------- */
export function Tag({
  children,
  tone = 'gold',
}: {
  children: ReactNode;
  tone?: 'gold' | 'steel' | 'crimson' | 'violet' | 'mute' | 'jade' | 'rust';
}) {
  const map: Record<string, string> = {
    gold: 'border-gold/40 text-gold',
    steel: 'border-steel/40 text-steel',
    crimson: 'border-crimson/50 text-crimson',
    violet: 'border-violet/40 text-violet',
    jade: 'border-jade/40 text-jade',
    rust: 'border-rust/40 text-rust',
    mute: 'border-mute/30 text-mute',
  };
  return (
    <span
      className={cx(
        'mono inline-flex items-center gap-1.5 border px-2.5 py-1 text-[9px] md:text-[10px] uppercase tracking-[0.22em]',
        map[tone]
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Decorative Divider (agon-agent) ---------- */
export function Divider({ className = '' }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-3 py-6', className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/25 to-gold/25" />
      <span className="text-gold/60 text-[10px]">✦</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/25 to-gold/25" />
    </div>
  );
}

/* ---------- Percentage helper ---------- */
export function pct(n: number): string {
  return `${Math.round(n)}%`;
}