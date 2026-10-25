import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
  getSession,
  loginAuth,
  logoutAuth,
  registerAuth,
  setPremium,
  type SessionResponse,
} from "~/server/api-auth";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bypassCode, setBypassCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [showBypassPrompt, setShowBypassPrompt] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    setLoading(true);
    try {
      const res = await getSession({ data: {} });
      setSession(res);
    } catch {
      setSession({ loggedIn: false, plan: "free", isPremium: false, quota: { used: 0, limit: 0, remaining: 0, authRequired: true } });
    } finally {
      setLoading(false);
    }
  }

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!validateEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await loginAuth({ data: { email, password } });
      if (res.ok) {
        setSuccess("Signed in successfully.");
        await checkSession();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!validateEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await registerAuth({ data: { email, password } });
      if (res.ok) {
        setSuccess("Account created. You are now signed in.");
        await checkSession();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    clearMessages();
    setLoading(true);
    try {
      await logoutAuth();
      setSession({ loggedIn: false, plan: "free", isPremium: false, quota: { used: 0, limit: 0, remaining: 0, authRequired: true } });
      setSuccess("Signed out.");
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivatePremium() {
    clearMessages();
    if (!bypassCode.trim()) {
      setError("Enter the activation code.");
      return;
    }
    setLoading(true);
    try {
      const res = await setPremium({ data: { code: bypassCode.trim() } });
      if (res.ok) {
        setSuccess("Premium activated.");
        setShowBypassPrompt(false);
        setBypassCode("");
        await checkSession();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !session) {
    return (
      <main className="min-h-dvh bg-[#0b0805] bg-[radial-gradient(120%_80%_at_50%_-10%,#2a1a0d_0%,#0b0805_60%)] text-neutral-100 flex items-center justify-center">
        <div className="animate-pulse text-amber-400">Loading…</div>
      </main>
    );
  }

  const isSignedIn = session?.loggedIn;

  return (
    <main className="min-h-dvh bg-[#0b0805] bg-[radial-gradient(120%_80%_at_50%_-10%,#2a1a0d_0%,#0b0805_60%)] text-neutral-100 flex items-center justify-center px-4 py-12">
      <Link
        to="/"
        className="absolute left-4 top-4 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
      >
        ← Back to generator
      </Link>

      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-amber-500/25 bg-neutral-900/70 backdrop-blur p-8">
          {isSignedIn ? (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-center text-neutral-100">Account</h1>

              <div className="space-y-2 text-center">
                <p className="text-neutral-300">Signed in as</p>
                <p className="text-lg font-mono text-amber-400 break-all">{session?.email}</p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    session?.isPremium
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-neutral-700 text-neutral-400 border border-neutral-600"
                  }`}
                >
                  {session?.isPremium ? "Premium" : "Free"}
                </span>
              </div>

              <div className="border-t border-neutral-800 pt-6 space-y-4">
                <div className="text-center text-sm text-neutral-500">
                  Quota: <span className="text-neutral-300 font-mono">{session?.quota.used}</span> /{" "}
                  <span className="text-neutral-300 font-mono">{session?.quota.limit}</span> used
                </div>
                <div className="text-center text-sm text-neutral-500">
                  Resets:{" "}
                  <span className="text-neutral-300 font-mono">
                    {"—"}
                  </span>
                </div>
              </div>

              {!session?.isPremium && (
                <div className="border-t border-neutral-800 pt-6 space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowBypassPrompt(true)}
                    className="w-full px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors"
                  >
                    Activate Premium
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full px-4 py-3 rounded-2xl border border-neutral-700 bg-neutral-800 text-neutral-300 font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Signing out…" : "Sign out"}
              </button>

              {showBypassPrompt && (
                <div className="border-t border-neutral-800 pt-6 space-y-4 animate-fade-in">
                  <h2 className="text-lg font-semibold text-center">Enter activation code</h2>
                  <input
                    type="text"
                    value={bypassCode}
                    onChange={(e) => setBypassCode(e.target.value)}
                    placeholder="Premium bypass code"
                    className="w-full px-4 py-3 rounded-2xl border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBypassPrompt(false);
                        setBypassCode("");
                        clearMessages();
                      }}
                      className="flex-1 px-4 py-3 rounded-2xl border border-neutral-700 bg-neutral-800 text-neutral-300 font-medium hover:bg-neutral-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleActivatePremium}
                      disabled={loading}
                      className="flex-1 px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      {loading ? "Activating…" : "Activate"}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-center text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3" role="alert">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-center text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3" role="status">
                  {success}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-center text-neutral-100">
                {mode === "signin" ? "Sign in" : "Create account"}
              </h1>

              <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete={mode === "signin" ? "email" : "email"}
                    className="w-full px-4 py-3 rounded-2xl border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    className="w-full px-4 py-3 rounded-2xl border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                    required
                    disabled={loading}
                    minLength={8}
                  />
                </div>

                {mode === "signup" && (
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-300 mb-1">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-4 py-3 rounded-2xl border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                      required
                      disabled={loading}
                    />
                  </div>
                )}

                {error && (
                  <div className="text-center text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Create account")}
                </button>
              </form>

              {success && (
                <div className="text-center text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3" role="status">
                  {success}
                </div>
              )}

              <p className="text-center text-sm text-neutral-500">
                {mode === "signin" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        clearMessages();
                        setEmail("");
                        setPassword("");
                        setConfirmPassword("");
                      }}
                      className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
                    >
                      Create account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        clearMessages();
                        setEmail("");
                        setPassword("");
                        setConfirmPassword("");
                      }}
                      className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-2"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 150ms ease-out; }
      `}</style>
    </main>
  );
}
