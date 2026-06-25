import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from('tds_critical')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // Get ph_id before deleting
  const { data: crit } = await supabase
    .from('tds_critical')
    .select('ph_id')
    .eq('id', params.id)
    .single()

  const { error } = await supabase.from('tds_critical').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Un-mark as critical
  if (crit?.ph_id) {
    await supabase.from('tds_ph').update({ is_critical: false }).eq('id', crit.ph_id)
  }

  return NextResponse.json({ success: true })
}
