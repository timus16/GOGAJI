import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json()

    const body = razorpay_order_id + '|' + razorpay_payment_id
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const supabase = createClient()
    
    // Get transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .single()

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Update transaction
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
        razorpay_payment_id,
        razorpay_signature,
      })
      .eq('id', transaction.id)

    // Add credits to user
    await supabase.rpc('add_credits', {
      user_id: transaction.user_id,
      credits_to_add: transaction.credits_added,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
