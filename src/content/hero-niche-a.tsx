import { useState } from "react";

/**
 * Niche A: Conscious Parent
 *
 * Hero section optimized for parents seeking meaningful, personalized decor
 * for their child's room that connects to their child's unique astrological
 * identity.
 */
export default function HeroNicheA() {
  const [childName, setChildName] = useState("");

  return (
    <section className="min-h-[560px] bg-gradient-to-br from-[#F6F1E8] via-[#FBF7EF] to-[#F6F1E8] relative overflow-hidden">
      {/* Warm texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='1' /%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6 relative z-10">
        {/* Eyebrow pill */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F0E3D0] border border-[#E2D9C8]">
            <span className="text-[#C8853F] text-xs font-semibold">Now in public beta</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Copy */}
          <div className="space-y-4">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2421] leading-[1.1] tracking-tight">
              Your child's{" "}
              <em className="text-[#C8853F] not-italic">nakshatra</em>,<br />
              as consecrated art
            </h1>

            <p className="text-base sm:text-lg text-[#8A8A80] leading-relaxed max-w-xl">
              A personalized Vedic wallpaper that honors your child's birth star,
              planetary yantra, and naming syllable — designed to hang in their
              room as a daily reminder of their unique path.
            </p>

            {/* Obstacle bullets */}
            <ul className="space-y-2 text-[#1F2421] text-sm sm:text-base">
              {[
                "Generic posters don't reflect who they really are",
                "Mass-market astrology feels shallow and exploitative",
                "You want something rooted in tradition, not trends",
              ].map((obstacle, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-2 w-1.5 h-1.5 rounded-full bg-[#C8853F] flex-shrink-0" />
                  <span className="text-base">{obstacle}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="Your child's name"
                  aria-label="Your child's name"
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-[#E2D9C8] bg-white text-[#1F2421] placeholder:text-[#8A8A80] focus:border-[#C8853F] focus:outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (childName.trim()) {
                      window.location.href = `/?name=${encodeURIComponent(childName.trim())}&for=child`;
                    }
                  }}
                  disabled={!childName.trim()}
                  className="px-6 py-3 rounded-lg bg-[#C8853F] text-white font-bold hover:bg-[#A86B2C] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  Create {childName.trim() ? `${childName.trim()}'s` : ""} wallpaper
                </button>
              </div>
              <p className="text-xs text-[#8A8A80]">
                Next: your child's birth date, time and place — the chart and the artwork are drawn from them.
                Free · Takes 2 minutes · Birth time required for accuracy
              </p>
            </div>
          </div>

          {/* Right: Browser mockup with sample wallpaper */}
          <div className="relative mx-auto w-full max-w-[300px] lg:max-w-[340px]">
            {/* Floating status chip */}
            <div className="absolute -top-5 right-2 z-20 px-3 py-1.5 rounded-full bg-white border-2 border-[#E2D9C8] shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#C8853F] animate-pulse" />
                <span className="text-xs font-semibold text-[#1F2421]">
                  Personalized • Rooted in tradition
                </span>
              </div>
            </div>

            {/* Faux browser window */}
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2D9C8]">
              {/* Browser chrome */}
              <div className="bg-[#2A2723] px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                  <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                  <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                </div>
              </div>

              {/* Sample wallpaper preview */}
              <div className="aspect-[3/4] bg-gradient-to-br from-[#1a1612] via-[#2d2419] to-[#1a1612] relative p-8">
                {/* Simplified yantra visualization */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <div className="w-64 h-64 border-2 border-[#C8853F] rounded-lg transform rotate-45">
                    <div className="absolute inset-4 border-2 border-[#C8853F] rounded-lg" />
                    <div className="absolute inset-8 border-2 border-[#C8853F] rounded-lg" />
                  </div>
                </div>

                {/* Sample text content */}
                <div className="relative z-10 h-full flex flex-col justify-between text-[#F6F1E8]">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[#C8853F] mb-2">
                      Nakshatra
                    </div>
                    <div className="text-4xl font-serif font-bold mb-1">Rohiṇī</div>
                    <div className="text-lg text-[#8A8A80]">रोहिणी • Moon</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wider text-[#C8853F]">
                      Naming syllable
                    </div>
                    <div className="text-3xl font-serif">वा • Vā</div>
                  </div>

                  <div className="text-xs text-[#8A8A80]">
                    Born under the star of growth and abundance
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social proof / trust indicators */}
        <div className="mt-6 pt-4 border-t border-[#E2D9C8]">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { label: "Deterministic chart engine", detail: "Not AI guesswork" },
              { label: "Classical Vedic sources", detail: "Peer-reviewed accuracy" },
              { label: "Privacy-first", detail: "No data sold or shared" },
            ].map((item, i) => (
              <div key={i}>
                <div className="text-lg font-bold text-[#1F2421] mb-0.5">{item.label}</div>
                <div className="text-xs text-[#8A8A80]">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
