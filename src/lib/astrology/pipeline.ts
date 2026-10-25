import { computeChart, type Chart, type BirthInput } from '~/lib/astro'
import { generateInternalReport, generateWallpaperPrompt, generateRandomSeed, type InternalAstrologyReport } from '~/lib/astrology-pipeline'
import { nvidiaWallpaper, promptFromBrief, type WallpaperPromptInput } from '~/lib/nvidia'
import { readKundli, type Reading } from '~/lib/gemini'

export async function generateInternalReport(
  birthData: { date: string; time: string; latitude: number; longitude: number; timezone: string },
  focusAreas: string[],
  regional: { state: string; language: string }
): Promise<{ chart: Chart; report: InternalAstrologyReport }> {
  const input: BirthInput = {
    name: '',
    date: birthData.date,
    time: birthData.time,
    place: '',
    latitude: birthData.latitude,
    longitude: birthData.longitude,
    timezone: birthData.timezone,
  }

  const chart = computeChart(input)
  const report = generateInternalReport(input, focusAreas[0] || 'career', regional.state as any)

  return { chart, report }
}

export async function generateAIPrompt(report: InternalAstrologyReport): Promise<string> {
  const reading = await readKundli(JSON.stringify(report))
  
  const promptInput: WallpaperPromptInput = {
    facts: {
      nakshatra: report.nakshatra,
      deity: report.problemAnalysis.remedies[0]?.deity || '',
      symbol: report.problemAnalysis.remedies[0]?.name || '',
      lagna: report.ascendant,
      lagnaEnglish: report.ascendant,
      lagnaLord: report.lagnaLord,
      conditions: report.problemAnalysis.area,
      rulingPlanet: report.lagnaLord,
      rulingColour: '',
    },
    focusAreas: [report.problemAnalysis.area],
  }

  return promptFromBrief(reading.reading, JSON.stringify(report), promptInput)
}

export function generateSVGChart(chart: Chart): string {
  const signs = ['', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
  
  let svg = '<svg width=\"400\" height=\"400\" viewBox=\"0 0 400 400\" xmlns=\"http://www.w3.org/2000/svg\">'
  svg += '<circle cx=\"200\" cy=\"200\" r=\"180\" fill=\"none\" stroke=\"#333\" stroke-width=\"2\"/>'
  svg += '<circle cx=\"200\" cy=\"200\" r=\"120\" fill=\"none\" stroke=\"#333\" stroke-width=\"1\"/>'
  svg += '<circle cx=\"200\" cy=\"200\" r=\"60\" fill=\"none\" stroke=\"#333\" stroke-width=\"1\"/>'
  
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180
    const x1 = 200 + 180 * Math.cos(angle)
    const y1 = 200 + 180 * Math.sin(angle)
    const x2 = 200 + 60 * Math.cos(angle)
    const y2 = 200 + 60 * Math.sin(angle)
    svg += '<line x1=\"' + x1 + '\" y1=\"' + y1 + '\" x2=\"' + x2 + '\" y2=\"' + y2 + '\" stroke=\"#333\" stroke-width=\"1\"/>'
    
    const labelAngle = (i * 30 - 75) * Math.PI / 180
    const lx = 200 + 195 * Math.cos(labelAngle)
    const ly = 200 + 195 * Math.sin(labelAngle)
    svg += '<text x=\"' + lx + '\" y=\"' + ly + '\" text-anchor=\"middle\" font-size=\"10\" fill=\"#333\">' + signs[i + 1] + '</text>'
  }
  
  chart.planets.forEach(p => {
    const house = chart.houses.findIndex(h => h.planets.includes(p.key)) + 1
    if (house > 0) {
      const angle = ((house - 1) * 30 - 90) * Math.PI / 180
      const radius = 90
      const px = 200 + radius * Math.cos(angle)
      const py = 200 + radius * Math.sin(angle)
      svg += '<text x=\"' + px + '\" y=\"' + py + '\" text-anchor=\"middle\" font-size=\"8\" fill=\"#000\">' + p.key + '</text>'
    }
  })
  
  svg += '</svg>'
  return svg
}

export async function callAIProvider(prompt: string, byok: Record<string, string>): Promise<string> {
  const keyOverride = byok.nvidia || byok.NVIDIA_API_KEY
  
  const result = await nvidiaWallpaper(prompt, { keyOverride })
  
  return result.dataUrl
}
