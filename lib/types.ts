export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export const QUARTERS: { key: Quarter; label: string }[] = [
  { key: 'Q1', label: 'Q1 — Apr-Jun' },
  { key: 'Q2', label: 'Q2 — Jul-Sep' },
  { key: 'Q3', label: 'Q3 — Oct-Dec' },
  { key: 'Q4', label: 'Q4 — Jan-Mar' },
]

export const TEAM_MEMBERS = ['Aravind', 'Meenakshi', 'Induma', 'DK']

export const STATUS_COLORS: Record<string, string> = {
  'Filed': 'bg-green-100 text-green-700',
  'In Process': 'bg-amber-100 text-amber-700',
  'Not filed': 'bg-red-100 text-red-700',
  'No TDS Till now': 'bg-gray-100 text-gray-600',
  'Refunded to Investors': 'bg-blue-100 text-blue-700',
  'Filed, In Process': 'bg-amber-100 text-amber-700',
  'In Process, Filed': 'bg-amber-100 text-amber-700',
}

export interface TdsPh {
  id: string
  ph_name: string
  poc: string
  overall_status: string
  is_critical: boolean
  created_at: string
}

export interface TdsQuarter {
  id: string
  ph_id: string
  quarter: Quarter
  challan_done: boolean
  form_26q_done: boolean
  form_16a_done: boolean
  comment: string | null
  updated_at: string
}

export interface PhWithQuarter extends TdsPh {
  quarterData?: TdsQuarter
}

export interface PhWithAllQuarters extends TdsPh {
  quarters: Partial<Record<Quarter, TdsQuarter | null>>
}

export type TabMode = Quarter | 'Summary'

export interface TdsCritical {
  id: string
  ph_id: string
  why_critical: string | null
  quarters_pending: string | null
  last_action: string | null
  next_action: string | null
  target_closure: string | null
  status: string | null
  escalation: boolean
  updated_at: string
  tds_ph?: TdsPh
}

export interface TdsMessage {
  id: string
  ph_id: string
  content: string
  sender_name: string
  created_at: string
}

export interface TdsNotification {
  id: string
  recipient_name: string
  sender_name: string
  message: string
  ph_id: string | null
  is_read: boolean
  created_at: string
}
