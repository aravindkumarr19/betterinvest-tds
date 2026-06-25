'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { PhWithQuarter, PhWithAllQuarters, TdsCritical, Quarter, TabMode } from '@/lib/types'
import { QUARTERS } from '@/lib/types'

const PHDetailPanel = dynamic(() => import('./PHDetailPanel'), { ssr: false })

const POCS = ['All', 'Aravind', 'Meenakshi', 'Induma', 'DK']
const STATUSES_FILTER = ['All', 'Filed', 'In Process', 'Not filed', 'No TDS Till now', 'Refunded to Investors']
const CHECKPOINTS = ['All', 'Challan Pending', 'Form 26Q Pending', 'Form 16A Pending']

type CheckboxField = 'challan_done' | 'form_26q_done' | 'form_16a_done'

// Understated enterprise status badge styles
const STATUS_STYLE: Record<string, string> = {
  'Filed':                  'bg-[#f0fdf4] text-[#15803d] ring-1 ring-[#bbf7d0]',
  'In Process':             'bg-[#fffbeb] text-[#92400e] ring-1 ring-[#fde68a]',
  'Filed, In Process':      'bg-[#fffbeb] text-[#92400e] ring-1 ring-[#fde68a]',
  'In Process, Filed':      'bg-[#fffbeb] text-[#92400e] ring-1 ring-[#fde68a]',
  'Not filed':              'bg-[#fef2f2] text-[#991b1b] ring-1 ring-[#fecaca]',
  'No TDS Till now':        'bg-[#f9fafb] text-[#6b7280] ring-1 ring-[#e5e7eb]',
  'Refunded to Investors':  'bg-[#eff6ff] text-[#1d4ed8] ring-1 ring-[#bfdbfe]',
}

function getDisplayName(email: string): string {
  const map: Record<string, string> = {
    'aravind@betterinvest.club': 'Aravind',
    'meenakshi@betterinvest.club': 'Meenakshi',
    'induma@betterinvest.club': 'Induma',
    'dk@betterinvest.club': 'DK',
    'aravindkumarr19@gmail.com': 'Aravind',
  }
  return map[email] || email.split('@')[0]
}

