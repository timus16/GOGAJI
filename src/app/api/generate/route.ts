import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInternalReport, generateAIPrompt, generateSVGChart, callAIProvider } from '@/lib/astrology/pipeline'
import { generateFingerprint } from '@/lib/utils/fingerprints'

const ANONYMOUS_LIMIT = 10

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, date, time, place, latitude, longitude, timezone,
      focusAreas, regionalSystem, state, language,
      fingerprint, userId
    } = body

    const supabase = createClient()
    let isAnonymous = !userId

    // Check credits/limits
    if (isAnonymous) {
      const { data: usage } = await supabase
        .from('generation_usage')
        .select('count')
        .eq('fingerprint', fingerprint)
        .single()
      
      if (usage && usage.count >= ANONYMOUS_LIMIT) {
        return NextResponse.json({ error: 'Free generations limit reached. Please sign up.' }, { status: 403 })
      }
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single()
      
      if (!profile || profile.credits <= 0) {
        return NextResponse.json({ error: 'Insufficient credits' }, { status: 403 })
      }
    }

    // Generate internal report
    const birthData = { date, time, latitude: parseFloat(latitude), longitude: parseFloat(longitude), timezone }
    const report = await generateInternalReport(birthData, focusAreas || [], { state: state || 'Maharashtra', language: language || 'English' })
    
    // Generate SVG chart
    const svgChart = generateSVGChart(report.chart)
    
    // Generate AI prompt
    const aiPrompt = await generateAIPrompt(report)
    
    // Call AI provider (if BYOK provided, otherwise use default)
    const byok = body.byok || {}
    const aiImageUrl = await callAIProvider(aiPrompt, byok)

    // Create wallpaper record
    const { data: wallpaper, error: wallpaperError } = await supabase
      .from('wallpapers')
      .insert({
        user_id: userId || null,
        fingerprint: isAnonymous ? fingerprint : null,
        image_url: aiImageUrl,
        prompt: aiPrompt,
        nakshatra: report.chart.ascendantNakshatra,
        resolution: '1080x1920',
        chart_data: report.chart,
        report_data: report,
        regional_system: regionalSystem,
      })
      .select()
      .single()

    if (wallpaperError) throw wallpaperError

    // Update usage/credits
    if (isAnonymous) {
      await supabase
        .from('generation_usage')
        .upsert({ fingerprint, count: (usage?.count || 0) + 1, last_generated: new Date().toISOString() })
    } else {
      await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1, total_generations: profile.total_generations + 1 })
        .eq('id', userId)
    }

    return NextResponse.json({
      imageUrl: aiImageUrl,
      prompt: aiPrompt,
      report,
      wallpaperId: wallpaper.id,
    })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
