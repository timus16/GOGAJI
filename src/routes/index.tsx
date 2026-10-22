import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Generator from "~/components/Generator";
import DiscoveryGate, { type DiscoveryAnswers } from "~/components/DiscoveryGate";
import HeroNicheA from "~/content/hero-niche-a";

export const Route = createFileRoute("/")({
  component: Home,
});

const discoveryDone = (): boolean => {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("gogaji.discoveryDone") === "1";
  } catch {
    return true;
  }
};

function Home() {
  const [done, setDone] = useState(discoveryDone);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDone(discoveryDone());
  }, []);

  const completeGate = (answers: DiscoveryAnswers) => {
    try {
      localStorage.setItem("gogaji.discoveryDone", "1");
      localStorage.setItem("gogaji.intent", answers.intent);
      localStorage.setItem("gogaji.previousFailure", answers.previousFailure);
    } catch {}
    setDone(true);
  };

  const skipGate = () => {
    try {
      localStorage.setItem("gogaji.discoveryDone", "1");
    } catch {}
    setDone(true);
  };

  return (
    <main className="min-h-dvh bg-[#0b0805] bg-[radial-gradient(120%_80%_at_50%_-10%,#2a1a0d_0%,#0b0805_60%)] text-neutral-100">
      <HeroNicheA />
      {mounted && !done && <DiscoveryGate onComplete={completeGate} onSkip={skipGate} />}      <div className="pb-10 pt-12">
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
