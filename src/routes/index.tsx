import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Generator from "~/components/Generator";
import HeroNicheA from "~/content/hero-niche-a";

interface LandingParams {
  name: string;
  subject: "self" | "child";
  autoGenerate: boolean;
}

const NO_PARAMS: LandingParams = { name: "", subject: "self", autoGenerate: false };

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [params, setParams] = useState<LandingParams>(NO_PARAMS);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const name = (search.get("name") ?? "").trim();
    const subject = search.get("for") === "child" ? "child" : "self";
    const autoGenerate = search.get("generate") === "1";
    setParams({ name, subject, autoGenerate });
  }, []);

  return (
    <main className="min-h-dvh bg-[#0b0805] bg-[radial-gradient(120%_80%_at_50%_-10%,#2a1a0d_0%,#0b0805_60%)] text-neutral-100">
      <HeroNicheA />
      <div className="pb-10 pt-12">
        <Generator
          initialName={params.name}
          subject={params.subject}
          autoGenerate={params.autoGenerate}
        />
      </div>
      <footer className="mx-auto max-w-6xl px-5 pb-14 text-center text-[0.7rem] leading-relaxed text-neutral-500">
        Wallpapers are an honest derivation of the birth chart: nakshatra, pada, lagna, planetary positions and
        the classical planetary yantra. Vedic content is compiled from standard jyoti?a references and is
        marked provisional in <code className="text-neutral-400">src/content/vedic-mapping.ts</code>.
      </footer>
    </main>
  );
}
