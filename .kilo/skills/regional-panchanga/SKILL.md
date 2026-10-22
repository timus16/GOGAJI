---
name: regional-panchanga
description: Use when working on the GOGAJI pañchāṅga engine or the regional layer — computePanchang, lunar-month naming (amānta/pūrṇimānta), Vimśottarī daśā math, or src/content/regional.ts (36 state/UT entries, new-years, native rashi/nakshatra names), or validating any astro-calendar claim. Triggers on "panchang", "tithi", "yoga", "karana", "amānta", "pūrṇimānta", "Gudī Padwā", "Ugādi", "Puthandu", "Viṣu", "Bestu Vāras", "saṅkrānti", "vimshottari", "dasha", "regional".
---

# Regional & Pañchāṅga Layer (GOGAJI)

The operating contract for any LLM working on the pañchāṅga engine or the
regional data. Complements `astrology-premium-service/SKILL.md` (pipeline) and
`ai-wallpaper-composite/SKILL.md` (request path).

## 1. The ENGINE computes — never the LLM

All astronomy lives in `src/lib/astro.ts`: pure functions, no I/O, validated
against NASA/JPL Horizons (`scripts/horizons-compare.ts`). An LLM must never
compute, recall, or "double-check" a tithi, yoga, karaṇa, vāra, nakṣatra, lunar
month, saṅkrānti date, or daśā period from its own knowledge. If the engine did
not produce the value, the value does not exist.

What the engine computes:

- `computePanchang(utc, offsetMinutes)` — tithi, yoga, karaṇa, vāra, paksha,
  and the lunar month in both reckonings.
- `vimshottariDasha(chart, count)` — Vimśottarī daśā periods.

## 2. Lunar-month naming rule (the CORRECTED classical rule)

```
sunAtNewMoon = sun − (elongation / 12.19) × 0.9856   // Sun's longitude at the LAST new moon
amāntaIndex  = (floor(sunAtNewMoon / 30) + 1) mod 12 // Chaitra..Phālguna
pūrṇimānta   = amānta + 1 when Kṛṣṇa paksha (tithiIndex >= 15)
```

`elongation` is Moon − Sun (sidereal); 12.19°/day is the combined lunar motion
and 0.9856°/day the Sun's daily motion. The step backwards to the Sun's
longitude at the last new moon is what makes the naming classical-correct;
naming from the current Sun longitude is the naive (wrong) version.

**Validation anchors that MUST stay true** (check after any engine change):

- `1992-08-14` → **Śrāvaṇa** (Śrāvaṇa Pūrṇimā was 1992-08-13).
- `2024-04-09` (Gudī Padwā) → **Chaitra**.
- Śukla paksha ⇒ the pūrṇimānta name **equals** the amānta name.

## 3. Amānta vs Pūrṇimānta

- **Amānta** ("ending at the new moon"): the month ends at amāvasyā; Śukla
  paksha opens the month. The default in most of the Deccan and the south.
- **Pūrṇimānta** ("ending at the full moon"): the month ends at pūrṇimā;
  Kṛṣṇa paksha opens the month. The North-Indian (Vikrama-saṃvat) default.
- The two disagree only across a Kṛṣṇa paksha (hence the `+1` rule); in Śukla
  paksha both reckonings name the month identically (anchor 3 above).
- Which state follows which reckoning is **data**, in
  `src/content/regional.ts` (`INDIAN_STATES[].reckoning`) — not a general rule
  an LLM may assert from memory.

## 4. Vimśottarī math

`vimshottariDasha(chart, count)`: the sequence starts at the lord of the Moon's
nakṣatra; the first period carries the **balance** left from the nakṣatra
fraction (elapsed span / 13°20′). Full 120-year cycle:

| Lord | Years | | Lord | Years |
|---|---|---|---|---|
| Ketu | 7 | | Rāhu | 18 |
| Śukra | 20 | | Guru | 16 |
| Sūrya | 6 | | Śani | 19 |
| Candra | 10 | | Budha | 17 |
| Maṅgala | 7 | | | (sum = 120) |

Never recompute daśā dates by hand or "from memory"; trust the engine output.

## 5. Regional data rules (`src/content/regional.ts`)

- `INDIAN_STATES` holds exactly **36 entries: 28 states + 8 UTs**. Every
  `RegionalTradition` carries: IAST `state`, `aliases` (English names, short
  codes), `language`, `reckoning` (`"amānta" | "pūrṇimānta"`), `samvatEra`
  (`"śaka" | "vikram"`), `newYear`, exactly **12 `rashis`** (Meṣa..Mīna) and
  **27 `nakshatras`** (Aśvinī..Revatī) in the state's major language,
  `deityTradition`, `notes`.
- `traditionByState(name)` matches the exact state name or any alias,
  case-insensitively. New entries must keep this working.
- **Solar vs lunar new-years — the critical distinction:**
  - Lunar, **Chaitra Śukla 1**: Gudī Padwā (Mahārāṣṭra), Ugādi (the Deccan).
  - Solar, **Meṣa saṅkrānti (~14 April)**: Puthandu (Tamil), Viṣu (Malayalam),
    Poila Boiśākh (Bengali), Pana Saṅkrānti (Odia). These are **never**
    Chaitra Śukla 1.
  - **Bestu Vāras** (Gujarati) = Kārttika Śukla 1, after Dīpāvalī.
  - Bāisākhī is Vaiśākha saṅkrānti, **not** the Vikrama new year (the file's
    `VIKAL` constant says exactly this).
- **Vāra (weekday)** uses the **civil-midnight boundary** (`local.getUTCDay()`
  on the offset-shifted date). A sunrise-boundary vāra is future work — do not
  claim otherwise.
- **Saṅkrānti precision is approximate** (mean-motion based). Never present a
  saṅkrānti instant as exact to the minute.

## 6. GUARDRAILS

- Every unverifiable claim stays marked **PROVISIONAL in-file**. The
  `regional.ts` header carries the standing note; a `deityTradition` that is
  not classically provenanced must contain the word "PROVISIONAL".
- Never present a heuristic or compiled table as a classical verdict. The
  per-state reckoning assignments are published-practice compilations,
  PROVISIONAL pending Jyotiṣa review.
- Adding or editing an entry: keep 12 rashis + 27 nakshatras exactly, keep the
  IAST style, keep `traditionByState` alias matching, and never let an LLM
  supply an astronomical value.