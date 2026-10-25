import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Razorpay from 'razorpay'
import { CreditPack, CREDIT_PACKS } from '@/lib/payments/credit-packs'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(request: NextRequest) {
  try {
    const { packId } = await request.json()
    const pack = CREDIT_PACKS.find(p => p.id === packId)
    
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const order = await razorpay.orders.create({
      amount: pack.price * 100, // Convert to paise
      currency: 'INR',
      receipt: \eceipt_\_\\,
      notes: { userId: user.id, packId: pack.id },
    })

    // Create pending transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: pack.price * 100,
      credits_added: pack.credits,
      status: 'pending',
      payment_method: 'razorpay',
      razorpay_order_id: order.id,
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (error) {
    console.error('Order creation error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
