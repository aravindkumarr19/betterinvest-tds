import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const recipient = searchParams.get('recipient')

  let query = supabase
    .from('tds_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (recipient) query = query.eq('recipient_name', recipient)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
