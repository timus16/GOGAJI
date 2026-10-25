import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { transactionId, amount, packId } = await request.json()
    
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the credit pack
    const packs = [
      { id: 'starter', credits: 10, price: 99 },
      { id: 'popular', credits: 30, price: 249 },
      { id: 'creator', credits: 75, price: 499 },
    ]
    const pack = packs.find(p => p.id === packId)
    
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })
    }

    // Create pending transaction for manual review
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: pack.price * 100,
      credits_added: pack.credits,
      status: 'pending',
      payment_method: 'manual_upi',
      upi_transaction_id: transactionId,
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Transaction submitted for review. Credits will be added after verification.' 
    })
  } catch (error) {
    console.error('Manual UPI error:', error)
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }
}
