import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ wallpapers: [] })
    }

    const { data: wallpapers, error } = await supabase
      .from('wallpapers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ wallpapers: wallpapers || [] })
  } catch (error) {
    console.error('Wallpapers fetch error:', error)
    return NextResponse.json({ wallpapers: [] })
  }
}
