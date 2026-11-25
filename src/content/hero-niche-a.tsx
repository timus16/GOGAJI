import { useState, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronRight, Sparkles, Star, Shield, Heart, Gem, Crown, Zap, Eye, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

gsap.registerPlugin(ScrollTrigger);

interface BirthInput {
  name: string;
  gender: "girl" | "boy";
  date: string;
  time: string;
  place: string;
}

export default function HeroNicheA() {
  const [formData, setFormData] = useState<BirthInput>({
    name: "",
    gender: "girl",
    date: "",
    time: "",
    place: "New Delhi, India",
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{
    nakshatra: string;
    nakshatraDevanagari: string;
    rulingPlanet: string;
    namingSyllable: string;
    namingSyllableDevanagari: string;
  } | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const generatePreview = useCallback(async () => {
    if (!formData.name.trim() || !formData.date || !formData.time || !formData.place.trim()) return;
    
    setPreviewLoading(true);
    setPreviewError(null);
    setHasInteracted(true);
    
    try {
      const response = await fetch("/api/preview/lightweight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          birthDate: formData.date,
          birthTime: formData.time + ":00",
          birthPlace: formData.place.trim(),
          latitude: 28.6139,
          longitude: 77.2090,
          timezone: "Asia/Kolkata",
          presetId: "temple-gold",
          focusAreas: ["all"],
          regionalSystem: "vedic",
          subject: formData.gender,
        })
      });
      
      if (!response.ok) throw new Error("Preview generation failed");
      
      const data = await response.json();
      
      if (data.svg) {
        setPreviewImage(data.svg);
      }
      if (data.chartFacts) {
        setChartData({
          nakshatra: data.chartFacts.nakshatra || "Rohini",
          nakshatraDevanagari: data.chartFacts.nakshatraDevanagari || "रोहिणी",
          rulingPlanet: data.chartFacts.rulingPlanet || "Moon",
          namingSyllable: data.chartFacts.namingSyllable || "Va",
          namingSyllableDevanagari: data.chartFacts.namingSyllableDevanagari || "वा",
        });
      }
    } catch (err) {
      setPreviewError("Could not generate preview. Please try again.");
      console.error(err);
    } finally {
      setPreviewLoading(false);
    }
  }, [formData]);

  // Auto-generate on input change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.name.trim() && formData.date && formData.time && formData.place.trim()) {
        generatePreview();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [formData, generatePreview]);

  // GSAP animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Stagger entrance animation
      gsap.fromTo(".hero-title", 
        { opacity: 0, y: 40 }, 
        { opacity: 1, y: 0, duration: 1, ease: "expo.out" }
      );
      
      gsap.fromTo(".hero-subtitle", 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 0.8, delay: 0.2, ease: "expo.out" }
      );
      
      gsap.fromTo(".hero-bullet", 
        { opacity: 0, x: -20 }, 
        { opacity: 1, x: 0, duration: 0.6, stagger: 0.1, delay: 0.4, ease: "power3.out" }
      );
      
      gsap.fromTo(".hero-form-group", 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.6, ease: "expo.out" }
      );
      
      gsap.fromTo(".hero-cta-group", 
        { opacity: 0, y: 30 }, 
        { opacity: 1, y: 0, duration: 0.6, delay: 0.8, ease: "expo.out" }
      );
      
      gsap.fromTo(".hero-preview", 
        { opacity: 0, scale: 0.95 }, 
        { opacity: 1, scale: 1, duration: 0.8, delay: 0.3, ease: "expo.out" }
      );
      
      // Floating animation for preview
      gsap.to(".hero-preview-inner", {
        y: -10,
        duration: 3,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1,
      });
      
      // Sparkle animation
      gsap.to(".hero-sparkle", {
        opacity: 0.3,
        scale: 0.8,
        duration: 1.5,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.2,
      });
    });
    
    return () => ctx.revert();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && formData.date && formData.time && formData.place.trim()) {
      const params = new URLSearchParams();
      params.set('name', formData.name.trim());
      params.set('for', formData.gender);
      params.set('date', formData.date);
      params.set('time', formData.time);
      params.set('place', formData.place.trim());
      window.location.href = `/?${params.toString()}`;
    }
  };

  return (
    <section className="min-h-[600px] relative overflow-hidden bg-void">
      {/* Animated Background */}
      <div className="absolute inset-0" aria-hidden="true">
        {/* Radial gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(232,180,58,0.08)_0%,transparent_70%),radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(212,72,40,0.06)_0%,transparent_60%),radial-gradient(ellipse_40%_30%_at_10%_30%,rgba(40,56,120,0.05)_0%,transparent_50%)]" />
        {/* Floating particles */}
        <ParticleField count={15} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 relative z-content">
        {/* Subtle eyebrow pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border-saffron/30 text-saffron">
            <span className="text-xs font-semibold">Now in public beta</span>
            <span className="w-1.5 h-1.5 rounded-full bg-saffron animate-pulse" />
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left: Copy & Form */}
          <div className="space-y-6">
            <div className="reveal-up">
              <h1 className="hero-title font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-parchment leading-[1.1] tracking-tight">
                Your child's <em className="text-saffron not-italic">nakshatra</em>,<br />
                as consecrated art
              </h1>
            </div>

            <p className="hero-subtitle text-base sm:text-lg text-parchment-dim leading-relaxed max-w-xl">
              A personalized Vedic wallpaper that honors your child's birth star,
              planetary yantra, and naming syllable \u2014 designed to hang in their
              room as a daily reminder of their unique path.
            </p>

            {/* Obstacle bullets */}
            <ul className="space-y-3" role="list">
              {[
                "Generic posters don't reflect who they really are",
                "Mass-market astrology feels shallow and exploitative",
                "You want something rooted in tradition, not trends",
              ].map((obstacle, i) => (
                <li key={i} className="hero-bullet flex items-start gap-3 text-parchment">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-saffron flex-shrink-0 hero-sparkle" style={{ animationDelay: `${i * 200}ms` }} />
                  <span className="text-base">{obstacle}</span>
                </li>
              ))}
            </ul>

            {/* CTA - Full birth details */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
              <div className="grid sm:grid-cols-2 gap-3 hero-form-group">
                <div className="relative">
                  <label htmlFor="hero-name" className="label">Child's Name</label>
                  <input
                    id="hero-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); setHasInteracted(true); }}
                    placeholder="Child's name"
                    className="input pr-12"
                    autoComplete="off"
                  />
                  <Star className="absolute right-4 top-10 w-5 h-5 text-parchment-dim/50" />
                </div>
                <div className="relative">
                  <label htmlFor="hero-gender" className="label">Gender</label>
                  <select
                    id="hero-gender"
                    value={formData.gender}
                    onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as "girl" | "boy" }))}
                    className="select pr-10"
                  >
                    <option value="girl">Girl</option>
                    <option value="boy">Boy</option>
                  </select>
                  <Crown className="absolute right-3 top-10 w-5 h-5 text-parchment-dim/50 pointer-events-none" />
                </div>
              </div>
              
              <div className="grid sm:grid-cols-3 gap-3 hero-form-group">
                <div>
                  <label htmlFor="hero-date" className="label">Birth Date</label>
                  <input
                    id="hero-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="input"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label htmlFor="hero-time" className="label">Birth Time</label>
                  <input
                    id="hero-time"
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="hero-place" className="label">Birth Place</label>
                  <input
                    id="hero-place"
                    type="text"
                    value={formData.place}
                    onChange={(e) => setFormData(prev => ({ ...prev, place: e.target.value }))}
                    placeholder="City, Country"
                    className="input"
                  />
                </div>
              </div>

              <div className="hero-cta-group flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={generatePreview}
                  disabled={previewLoading || !formData.name.trim() || !formData.date || !formData.time || !formData.place.trim()}
                  className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Preview
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={!formData.name.trim() || !formData.date || !formData.time || !formData.place.trim()}
                  className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <span>Create {formData.name.trim() ? `${formData.name.trim()}'s` : "child's"} Wallpaper</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              {previewError && (
                <p className="field-error" role="alert">
                  <Shield className="w-4 h-4" /> {previewError}
                </p>
              )}
              
              <p className="text-xs text-parchment-dim text-center">
                The chart and artwork are drawn from exact birth details. Free \u00b7 Takes 2 minutes \u00b7 All fields required
              </p>
            </form>
          </div>

          {/* Right: Live Preview */}
          <div className="relative mx-auto w-full max-w-[320px] lg:max-w-[360px]">
            {/* Floating status chip */}
            <div className="absolute -top-4 right-0 left-0 mx-auto z-sticky w-fit px-4 py-2 rounded-full glass-gold border-saffron/30 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
                <span className="font-semibold text-parchment">Live Preview</span>
                <span className="text-parchment-dim">\u00b7</span>
                <span className="text-saffron font-medium">Real-time</span>
              </div>
            </div>

            {/* Preview Card */}
            <div className="hero-preview glass-strong rounded-3xl border border-saffron/20 shadow-2xl overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-void-elevated/80 border-b border-void-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-vermilion/80" />
                  <div className="w-3 h-3 rounded-full bg-turmeric/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald/80" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-parchment-dim font-mono">nakshatra-canvas.app</span>
                </div>
              </div>

              {/* Live wallpaper preview */}
              <div className="hero-preview-inner aspect-[3/4] relative overflow-hidden">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={`${formData.name || "Child"}'s personalized Vedic wallpaper preview`}
                    className="w-full h-full object-cover transition-opacity duration-500"
                  />
                ) : (
                  <>
                    {/* Mandala background pattern */}
                    <div className="absolute inset-0 opacity-10" style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23E8B43A' stroke-width='0.5' stroke-opacity='0.3'%3E%3Ccircle cx='100' cy='100' r='90'/%3E%3Ccircle cx='100' cy='100' r='70'/%3E%3Ccircle cx='100' cy='100' r='50'/%3E%3Ccircle cx='100' cy='100' r='30'/%3E%3Ccircle cx='100' cy='100' r='10'/%3E%3Cpath d='M100 10v180M10 100h180M40 40l120 120M160 40l-120 120'/%3E%3C/g%3E%3C/svg%3E")`
                    }} />
                    
                    {/* Yantra visualization */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <div className="w-72 h-72 border-2 border-saffron/50 rounded-lg transform rotate-45">
                        <div className="absolute inset-5 border-2 border-saffron/30 rounded-lg" />
                        <div className="absolute inset-10 border-2 border-saffron/20 rounded-lg" />
                        <div className="absolute inset-15 border border-saffron/10 rounded-lg" />
                      </div>
                    </div>
                    
                    {/* Sample text content */}
                    <div className="relative z-10 h-full flex flex-col justify-between text-parchment p-8 font-devanagari">
                      <div className="text-center">
                        <div className="text-xs uppercase tracking-widest text-saffron mb-2">Nakshatra</div>
                        <div className="text-5xl font-serif font-bold mb-1 text-gradient-saffron">
                          {chartData?.nakshatra || "Rohini"}
                        </div>
                        <div className="text-xl text-parchment-dim">{chartData?.nakshatraDevanagari || "रोहिणी"} \u00b7 {chartData?.rulingPlanet || "Moon"}</div>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="text-xs uppercase tracking-widest text-saffron">Naming Syllable</div>
                        <div className="text-4xl font-serif text-gradient-vermilion">
                          {chartData?.namingSyllableDevanagari || "वा"} \u00b7 {chartData?.namingSyllable || "Va"}
                        </div>
                      </div>
                      <div className="text-center text-xs text-parchment-dim">
                        Born under the star of {chartData?.nakshatra || "growth and abundance"}
                      </div>
                    </div>
                  </>
                )}
                
                {previewLoading && (
                  <div className="absolute inset-0 bg-void/80 flex items-center justify-center z-10 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="relative">
                        <div className="w-16 h-16 border-4 border-saffron/20 rounded-full" />
                        <div className="absolute inset-0 w-16 h-16 border-4 border-saffron border-t-transparent rounded-full animate-spin" />
                        <div className="absolute inset-4 w-8 h-8 border-4 border-vermilion/50 border-r-transparent rounded-full animate-spin" style={{ animationDirection: "reverse" }} />
                      </div>
                      <div>
                        <p className="font-heading text-lg text-parchment">Generating your preview...</p>
                        <p className="text-sm text-parchment-dim mt-1">Computing birth chart \u00b7 Drawing mandala</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Info */}
            <div className="mt-4 p-4 glass rounded-2xl border border-void-border">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-xl bg-saffron/10 border border-saffron/20">
                  <Sparkles className="w-6 h-6 text-saffron mx-auto mb-1" />
                  <p className="text-xs text-parchment-dim">Deterministic</p>
                  <p className="text-xs font-medium text-saffron">Chart Engine</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald/10 border border-emerald/20">
                  <Shield className="w-6 h-6 text-emerald mx-auto mb-1" />
                  <p className="text-xs text-parchment-dim">Privacy</p>
                  <p className="text-xs font-medium text-emerald">First</p>
                </div>
                <div className="p-3 rounded-xl bg-indigo/20 border border-indigo/30">
                  <Crown className="w-6 h-6 text-indigo mx-auto mb-1" />
                  <p className="text-xs text-parchment-dim">Vedic</p>
                  <p className="text-xs font-medium text-indigo">Tradition</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-10 pt-6 border-t border-void-border reveal-up">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: Eye, label: "Deterministic Engine", detail: "Not AI guesswork", color: "saffron" },
              { icon: Gem, label: "Classical Sources", detail: "Peer-reviewed accuracy", color: "emerald" },
              { icon: Shield, label: "Privacy-First", detail: "No data sold or shared", color: "indigo" },
            ].map((item, i) => (
              <div key={i} className="group">
                <div className={cn('p-3 rounded-xl mx-auto mb-3 w-14 h-14 flex items-center justify-center transition-all', `bg-${item.color}/10 border border-${item.color}/20 group-hover:bg-${item.color}/20`)} >
                  <item.icon className={cn('w-7 h-7', `text-${item.color}`)} />
                </div>
                <div className="font-semibold text-parchment mb-1">{item.label}</div>
                <div className="text-xs text-parchment-dim">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ParticleField({ count = 15 }: { count?: number }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 8,
    duration: 6 + Math.random() * 4,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-saffron/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `particle-float ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes particle-float {
          0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
          10% { opacity: 0.6; }
          50% { opacity: 0.3; transform: translateY(-30px) scale(1); }
          90% { opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}