const fs = require("fs");
let content = fs.readFileSync("src/components/Generator.tsx", "utf8");

// Add id to manual toggle button
content = content.replace(
  \'<button type="button" onClick={() => setShowManual((m) => !m)}\',
  \'<button id="toggle-manual" type="button" onClick={() => setShowManual((m) => !m)}\'
);

// Add seconds toggle button and conditional rendering
// Find the minute select closing and add the seconds toggle after it
const secondsToggle = `
              <div>
                <button id="toggle-seconds" type="button" aria-expanded={showSeconds} onClick={() => setShowSeconds(s => !s)}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-200">
                  <span aria-hidden>{showSeconds ? "▲" : "▼"}</span>
                  <span>Seconds (optional)</span>
                </button>
                {showSeconds && (
                  <div className="mt-1">
                    <label htmlFor="birth-seconds" className="sr-only">Seconds (optional)</label>
                    <input id="birth-seconds" name="birthSeconds" type="number" min={0} max={59} inputMode="numeric"
                      value={seconds}
                      onChange={(e) => setSeconds(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                      placeholder="-"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  </div>
                )}
              </div>
`;

// Replace the always-visible seconds input with the toggle version
content = content.replace(
  `<div>
                <label htmlFor="birth-seconds" className="block text-[10px] uppercase tracking-widest text-neutral-500">Seconds (optional)</label>
                <input id="birth-seconds" name="birthSeconds" type="number" min={0} max={59} inputMode="numeric"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="-"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>`,
  secondsToggle
);

fs.writeFileSync("src/components/Generator.tsx", content);
console.log("Added seconds toggle and manual toggle ID");
