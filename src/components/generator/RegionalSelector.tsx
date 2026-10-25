"use client";

import { Select } from "@/components/shared/Select";

interface RegionalSelectorProps {
  selectedSystem: string;
  selectedState: string;
  selectedLanguage: string;
  onChange: (system: string, state?: string, language?: string) => void;
}

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

export function RegionalSelector({ selectedSystem, selectedState, selectedLanguage, onChange }: RegionalSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Regional Calculation System</h3>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">System</label>
        <Select
          value={selectedSystem}
          onChange={(e) => onChange(e.target.value)}
          options={REGIONAL_SYSTEMS}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">State/Region</label>
          <Select
            value={selectedState}
            onChange={(e) => onChange(selectedSystem, e.target.value, selectedLanguage)}
            options={STATES}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language</label>
          <Select
            value={selectedLanguage}
            onChange={(e) => onChange(selectedSystem, selectedState, e.target.value)}
            options={LANGUAGES}
          />
        </div>
      </div>
    </div>
  );
}
