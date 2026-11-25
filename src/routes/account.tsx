import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "~/lib/api-client";
import type { SessionResponse } from "~/server/api-auth";
import { useToast } from "~/components/ui/Toast";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { toast, dismissAll } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bypassCode, setBypassCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [showBypassPrompt, setShowBypassPrompt] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    setLoading(true);
    try {
      const res = await api.post("/api/auth/session", {});
      const sessionData = await res.json();
      setSession(sessionData);
    } catch {
      setSession({ loggedIn: false, plan: "free", isPremium: false, quota: { used: 0, limit: 0, remaining: 0, authRequired: true } });
    } finally {
      setLoading(false);
    }
  }

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function clearForm() {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setBypassCode("");
    dismissAll();
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    dismissAll();
    if (!validateEmail(email)) { toast.error("Invalid email", "Enter a valid email address."); return; }
    if (password.length < 8) { toast.error("Weak password", "Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const result = await res.json();
      if (result.ok) {
        toast.success("Welcome back", "Signed in successfully.");
        await checkSession();
      } else {
        toast.error("Sign in failed", result.error);
      }
    } catch {
      toast.error("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    dismissAll();
    if (!validateEmail(email)) { toast.error("Invalid email", "Enter a valid email address."); return; }
    if (password.length < 8) { toast.error("Weak password", "Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { toast.error("Passwords don't match", "Please enter the same password twice."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register", { email, password });
      const result = await res.json();
      if (result.ok) {
        toast.success("Account created", "You are now signed in.");
        await checkSession();
      } else {
        toast.error("Registration failed", result.error);
      }
    } catch {
      toast.error("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    dismissAll();
    setLoading(true);
    try {
      await api.post("/api/auth/logout", {});
      setSession({ loggedIn: false, plan: "free", isPremium: false, quota: { used: 0, limit: 0, remaining: 0, authRequired: true } });
      toast.success("Signed out", "See you next time!");
    } catch {
      toast.error("Error", "Could not sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivatePremium() {
    dismissAll();
    if (!bypassCode.trim()) { toast.error("Missing code", "Enter the activation code."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/premium", { code: bypassCode.trim() });
      const result = await res.json();
      if (result.ok) {
        toast.success("Premium activated", "Welcome to the premium tier!");
        setShowBypassPrompt(false);
        setBypassCode("");
        await checkSession();
      } else {
        toast.error("Activation failed", result.error);
      }
    } catch {
      toast.error("Error", "Something went wrong. Please try again.");
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
                        dismissAll();
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  {loading ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Create account")}
                </button>
              </form>

              <p className="text-center text-sm text-neutral-500">
                {mode === "signin" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        clearForm();
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
                        clearForm();
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