import { useState } from "react";

export interface DiscoveryAnswers {
  intent: string;
  previousFailure: string;
}

interface DiscoveryGateProps {
  onComplete: (answers: DiscoveryAnswers) => void;
  onSkip: () => void;
}

/**
 * Two-question pre-form discovery gate that captures user intent and previous
 * pain points before they fill the birth input form.
 */
export default function DiscoveryGate({ onComplete, onSkip }: DiscoveryGateProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [intent, setIntent] = useState("");
  const [previousFailure, setPreviousFailure] = useState("");

  const handleContinue = () => {
    if (step === 1 && intent) {
      setStep(2);
    } else if (step === 2) {
      onComplete({ intent, previousFailure });
    }
  };

  const handleSkip = () => {
    if (step === 1) {
      onSkip();
    } else {
      // If on step 2, go back to step 1
      setStep(1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="rounded-3xl border border-amber-500/25 bg-neutral-900/70 p-8 shadow-2xl backdrop-blur">
        {/* Progress indicator */}
        <div className="flex gap-2 mb-8">
          <div className={`h-1.5 flex-1 rounded-full ${
            step >= 1 ? "bg-amber-400" : "bg-neutral-700"
          }`} />
          <div className={`h-1.5 flex-1 rounded-full ${
            step >= 2 ? "bg-amber-400" : "bg-neutral-700"
          }`} />
        </div>

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-100 mb-2">
                What will you use this for?
              </h2>
              <p className="text-neutral-400 text-sm">
                Help us personalize your experience
              </p>
            </div>

            <div className="space-y-3">
              {[
                { value: "child_room", label: "Child's room decoration" },
                { value: "daily_sadhana", label: "Daily sadhana practice" },
                { value: "personal_emblem", label: "Personal emblem / identity" },
                { value: "gift", label: "Gift for someone special" },
                { value: "other", label: "Something else" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    intent === option.value
                      ? "border-amber-400/70 bg-amber-400/10"  
                      : "border-neutral-700 bg-neutral-800/60 hover:border-amber-400/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="intent"
                    value={option.value}
                    checked={intent === option.value}
                    onChange={(e) => setIntent(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-neutral-100 font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-100 mb-2">
                Anything a previous app got wrong? (optional — helps us do better)
              </h2>
              <p className="text-neutral-400 text-sm">
                Optional — helps us avoid the same mistakes
              </p>
            </div>

            <textarea
              value={previousFailure}
              onChange={(e) => setPreviousFailure(e.target.value)}
              placeholder="e.g., Too generic, didn't feel personal, wrong predictions, felt exploitative..."
              className="w-full p-4 rounded-lg border-2 border-neutral-700 bg-neutral-800/60 text-neutral-100 placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none min-h-[120px] resize-y"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            type="button"
            onClick={handleSkip}
            className="px-6 py-3 rounded-lg border-2 border-neutral-700 text-neutral-300 font-medium hover:border-amber-400/40 transition-colors"
          >
            {step === 1 ? "Skip" : "Back"}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={step === 1 && !intent}
            className="flex-1 px-6 py-3 rounded-lg bg-amber-400 text-neutral-950 font-semibold hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            {step === 1 ? "Continue" : "Start Creating"}
          </button>
        </div>
      </div>
    </div>
  );
}