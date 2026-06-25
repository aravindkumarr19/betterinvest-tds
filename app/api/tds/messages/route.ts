import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const ph_id = searchParams.get('ph_id')

  let query = supabase.from('tds_messages').select('*').order('created_at')
  if (ph_id) query = query.eq('ph_id', ph_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const body = await request.json()
  const { ph_id, content, sender_name } = body

  const { data, error } = await supabase
    .from('tds_messages')
    .insert({ ph_id, content, sender_name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Detect @mentions and create notifications
  const mentions = [...content.matchAll(/@(\w+)/g)].map((m: RegExpMatchArray) => m[1])
  const TEAM = ['Aravind', 'Meenakshi', 'Induma', 'DK']

  const notifications = mentions
    .filter((m: string) => TEAM.includes(m) && m !== sender_name)
    .map((recipient: string) => ({
      recipient_name: recipient,
      sender_name,
      message: `${sender_name} mentioned you: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
      ph_id,
      is_read: false,
    }))

  if (notifications.length > 0) {
    await supabase.from('tds_notifications').insert(notifications)
  }

  return NextResponse.json(data, { status: 201 })
}
