import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tds_critical')
    .select('*, tds_ph(id, ph_name, poc, overall_status, is_critical)')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const body = await request.json()

  // Check if already critical
  const { data: existing } = await supabase
    .from('tds_critical')
    .select('id')
    .eq('ph_id', body.ph_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already in critical list' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('tds_critical')
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select('*, tds_ph(id, ph_name, poc, overall_status, is_critical)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark PH as critical
  await supabase.from('tds_ph').update({ is_critical: true }).eq('id', body.ph_id)

  return NextResponse.json(data, { status: 201 })
}
