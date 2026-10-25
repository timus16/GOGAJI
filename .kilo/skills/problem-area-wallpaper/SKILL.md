---
name: problem-area-wallpaper
description: |
  Use when generating a fresh Vedic wallpaper based on user-selected problem areas.
  Each problem area maps to specific astrological houses, planets, motifs, and remedies.
  The wallpaper must be visually and content-distinct for each problem area.
  Uses existing API endpoints (/api/generate, /api/wallpapers) and deterministic engine.
version: 1.0
---

# Problem-Area Wallpaper Generation Skill

## Purpose
Generate a fresh, unique wallpaper for every submission based on the user'"'"'s selected problem areas (career, wealth, relationships, health, education, spiritual, protection, family). The wallpaper'"'"'s visual motifs, colors, and the internal astrology report must reflect the chosen problem area.

## User Flow
1. User submits birth details (name, date, time, place, coordinates, timezone)
2. User selects one or more problem areas from the 8 LIFE_AREAS
3. User optionally enables AI step with BYOK or server keys
4. User clicks "Create my wallpaper"
5. System generates:
   - Deterministic chart (always)
   - Internal astrology report weighted to selected areas (always)
   - AI reading focused on problem area (if AI enabled)
   - AI wallpaper with problem-area-specific motifs (if AI enabled)
6. User can regenerate for same birth details → **new unique wallpaper** each time

## Problem Area → Astrological Mapping

| Problem Area | Primary Houses | Focus Planets | Wallpaper Motifs | Accent Color | Remedies Focus |
|--------------|----------------|---------------|------------------|--------------|----------------|
| career | 10, 6 | Sun, Jupiter, Saturn | Mandala geometry, upward geometry | Gold/Amber | Sun mantras, Saturn discipline |
| wealth | 2, 11 | Jupiter, Venus, Mercury | Lakshmi symbols, abundance geometry | Green/Gold | Jupiter/Venus mantras, charity |
| relationships | 7, 4, 5, 8, 12 | Venus, Mars, Moon | Union symbols, yoni yantras | Pink/Red | Venus/Moon mantras, harmony |
| health | 1, 6, 8, 12 | Mars, Saturn, Sun | Healing geometry, protective shields | Red/Orange | Mars/Sun mantras, vitality |
| education | 4, 5, 2, 9 | Mercury, Jupiter, Ketu | Saraswati symbols, knowledge geometry | Yellow/Blue | Mercury/Jupiter mantras |
| spiritual | 9, 12, 4, 8 | Jupiter, Ketu, Rahu | Om symbols, lotus mandalas, chakras | Purple/White | Ketu/Jupiter mantras, meditation |
| protection | 6, 8, 12, 3, 11 | Mars, Saturn, Rahu | Shield geometry, protective yantras | Black/Red | Mars/Saturn/Rahu mantras |
| family | 3, 4, 5, 2, 10 | Moon, Venus, Jupiter | Home symbols, ancestral geometry | Silver/White | Moon/Venus mantras, ancestry |

## Generation Rules

1. **Uniqueness**: Every submission with same birth details MUST produce a different wallpaper (random seed per request)
2. **Problem Area Weighting**: Selected areas must visually and textually influence the wallpaper and report
3. **Deterministic Fallback**: If AI fails, deterministic SVG wallpaper with chart overlay still works
4. **API Contract**: Uses `/api/generate` (POST) with body: `BirthInput + focusAreas + presetId + regionalSystem + fingerprint + keys?`
5. **Rate Limits**: Anonymous: 10 generations/day per fingerprint; Authenticated: credit-based

## Verification
- Same birth details + different problem area → distinct visual emphasis in wallpaper
- Same birth details + same problem area + regenerate → new unique wallpaper (random seed)
- No AI keys → deterministic SVG works, report generated, AI reading/image = null gracefully
- AI keys provided → attempt AI reading + wallpaper, degrade gracefully on failure

## API Endpoints Used
- `POST /api/generate` - Main generation endpoint
- `GET /api/wallpapers` - List user'"'"'s wallpapers
- `GET /api/wallpapers/[id]` - Get specific wallpaper
- `POST /api/credits/consume` - Credit consumption
