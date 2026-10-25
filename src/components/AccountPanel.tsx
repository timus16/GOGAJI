import { useEffect, useState } from "react";
import { getSession, logoutAuth, setPremium } from "~/server/api-auth";
import type { SessionResponse, SetPremiumResponse } from "~/server/api-auth";

export interface AccountPanelProps {
  deviceId: string;
}

export default function AccountPanel({ deviceId }: AccountPanelProps) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeCode, setUpgradeCode] = useState("");
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getSession({ data: { deviceId } })
      .then((res) => {
        if (mounted) {
          setSession(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [deviceId]);

  const handleLogout = async () => {
    setError(null);
    try {
      await logoutAuth();
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUpgrade = async () => {
    setUpgradeError(null);
    setUpgrading(true);
    try {
      const res = await setPremium({ data: { code: upgradeCode.trim() } }) as SetPremiumResponse;
      if (res.ok) {
        setShowUpgradePrompt(false);
        setUpgradeCode("");
        const fresh = await getSession({ data: { deviceId } });
        setSession(fresh);
      } else {
        setUpgradeError(res.error);
      }
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-neutral-900/70 px-3 py-1.5">
        <svg className="h-4 w-4 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
        </svg>
        <span className="text-xs text-neutral-400">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">
        {error}
      </div>
    );
  }

  if (!session?.loggedIn) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-neutral-900/70 px-3 py-1.5">
        <a href="/account" className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-400/60 hover:text-amber-200">
          Sign in
        </a>
        <a href="/account?mode=signup" className="rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-3 py-1.5 font-medium text-xs text-neutral-900 hover:from-amber-200 hover:to-amber-400">
          Create account
        </a>
      </div>
    );
  }

  const planBadge = session.isPremium
    ? <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">Premium active</span>
    : <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">Free</span>;

  const quotaText = session.quota
    ? `${session.quota.used} of ${session.quota.limit} used today`
    : "Quota unavailable";

  if (showUpgradePrompt) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-neutral-900/70 px-3 py-1.5">
        <input
          type="password"
          placeholder="Enter activation code"
          value={upgradeCode}
          onChange={(e) => setUpgradeCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUpgrade()}
          className="w-40 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:border-amber-400/60"
          autoFocus
        />
        <button
          onClick={handleUpgrade}
          disabled={upgrading || !upgradeCode.trim()}
          className="rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-3 py-1.5 font-medium text-xs text-neutral-900 hover:from-amber-200 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {upgrading ? "…" : "Activate"}
        </button>
        <button
          onClick={() => { setShowUpgradePrompt(false); setUpgradeCode(""); setUpgradeError(null); }}
          className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-neutral-400 hover:border-amber-400/60 hover:text-amber-200"
        >
          Cancel
        </button>
        {upgradeError && <span className="text-xs text-red-300">{upgradeError}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-neutral-900/70 px-3 py-1.5 text-neutral-100">
      <span className="text-xs text-neutral-400">{session.email}</span>
      {planBadge}
      <span className="text-[10px] text-neutral-500">{quotaText}</span>
      {!session.isPremium && (
        <button
          onClick={() => { setShowUpgradePrompt(true); setUpgradeError(null); }}
          className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs uppercase tracking-wider text-amber-200 hover:bg-amber-400/10"
        >
          Activate Premium
        </button>
      )}
      <button
        onClick={handleLogout}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-400/60 hover:text-amber-200"
      >
        Sign out
      </button>
    </div>
  );
}
