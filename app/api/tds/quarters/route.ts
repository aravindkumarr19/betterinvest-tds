import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const ph_id = searchParams.get('ph_id')
  const quarter = searchParams.get('quarter')

  let query = supabase.from('tds_quarters').select('*')
  if (ph_id) query = query.eq('ph_id', ph_id)
  if (quarter) query = query.eq('quarter', quarter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const body = await request.json()

  // Check if exists first (upsert)
  const { data: existing } = await supabase
    .from('tds_quarters')
    .select('id')
    .eq('ph_id', body.ph_id)
    .eq('quarter', body.quarter)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('tds_quarters')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('tds_quarters')
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update overall status if all 3 done
  const { challan_done, form_26q_done, form_16a_done } = data
  if (challan_done && form_26q_done && form_16a_done) {
    await supabase.from('tds_ph').update({ overall_status: 'Filed' }).eq('id', body.ph_id)
  }

  return NextResponse.json(data, { status: 201 })
}
