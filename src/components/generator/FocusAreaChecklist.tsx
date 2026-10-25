"use client";

import { Checkbox } from "@/components/shared/Checkbox";

interface FocusAreaChecklistProps {
  selectedAreas: string[];
  onChange: (areas: string[]) => void;
}

const FOCUS_AREAS = [
  { id: "career", label: "Career & Profession", icon: "💼" },
  { id: "wealth", label: "Wealth & Finance", icon: "💰" },
  { id: "relationships", label: "Relationships & Marriage", icon: "💑" },
  { id: "health", label: "Health & Wellness", icon: "🏥" },
  { id: "spirituality", label: "Spirituality & Growth", icon: "✨" },
];

export function FocusAreaChecklist({ selectedAreas, onChange }: FocusAreaChecklistProps) {
  const allSelected = selectedAreas.length === FOCUS_AREAS.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : FOCUS_AREAS.map(f => f.id));
  };

  const toggleArea = (id: string) => {
    onChange(
      selectedAreas.includes(id)
        ? selectedAreas.filter(a => a !== id)
        : [...selectedAreas, id]
    );
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4"
        />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">All-in-one — every area</span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        {FOCUS_AREAS.map((area) => (
          <label key={area.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Checkbox
              checked={selectedAreas.includes(area.id)}
              onChange={() => toggleArea(area.id)}
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
  );
}
