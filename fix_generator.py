import re

with open(r"E:\\sentir\\gogaji\\GOGAJI\\temp\\Generator.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old_seconds = """              <div>
                <label htmlFor="birth-seconds" className="block text-[10px] uppercase tracking-widest text-neutral-500">Seconds (optional)</label>
                <input id="birth-seconds" name="birthSeconds" type="number" min={0} max={59} inputMode="numeric"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="-"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-amber-400/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>"""

new_seconds = """              <div>
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
              </div>"""

old_manual = """          <button type="button" onClick={() => setShowManual((m) => !m)}
            className="mt-3 text-xs text-neutral-400 underline decoration-dotted hover:text-amber-200">
            {showManual ? "hide manual entry" : "search not working? enter coordinates by hand"}
          </button>"""

new_manual = """          <button id="toggle-manual" type="button" aria-expanded={showManual} onClick={() => setShowManual((m) => !m)}
            className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-200">
            <span aria-hidden>{showManual ? "▲" : "▼"}</span>
            <span>{showManual ? "hide manual entry" : "search not working? enter coordinates by hand"}</span>
          </button>"""

content = content.replace(old_seconds, new_seconds)
content = content.replace(old_manual, new_manual)

with open(r"E:\\sentir\\gogaji\\GOGAJI\\temp\\Generator.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done!")
