import { Link, useLocation } from '@tanstack/react-router';
import { cx } from '~/lib/ui';
import { ClientOnly } from '~/components/ui/ClientOnly';

export function LogoMark({ className = '', size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cx('block', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20" />
      <path d="M24 8v16M24 24l6 4" />
      <circle cx="24" cy="24" r="6" strokeWidth="1.2" strokeOpacity="0.6" />
      <path d="M14 34c0-6 8-10 20-10" strokeWidth="1.2" strokeOpacity="0.4" />
    </svg>
  );
}

const NAV_LINKS = [
  { to: '/', label: 'Canvas' },
  { to: '/chart', label: 'Chart' },
  { to: '/canvas', label: 'Wheel' },
  { to: '/dasha', label: 'Daśā' },
  { to: '/rashifal', label: 'Rashifal' },
  { to: '/sky', label: 'Sky' },
  { to: '/match', label: 'Match' },
  { to: '/atlas', label: 'Atlas' },
  { to: '/profiles', label: 'Profiles' },
] as const;

export function Nav() {
  const location = useLocation();
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 px-4 md:px-8 py-3" role="navigation" aria-label="Main navigation">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Nakshatra Canvas home">
          <LogoMark size={28} className="text-gold" />
          <span className="hidden sm:block display text-xl tracking-tight text-bone">Nakshatra Canvas</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 bg-void/60 backdrop-blur rounded-xl border border-gold/20 p-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cx(
                'mono px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-lg transition-all',
                location.pathname === link.to
                  ? 'bg-gold/15 text-gold'
                  : 'text-mute hover:text-bone hover:bg-gold/5'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/chart"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold to-gold-deep px-4 py-1.5 font-serif text-sm tracking-wide text-void shadow-lg hover:from-gold-light hover:to-gold transition-all"
          >
            Create Chart
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-gold/10 bg-void/50 backdrop-blur" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 md:px-8 py-8">
        <div className="grid gap-8 md:grid-cols-[1fr_auto_1fr]">
          <div>
            <Link to="/" className="flex items-center gap-2" aria-label="Nakshatra Canvas home">
              <LogoMark size={24} className="text-gold" />
              <span className="display text-lg tracking-tight text-bone">Nakshatra Canvas</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-mute leading-relaxed">
              Your birth chart as a living wallpaper. Vedic precision meets cinematic craft.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="mono text-[10px] uppercase tracking-widest text-mute hover:text-gold transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col items-end gap-2 text-right">
            <p className="mono text-[10px] uppercase tracking-widest text-mute">
              Lāhiri ayanāṃśa · Whole-sign houses · Vimśottarī daśā
            </p>
            <p className="mono text-[10px] text-mute/60">
              Built on Cloudflare Workers · TanStack Start · React 19
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mute hover:text-gold transition-colors"
              aria-label="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mute hover:text-gold transition-colors"
              aria-label="Twitter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 9.24-3.308.52-7.277-8.26-8.502 9.24 3.308-.52 7.277 8.26 8.502-9.24-3.308-.52-7.277 8.26 8.502-9.24-3.308.52L24 2.25z" />
              </svg>
            </a>
          </div>
          <p className="mono text-[10px] uppercase tracking-widest text-mute/60">
            <ClientOnly fallback={<>\u00a9 2026 Nakshatra Canvas</>}>
              {() => <>\u00a9 {new Date().getFullYear()} Nakshatra Canvas</>}
            </ClientOnly>
          </p>
        </div>
      </div>
    </footer>
  );
}