// ── Custom enterprise checkbox (no browser default styling) ─────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center justify-center mx-auto"
      style={{ width: 24, height: 24 }}
    >
      <div
        className={`w-[15px] h-[15px] rounded-[3px] border flex items-center justify-center transition-colors ${
          checked
            ? 'bg-[#111111] border-[#111111]'
            : 'bg-white border-[#d1d1d1] hover:border-[#999]'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 10 8" width="9" height="7" fill="none">
            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StatusBoard({ currentUser }: { currentUser: string }) {
  const [selectedTab, setSelectedTab] = useState<TabMode>('Summary')
  const [phs, setPhs] = useState<PhWithQuarter[]>([])
  const [summaryPhs, setSummaryPhs] = useState<PhWithAllQuarters[]>([])
  const [criticalIds, setCriticalIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [pocFilter, setPocFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [checkpointFilter, setCheckpointFilter] = useState('All')
  const [selectedPh, setSelectedPh] = useState<PhWithQuarter | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, filed: 0, inProcess: 0, notFiled: 0, refunded: 0, critical: 0 })

  const displayName = getDisplayName(currentUser)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const critRes = await fetch('/api/tds/critical')
    const crits: TdsCritical[] = critRes.ok ? await critRes.json() : []
    const ids = new Set<string>(crits.map(c => c.ph_id))
    setCriticalIds(ids)

    if (selectedTab === 'Summary') {
      const [r1, r2, r3, r4] = await Promise.all(
        QUARTERS.map(q => fetch(`/api/tds/ph?quarter=${q.key}`))
      )
      const [d1, d2, d3, d4]: PhWithQuarter[][] = await Promise.all(
        [r1, r2, r3, r4].map(r => r.json())
      )
      const byId: Record<string, PhWithAllQuarters> = {}
      const datasets: [Quarter, PhWithQuarter[]][] = [
        ['Q1', d1], ['Q2', d2], ['Q3', d3], ['Q4', d4],
      ]
      for (const [q, data] of datasets) {
        for (const ph of data) {
          if (!byId[ph.id]) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { quarterData: _qd, ...base } = ph
            byId[ph.id] = { ...base, quarters: {} }
          }
          byId[ph.id].quarters[q] = ph.quarterData ?? null
        }
      }
      const merged = Object.values(byId)
      setSummaryPhs(merged)
      setStats({
        total: merged.length,
        filed: merged.filter(p => p.overall_status === 'Filed').length,
        inProcess: merged.filter(p => p.overall_status.includes('In Process')).length,
        notFiled: merged.filter(p => p.overall_status === 'Not filed').length,
        refunded: merged.filter(p => p.overall_status === 'Refunded to Investors').length,
        critical: crits.length,
      })
    } else {
      const phRes = await fetch(`/api/tds/ph?quarter=${selectedTab}`)
      if (phRes.ok) {
        const data: PhWithQuarter[] = await phRes.json()
        setPhs(data)
        setStats({
          total: data.length,
          filed: data.filter(p => p.overall_status === 'Filed').length,
          inProcess: data.filter(p => p.overall_status.includes('In Process')).length,
          notFiled: data.filter(p => p.overall_status === 'Not filed').length,
          refunded: data.filter(p => p.overall_status === 'Refunded to Investors').length,
          critical: crits.length,
        })
      }
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleCheckbox(ph: PhWithQuarter, field: CheckboxField) {
    if (selectedTab === 'Summary') return
    const q = ph.quarterData
    const newVal = !(q?.[field] ?? false)
    if (q?.id) {
      await fetch(`/api/tds/quarters/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newVal }),
      })
    } else {
      const res = await fetch('/api/tds/quarters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ph_id: ph.id, quarter: selectedTab, [field]: newVal }),
      })
      if (res.ok) { await fetchData(); return }
    }
    setPhs(prev => prev.map(p => {
      if (p.id !== ph.id) return p
      const updated = { ...p.quarterData, [field]: newVal }
      const allDone = updated.challan_done && updated.form_26q_done && updated.form_16a_done
      return { ...p, quarterData: updated as typeof p.quarterData, overall_status: allDone ? 'Filed' : p.overall_status }
    }))
  }

  async function toggleSummaryCheckbox(ph: PhWithAllQuarters, quarter: Quarter, field: CheckboxField) {
    const q = ph.quarters[quarter]
    const newVal = !(q?.[field] ?? false)
    if (q?.id) {
      await fetch(`/api/tds/quarters/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newVal }),
      })
    } else {
      const res = await fetch('/api/tds/quarters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ph_id: ph.id, quarter, [field]: newVal }),
      })
      if (res.ok) { await fetchData(); return }
    }
    setSummaryPhs(prev => prev.map(p => {
      if (p.id !== ph.id) return p
      const updatedQ = { ...(p.quarters[quarter] ?? {}), [field]: newVal }
      return { ...p, quarters: { ...p.quarters, [quarter]: updatedQ as typeof p.quarters[typeof quarter] } }
    }))
  }

  async function updateComment(ph: PhWithQuarter, comment: string) {
    const q = ph.quarterData
    if (q?.id) {
      await fetch(`/api/tds/quarters/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      setPhs(prev => prev.map(p =>
        p.id === ph.id ? { ...p, quarterData: { ...p.quarterData!, comment } } : p
      ))
    } else if (selectedTab !== 'Summary' && comment.trim()) {
      const res = await fetch('/api/tds/quarters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ph_id: ph.id, quarter: selectedTab, comment }),
      })
      if (res.ok) await fetchData()
    }
  }

  async function markCritical(phId: string) {
    if (criticalIds.has(phId)) return
    await fetch('/api/tds/critical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ph_id: phId }),
    })
    await fetchData()
  }

  function matchesFilters(ph: { ph_name: string; poc: string; overall_status: string }) {
    if (search && !ph.ph_name.toLowerCase().includes(search.toLowerCase())) return false
    if (pocFilter !== 'All' && ph.poc !== pocFilter) return false
    if (statusFilter !== 'All') {
      if (statusFilter === 'Filed' && ph.overall_status !== 'Filed') return false
      if (statusFilter === 'In Process' && !ph.overall_status.includes('In Process')) return false
      if (statusFilter !== 'Filed' && statusFilter !== 'In Process' && ph.overall_status !== statusFilter) return false
    }
    return true
  }

  const filteredPhs = phs.filter(ph => {
    if (!matchesFilters(ph)) return false
    if (checkpointFilter !== 'All') {
      const q = ph.quarterData
      if (checkpointFilter === 'Challan Pending' && q?.challan_done) return false
      if (checkpointFilter === 'Form 26Q Pending' && q?.form_26q_done) return false
      if (checkpointFilter === 'Form 16A Pending' && q?.form_16a_done) return false
    }
    return true
  })

  const filteredSummary = summaryPhs.filter(ph => matchesFilters(ph))
  const displayCount = selectedTab === 'Summary' ? filteredSummary.length : filteredPhs.length
  const totalCount = selectedTab === 'Summary' ? summaryPhs.length : phs.length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-[#111111]">TDS Status</h1>
        <span className="text-xs px-2.5 py-1 bg-[#ede9ff] text-[#6c47ff] rounded-full font-medium">FY 2025-26</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total PHs',    value: stats.total,     color: 'text-[#111111]' },
          { label: 'Fully Filed',  value: stats.filed,     color: 'text-[#15803d]' },
          { label: 'In Process',   value: stats.inProcess, color: 'text-[#92400e]' },
          { label: 'Not Filed',    value: stats.notFiled,  color: 'text-[#991b1b]' },
          { label: 'Refunded',     value: stats.refunded,  color: 'text-[#1d4ed8]' },
          { label: 'Critical PHs', value: stats.critical,  color: 'text-[#991b1b]' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-[#999] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-white border border-[#e5e5e5] rounded-xl p-1 w-fit">
        <button
          onClick={() => setSelectedTab('Summary')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedTab === 'Summary'
              ? 'bg-[#6c47ff] text-white'
              : 'text-[#666666] hover:text-[#111111] hover:bg-[#fafafa]'
          }`}
        >
          Summary
        </button>
        {QUARTERS.map(q => (
          <button
            key={q.key}
            onClick={() => setSelectedTab(q.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === q.key
                ? 'bg-[#6c47ff] text-white'
                : 'text-[#666666] hover:text-[#111111] hover:bg-[#fafafa]'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#bbb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search production house..."
            className="w-full pl-9 pr-3 py-2 border border-[#e5e5e5] rounded-lg text-sm text-[#111111] placeholder:text-[#bbb] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white"
          />
        </div>
        <select value={pocFilter} onChange={e => setPocFilter(e.target.value)} className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#555] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white">
          {POCS.map(p => <option key={p} value={p}>{p === 'All' ? 'All POCs' : p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#555] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white">
          {STATUSES_FILTER.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        {selectedTab !== 'Summary' && (
          <select value={checkpointFilter} onChange={e => setCheckpointFilter(e.target.value)} className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#555] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white">
            {CHECKPOINTS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Checkpoints' : c}</option>)}
          </select>
        )}
      </div>

      {/* Table container */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {selectedTab === 'Summary' ? (
            <SummaryTable
              phs={filteredSummary}
              criticalIds={criticalIds}
              loading={loading}
              onOpenDetail={ph => setSelectedPh({ ...ph, quarterData: ph.quarters['Q4'] ?? undefined })}
              onToggle={toggleSummaryCheckbox}
              onMarkCritical={id => markCritical(id)}
            />
          ) : (
            <QuarterTable
              phs={filteredPhs}
              criticalIds={criticalIds}
              loading={loading}
              onOpenDetail={ph => setSelectedPh(ph)}
              onToggle={toggleCheckbox}
              onCommentSave={updateComment}
              onMarkCritical={id => markCritical(id)}
            />
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#f0f0f0] text-[13px] text-[#999]">
          {displayCount} of {totalCount} production houses
        </div>
      </div>

      {selectedPh && (
        <PHDetailPanel
          ph={selectedPh}
          currentUser={displayName}
          onClose={() => setSelectedPh(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  )
}

// ── Summary Table ──────────────────────────────────────────────────────────

const Q_META: { key: Quarter; label: string; short: string }[] = [
  { key: 'Q1', label: 'Apr – Jun', short: 'Q1' },
  { key: 'Q2', label: 'Jul – Sep', short: 'Q2' },
  { key: 'Q3', label: 'Oct – Dec', short: 'Q3' },
  { key: 'Q4', label: 'Jan – Mar', short: 'Q4' },
]

// th styles — consistent compact header cells
const TH = 'text-[11px] font-semibold text-[#999] uppercase tracking-wide px-3 py-3 text-center'
const TH_LEFT = 'text-[11px] font-semibold text-[#999] uppercase tracking-wide px-4 py-3 text-left'

function SummaryTable({ phs, criticalIds, loading, onOpenDetail, onToggle, onMarkCritical }: {
  phs: PhWithAllQuarters[]
  criticalIds: Set<string>
  loading: boolean
  onOpenDetail: (ph: PhWithAllQuarters) => void
  onToggle: (ph: PhWithAllQuarters, quarter: Quarter, field: CheckboxField) => void
  onMarkCritical: (id: string) => void
}) {
  return (
    <table className="w-full border-collapse" style={{ minWidth: 1080, fontSize: 13 }}>
      <thead>
        {/* Row 1 — quarter group labels */}
        <tr className="border-b border-[#e8e8e8] bg-white">
          <th rowSpan={2} className={`${TH_LEFT} w-[210px] border-r border-[#e8e8e8] align-bottom pb-2`}>
            Production House
          </th>
          <th rowSpan={2} className={`${TH_LEFT} w-20 border-r border-[#e8e8e8] align-bottom pb-2`}>
            POC
          </th>
          <th rowSpan={2} className={`${TH_LEFT} w-36 border-r border-[#e8e8e8] align-bottom pb-2`}>
            Status
          </th>
          {Q_META.map((q, qi) => (
            <th
              key={q.key}
              colSpan={3}
              className={`text-center pt-3 pb-1 ${qi > 0 ? 'border-l-2 border-[#ebebeb]' : ''}`}
            >
              <span className="text-[11px] font-semibold text-[#555] uppercase tracking-wider">
                {q.short}
              </span>
              <span className="ml-1.5 text-[10px] font-normal text-[#bbb] normal-case tracking-normal">
                {q.label}
              </span>
            </th>
          ))}
          <th rowSpan={2} className={`${TH} w-16 border-l border-[#e8e8e8] align-bottom pb-2`} />
        </tr>
        {/* Row 2 — sub-column labels */}
        <tr className="border-b border-[#e8e8e8] bg-white">
          {Q_META.map((q, qi) =>
            ['Challan', '26Q', '16A'].map((sub, fi) => (
              <th
                key={`${q.key}-${sub}`}
                className={`${TH} pb-2 pt-1 w-[72px]
                  ${fi === 0 && qi > 0 ? 'border-l-2 border-[#ebebeb]' : ''}
                `}
              >
                {sub}
              </th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={16} className="text-center py-16 text-[#bbb]">Loading…</td>
          </tr>
        ) : phs.length === 0 ? (
          <tr>
            <td colSpan={16} className="text-center py-16 text-[#bbb]">No production houses found</td>
          </tr>
        ) : (
          phs.map((ph, idx) => (
            <SummaryRow
              key={ph.id}
              ph={ph}
              idx={idx}
              isCritical={criticalIds.has(ph.id)}
              onOpenDetail={() => onOpenDetail(ph)}
              onToggle={(q, f) => onToggle(ph, q, f)}
              onMarkCritical={() => onMarkCritical(ph.id)}
            />
          ))
        )}
      </tbody>
    </table>
  )
}

function SummaryRow({ ph, idx, isCritical, onOpenDetail, onToggle, onMarkCritical }: {
  ph: PhWithAllQuarters
  idx: number
  isCritical: boolean
  onOpenDetail: () => void
  onToggle: (quarter: Quarter, field: CheckboxField) => void
  onMarkCritical: () => void
}) {
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'
  const fields: CheckboxField[] = ['challan_done', 'form_26q_done', 'form_16a_done']
  const isSkipped = ph.overall_status === 'Refunded to Investors' || ph.overall_status === 'No TDS Till now'

  return (
    <tr className={`${rowBg} border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors`}>
      {/* PH Name */}
      <td className="px-4 py-3 border-r border-[#e8e8e8]">
        <button
          onClick={onOpenDetail}
          className="font-semibold text-[#111111] text-left hover:underline underline-offset-2 decoration-[#bbb] leading-snug"
        >
          {ph.ph_name}
        </button>
        {isCritical && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#fff0f0] text-[#cc0000] font-medium align-middle">
            Critical
          </span>
        )}
      </td>

      {/* POC */}
      <td className="px-4 py-3 text-[#555] border-r border-[#e8e8e8] whitespace-nowrap">
        {ph.poc}
      </td>

      {/* Overall status */}
      <td className="px-4 py-3 border-r border-[#e8e8e8]">
        <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${STATUS_STYLE[ph.overall_status] || 'bg-[#f5f5f5] text-[#555]'}`}>
          {ph.overall_status}
        </span>
      </td>

      {/* Quarter cells */}
      {isSkipped ? (
        <td colSpan={12} className="px-6 py-3 border-l border-[#f0f0f0]">
          <span className="text-[#bbb] italic text-[12px]">—</span>
        </td>
      ) : (
        Q_META.map((q, qi) =>
          fields.map((field, fi) => (
            <td
              key={`${q.key}-${field}`}
              className={`py-3 px-1 text-center
                ${fi === 0 && qi > 0 ? 'border-l-2 border-[#ebebeb]' : ''}
              `}
            >
              <Checkbox
                checked={ph.quarters[q.key]?.[field] ?? false}
                onChange={() => onToggle(q.key, field)}
              />
            </td>
          ))
        )
      )}

      {/* Actions */}
      <td className="px-3 py-3 border-l border-[#e8e8e8]">
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={onOpenDetail} title="Open conversation" className="text-[#ccc] hover:text-[#6c47ff] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            onClick={onMarkCritical}
            title={isCritical ? 'Already critical' : 'Mark as critical'}
            className={`transition-colors ${isCritical ? 'text-[#cc0000]' : 'text-[#ccc] hover:text-[#cc0000]'}`}
          >
            <svg className="w-3.5 h-3.5" fill={isCritical ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Quarter Table ──────────────────────────────────────────────────────────

function QuarterTable({ phs, criticalIds, loading, onOpenDetail, onToggle, onCommentSave, onMarkCritical }: {
  phs: PhWithQuarter[]
  criticalIds: Set<string>
  loading: boolean
  onOpenDetail: (ph: PhWithQuarter) => void
  onToggle: (ph: PhWithQuarter, field: CheckboxField) => void
  onCommentSave: (ph: PhWithQuarter, comment: string) => void
  onMarkCritical: (id: string) => void
}) {
  return (
    <table className="w-full border-collapse" style={{ fontSize: 13 }}>
      <thead>
        <tr className="border-b border-[#e8e8e8] bg-white">
          <th className={`${TH_LEFT} w-[240px]`}>Production House</th>
          <th className={`${TH_LEFT} w-24`}>POC</th>
          <th className={`${TH_LEFT} w-36`}>Status</th>
          <th className={`${TH} w-24`}>Challan</th>
          <th className={`${TH} w-24`}>Form 26Q</th>
          <th className={`${TH} w-24`}>Form 16A</th>
          <th className={`${TH_LEFT}`}>Comment</th>
          <th className={`${TH} w-20`} />
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={8} className="text-center py-16 text-[#bbb]">Loading…</td></tr>
        ) : phs.length === 0 ? (
          <tr><td colSpan={8} className="text-center py-16 text-[#bbb]">No production houses found</td></tr>
        ) : (
          phs.map((ph, idx) => (
            <TableRow
              key={ph.id}
              ph={ph}
              idx={idx}
              isCritical={criticalIds.has(ph.id)}
              onOpenDetail={() => onOpenDetail(ph)}
              onToggle={field => onToggle(ph, field)}
              onCommentSave={c => onCommentSave(ph, c)}
              onMarkCritical={() => onMarkCritical(ph.id)}
            />
          ))
        )}
      </tbody>
    </table>
  )
}

function TableRow({ ph, idx, isCritical, onOpenDetail, onToggle, onCommentSave, onMarkCritical }: {
  ph: PhWithQuarter
  idx: number
  isCritical: boolean
  onOpenDetail: () => void
  onToggle: (field: CheckboxField) => void
  onCommentSave: (comment: string) => void
  onMarkCritical: () => void
}) {
  const [editingComment, setEditingComment] = useState(false)
  const [comment, setComment] = useState(ph.quarterData?.comment ?? '')
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#f5f5f5]'

  useEffect(() => { setComment(ph.quarterData?.comment ?? '') }, [ph.quarterData?.comment])

  return (
    <tr className={`${rowBg} border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors`}>
      <td className="px-4 py-3">
        <button
          onClick={onOpenDetail}
          className="font-semibold text-[#111111] text-left hover:underline underline-offset-2 decoration-[#bbb] leading-snug"
        >
          {ph.ph_name}
        </button>
        {isCritical && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#fff0f0] text-[#cc0000] font-medium align-middle">
            Critical
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-[#555]">{ph.poc}</td>
      <td className="px-4 py-3">
        <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${STATUS_STYLE[ph.overall_status] || 'bg-[#f5f5f5] text-[#555]'}`}>
          {ph.overall_status}
        </span>
      </td>
      <td className="py-3 text-center">
        <Checkbox checked={ph.quarterData?.challan_done ?? false} onChange={() => onToggle('challan_done')} />
      </td>
      <td className="py-3 text-center">
        <Checkbox checked={ph.quarterData?.form_26q_done ?? false} onChange={() => onToggle('form_26q_done')} />
      </td>
      <td className="py-3 text-center">
        <Checkbox checked={ph.quarterData?.form_16a_done ?? false} onChange={() => onToggle('form_16a_done')} />
      </td>
      <td className="px-4 py-2 max-w-[220px]">
        {editingComment ? (
          <textarea
            autoFocus
            value={comment}
            onChange={e => setComment(e.target.value)}
            onBlur={() => { setEditingComment(false); onCommentSave(comment) }}
            rows={2}
            className="w-full border border-[#6c47ff] rounded-md px-2.5 py-1.5 text-[13px] resize-none focus:outline-none text-[#111111] bg-white"
            placeholder="Add a comment…"
          />
        ) : (
          <div
            onClick={() => setEditingComment(true)}
            className="min-h-[32px] px-2.5 py-1.5 rounded-md cursor-text text-[#555] hover:bg-[#f0f0f0] transition-colors border border-transparent hover:border-[#e0e0e0]"
          >
            {comment || <span className="text-[#ccc] italic">Add a comment…</span>}
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-1.5">
          <button onClick={onOpenDetail} title="Open conversation" className="text-[#ccc] hover:text-[#6c47ff] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            onClick={onMarkCritical}
            title={isCritical ? 'Already critical' : 'Mark as critical'}
            className={`transition-colors ${isCritical ? 'text-[#cc0000]' : 'text-[#ccc] hover:text-[#cc0000]'}`}
          >
            <svg className="w-3.5 h-3.5" fill={isCritical ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
