import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('tds_quarters')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update overall_status to Filed if all 3 checkboxes done
  const { challan_done, form_26q_done, form_16a_done, ph_id } = data
  if (challan_done && form_26q_done && form_16a_done) {
    await supabase.from('tds_ph').update({ overall_status: 'Filed' }).eq('id', ph_id)
  }

  return NextResponse.json(data)
}
