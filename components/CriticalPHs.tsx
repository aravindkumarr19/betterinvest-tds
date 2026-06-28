'use client'

import { useState, useEffect } from 'react'
import type { TdsCritical, TdsPh } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function CriticalPHs({ currentUser }: { currentUser: string }) {
  const [criticals, setCriticals] = useState<TdsCritical[]>([])
  const [allPhs, setAllPhs] = useState<TdsPh[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [critRes, phRes] = await Promise.all([
      fetch('/api/tds/critical'),
      fetch('/api/tds/ph'),
    ])
    if (critRes.ok) setCriticals(await critRes.json())
    if (phRes.ok) setAllPhs(await phRes.json())
    setLoading(false)
  }

  async function updateField(id: string, field: string, value: string | boolean) {
    await fetch(`/api/tds/critical/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setCriticals(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  async function removeCritical(id: string) {
    await fetch(`/api/tds/critical/${id}`, { method: 'DELETE' })
    setCriticals(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#111111]">Critical PHs</h1>
          <span className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-medium">
            {criticals.length}
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-medium hover:bg-[#1d4ed8] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Critical PH
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-48">PH Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-40">Why Critical</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-28">Qtrs Pending</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-44">Last Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-40">Next Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-28">Target Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-28">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#666666] w-24">Escalation</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#666666] w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-sm text-[#666666]">Loading...</td></tr>
              ) : criticals.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-sm text-[#666666]">No critical PHs</td></tr>
              ) : (
                criticals.map(c => (
                  <CriticalRow key={c.id} critical={c} onUpdate={updateField} onRemove={removeCritical} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <AddCriticalModal
          allPhs={allPhs}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData() }}
        />
      )}
    </div>
  )
}

function CriticalRow({ critical, onUpdate, onRemove }: {
  critical: TdsCritical
  onUpdate: (id: string, field: string, value: string | boolean) => void
  onRemove: (id: string) => void
}) {
  return (
    <tr className="hover:bg-[#fafafa] transition-colors align-top">
      <td className="px-4 py-3 font-medium text-[#111111] text-sm">
        {critical.tds_ph?.ph_name || '—'}
        <div className="text-xs text-[#666666] mt-0.5">{critical.tds_ph?.poc}</div>
      </td>
      <td className="px-4 py-3">
        <EditableText value={critical.why_critical || ''} onSave={v => onUpdate(critical.id, 'why_critical', v)} />
      </td>
      <td className="px-4 py-3">
        <EditableText value={critical.quarters_pending || ''} placeholder="e.g. Q1, Q2" onSave={v => onUpdate(critical.id, 'quarters_pending', v)} />
      </td>
      <td className="px-4 py-3">
        <EditableText value={critical.last_action || ''} onSave={v => onUpdate(critical.id, 'last_action', v)} />
      </td>
      <td className="px-4 py-3">
        <EditableText value={critical.next_action || ''} onSave={v => onUpdate(critical.id, 'next_action', v)} />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          defaultValue={critical.target_closure || ''}
          onBlur={e => onUpdate(critical.id, 'target_closure', e.target.value)}
          className="text-xs border border-[#e5e5e5] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2563eb] w-full"
        />
      </td>
      <td className="px-4 py-3">
        <EditableText value={critical.status || ''} placeholder="Status..." onSave={v => onUpdate(critical.id, 'status', v)} />
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onUpdate(critical.id, 'escalation', !critical.escalation)}
          className={`text-[11px] px-3 py-1 rounded-full font-medium transition-colors ${
            critical.escalation ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {critical.escalation ? 'Yes' : 'No'}
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onRemove(critical.id)}
          title="Remove from critical"
          className="text-[#999] hover:text-red-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function EditableText({ value, placeholder = 'Click to edit...', onSave }: {
  value: string
  placeholder?: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)

  useEffect(() => { setText(value) }, [value])

  if (editing) {
    return (
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { setEditing(false); onSave(text) }}
        rows={2}
        className="w-full text-xs border border-[#2563eb] rounded-lg px-2 py-1.5 resize-none focus:outline-none text-[#111111]"
        placeholder={placeholder}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="text-xs text-[#666666] cursor-text hover:text-[#111111] min-h-[20px] leading-relaxed"
    >
      {text || <span className="italic opacity-40">{placeholder}</span>}
    </div>
  )
}

function AddCriticalModal({ allPhs, onClose, onSaved }: {
  allPhs: TdsPh[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    ph_id: '',
    why_critical: '',
    quarters_pending: '',
    last_action: '',
    next_action: '',
    target_closure: '',
    escalation: false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.ph_id) return
    setSaving(true)
    await fetch('/api/tds/critical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#111111]">Add Critical PH</h2>
          <button onClick={onClose} className="text-[#666666] hover:text-[#111111]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#666666] mb-1.5">Production House *</label>
            <select
              value={form.ph_id}
              onChange={e => setForm(f => ({ ...f, ph_id: e.target.value }))}
              className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              <option value="">Select PH...</option>
              {allPhs.map(ph => <option key={ph.id} value={ph.id}>{ph.ph_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#666666] mb-1.5">Why Critical</label>
            <textarea rows={2} value={form.why_critical} onChange={e => setForm(f => ({ ...f, why_critical: e.target.value }))}
              className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#2563eb] resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#666666] mb-1.5">Quarters Pending</label>
            <input type="text" placeholder="e.g. Q1, Q2, Q3" value={form.quarters_pending} onChange={e => setForm(f => ({ ...f, quarters_pending: e.target.value }))}
              className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#2563eb]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#666666] mb-1.5">Last Action Taken</label>
            <textarea rows={2} value={form.last_action} onChange={e => setForm(f => ({ ...f, last_action: e.target.value }))}
              className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#2563eb] resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#666666] mb-1.5">Next Action</label>
            <textarea rows={2} value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))}
              className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#2563eb] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#666666] mb-1.5">Target Closure</label>
              <input type="date" value={form.target_closure} onChange={e => setForm(f => ({ ...f, target_closure: e.target.value }))}
                className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#2563eb]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#666666] mb-1.5">Escalation</label>
              <button
                onClick={() => setForm(f => ({ ...f, escalation: !f.escalation }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.escalation ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {form.escalation ? 'Yes — Escalated' : 'No — Normal'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#666666] hover:text-[#111111] transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!form.ph_id || saving}
            className="px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
