"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { Checkbox } from "@/components/shared/Checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useFingerprint } from "@/hooks/useFingerprint";

const FOCUS_AREAS = [
  { id: "career", label: "Career & Profession", icon: "💼" },
  { id: "wealth", label: "Wealth & Finance", icon: "💰" },
  { id: "relationships", label: "Relationships & Marriage", icon: "💑" },
  { id: "health", label: "Health & Wellness", icon: "🏥" },
  { id: "spirituality", label: "Spirituality & Growth", icon: "✨" },
];

const REGIONAL_SYSTEMS = [
  { value: "vedic", label: "Standard Vedic (All India)" },
  { value: "tamil", label: "Tamil Jathaka (Tamil Nadu)" },
  { value: "bengali", label: "Bengali Panji (West Bengal)" },
  { value: "malayalam", label: "Malayalam Manmatha (Kerala)" },
  { value: "north-indian", label: "North Indian KP Style" },
  { value: "south-indian", label: "South Indian (Karnataka)" },
];

const STATES = [
  { value: "Maharashtra", label: "Maharashtra" },
  { value: "Tamil Nadu", label: "Tamil Nadu" },
  { value: "Karnataka", label: "Karnataka" },
  { value: "Kerala", label: "Kerala" },
  { value: "West Bengal", label: "West Bengal" },
  { value: "Gujarat", label: "Gujarat" },
  { value: "Rajasthan", label: "Rajasthan" },
  { value: "Uttar Pradesh", label: "Uttar Pradesh" },
  { value: "Delhi", label: "Delhi" },
  { value: "Other", label: "Other" },
];

const LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "हिन्दी (Hindi)" },
  { value: "Tamil", label: "தமிழ் (Tamil)" },
  { value: "Bengali", label: "বাংলা (Bengali)" },
  { value: "Telugu", label: "తెలుగు (Telugu)" },
  { value: "Marathi", label: "मराठी (Marathi)" },
  { value: "Kannada", label: "ಕನ್ನಡ (Kannada)" },
  { value: "Malayalam", label: "മലയാളം (Malayalam)" },
  { value: "Gujarati", label: "ગુજરાતી (Gujarati)" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
  { value: "UTC", label: "UTC" },
];

interface GeneratorFormProps {
  onGenerate: (data: { imageUrl: string; prompt: string; report: any; reading: any; provider: string }) => void;
}

export function GeneratorForm({ onGenerate }: GeneratorFormProps) {
  const { user } = useAuth();
  const { credits, consumeCredit } = useCredits();
  const { fingerprint } = useFingerprint();

  const [formData, setFormData] = useState({
    name: "",
    date: "",
    time: "",
    place: "",
    latitude: "",
    longitude: "",
    timezone: "Asia/Kolkata",
    focusAreas: [] as string[],
    regionalSystem: "vedic",
    state: "Maharashtra",
    language: "English",
    presetId: "temple-gold",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [internalReport, setInternalReport] = useState<any>(null);
  const [aiReading, setAiReading] = useState<any>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  const isAnonymous = !user;
  const canGenerate = user ? credits > 0 : true;

  const handleChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleFocusAreaChange = useCallback((areas: string[]) => {
    setFormData(prev => ({ ...prev, focusAreas: areas }));
  }, []);

  const handleRegionalChange = useCallback((system: string, state?: string, language?: string) => {
    setFormData(prev => ({ ...prev, regionalSystem: system, state: state || prev.state, language: language || prev.language }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (user && credits <= 0) {
        setError("Insufficient credits. Please add credits to continue.");
        setLoading(false);
        return;
      }

      const payload = {
        ...formData,
        fingerprint: isAnonymous ? fingerprint : undefined,
        userId: user?.id,
        keys: {},
      };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      if (user) {
        await consumeCredit();
      }

      setInternalReport(data.report);
      setAiReading(data.reading);
      setAiProvider(data.provider);
      setShowReport(true);
      
      onGenerate({ 
        imageUrl: data.imageUrl, 
        prompt: data.prompt,
        report: data.report,
        reading: data.reading,
        provider: data.provider,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate wallpaper");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
      <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">Birth Details</h2>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
          <Input
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="As you want it on the wallpaper"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Birth Date</label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => handleChange("date", e.target.value)}
            required
            max={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Birth Time</label>
          <Input
            type="time"
            value={formData.time}
            onChange={(e) => handleChange("time", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Birth Place</label>
          <Input
            value={formData.place}
            onChange={(e) => handleChange("place", e.target.value)}
            placeholder="City, Country"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Latitude</label>
          <Input
            type="number"
            step="any"
            value={formData.latitude}
            onChange={(e) => handleChange("latitude", e.target.value)}
            placeholder="e.g., 19.0760"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Longitude</label>
          <Input
            type="number"
            step="any"
            value={formData.longitude}
            onChange={(e) => handleChange("longitude", e.target.value)}
            placeholder="e.g., 72.8777"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Timezone</label>
          <Select
            value={formData.timezone}
            onChange={(e) => handleChange("timezone", e.target.value)}
            options={TIMEZONES}
          />
        </div>
      </div>

      {/* Style Preset */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Style Preset</label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "temple-gold", name: "Temple Gold" },
            { id: "indigo-midnight", name: "Indigo Midnight" },
            { id: "minimal-line", name: "Minimal Line" },
            { id: "dense-mandala", name: "Dense Mandala" },
            { id: "royal-marigold", name: "Royal Marigold" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleChange("presetId", p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                formData.presetId === p.id
                  ? "bg-amber-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Focus Areas */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Focus Areas</label>
        <div className="grid grid-cols-2 gap-2">
          {FOCUS_AREAS.map((area) => (
            <label key={area.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Checkbox
                checked={formData.focusAreas.includes(area.id)}
                onChange={() => handleFocusAreaChange(
                  formData.focusAreas.includes(area.id)
                    ? formData.focusAreas.filter(a => a !== area.id)
                    : [...formData.focusAreas, area.id]
                )}
                className="h-4 w-4"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>{area.icon}</span>
                {area.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Regional System */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Regional Calculation System</label>
        <Select
          value={formData.regionalSystem}
          onChange={(e) => handleRegionalChange(e.target.value)}
          options={REGIONAL_SYSTEMS}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">State/Region</label>
            <Select
              value={formData.state}
              onChange={(e) => handleRegionalChange(formData.regionalSystem, e.target.value, formData.language)}
              options={STATES}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language</label>
            <Select
              value={formData.language}
              onChange={(e) => handleRegionalChange(formData.regionalSystem, formData.state, e.target.value)}
              options={LANGUAGES}
            />
          </div>
        </div>
      </div>

      {isAnonymous && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Anonymous mode:</strong> You have 10 free generations. 
          </p>
        </div>
      )}

      {user && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Credits:</strong> <span className="font-bold text-lg ml-2">{credits}</span> wallpaper credits available
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || (user && credits <= 0)}
        className="w-full py-3 text-lg"
        size="lg"
      >
        {loading ? "Generating..." : "Create Wallpaper"}
      </Button>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}
    </form>
  );
}