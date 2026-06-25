import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const quarter = searchParams.get('quarter')

  const { data: phs, error } = await supabase
    .from('tds_ph')
    .select('*')
    .order('ph_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!quarter) return NextResponse.json(phs)

  // Join quarter data
  const { data: quarters } = await supabase
    .from('tds_quarters')
    .select('*')
    .eq('quarter', quarter)

  const quarterMap = new Map((quarters || []).map(q => [q.ph_id, q]))

  const result = phs.map(ph => ({
    ...ph,
    quarterData: quarterMap.get(ph.id) || null,
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const body = await request.json()
  const { data, error } = await supabase.from('tds_ph').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
