import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type ReconciliationRow = {
  pan: string
  tracker_amount: number | null
  form16a_amount: number | null
  difference: number | null
  status: 'Matched' | 'TDS Mismatch' | 'Form 16A Not Received'
  coverage: 'Received' | 'Not Received'
}

const STATUS_ORDER = { 'TDS Mismatch': 0, 'Form 16A Not Received': 1, 'Matched': 2 }

export async function GET() {
  const supabase = createClient()

  const [{ data: trackers, error: e1 }, { data: form16as, error: e2 }] = await Promise.all([
    supabase.from('tds_tracker').select('pan, tds_amount'),
    supabase.from('tds_form16a').select('pan, tds_amount'),
  ])

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // Aggregate by PAN (sum amounts per PAN)
  const trackerMap = new Map<string, number>()
  for (const row of trackers || []) {
    if (!row.pan) continue
    trackerMap.set(row.pan, (trackerMap.get(row.pan) || 0) + (row.tds_amount || 0))
  }

  const form16aMap = new Map<string, number>()
  for (const row of form16as || []) {
    if (!row.pan) continue
    form16aMap.set(row.pan, (form16aMap.get(row.pan) || 0) + (row.tds_amount || 0))
  }

  const allPans = Array.from(new Set(
    Array.from(trackerMap.keys()).concat(Array.from(form16aMap.keys()))
  ))

  const rows: ReconciliationRow[] = []

  for (const pan of allPans) {
    const tracker = trackerMap.get(pan) ?? null
    const form16a = form16aMap.get(pan) ?? null
    const coverage: ReconciliationRow['coverage'] = form16a !== null ? 'Received' : 'Not Received'
    let status: ReconciliationRow['status']
    let difference: number | null = null

    if (form16a === null) {
      status = 'Form 16A Not Received'
    } else {
      difference = Math.abs((tracker || 0) - form16a)
      status = difference <= 5 ? 'Matched' : 'TDS Mismatch'
    }

    rows.push({ pan, tracker_amount: tracker, form16a_amount: form16a, difference, status, coverage })
  }

  rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

  return NextResponse.json(rows)
}
