'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'form16a' | 'tracker' | 'reconciliation'
type UploadSubTab = 'pdf' | 'zip'

interface Form16ARow {
  id: string
  document_name: string | null
  pan: string | null
  tds_amount: number | null
  uploaded_at: string
}

interface TrackerRow {
  id: string
  pan: string
  tds_amount: number | null
  created_at: string
}

interface RecRow {
  pan: string
  tracker_amount: number | null
  form16a_amount: number | null
  difference: number | null
  status: 'Matched' | 'TDS Mismatch' | 'Form 16A Not Received'
  coverage: 'Received' | 'Not Received'
}

interface ExtractedResult {
  document_name: string
  pan: string | null
  tds_amount: number
}

interface FailedFile {
  file: string
  error: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusBadge(status: RecRow['status']) {
  if (status === 'Matched') return 'bg-green-100 text-green-700'
  if (status === 'TDS Mismatch') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function TdsReconciliation() {
  const [tab, setTab] = useState<Tab>('form16a')

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#111111]">TDS Reconciliation</h1>
          <p className="text-sm text-[#666666] mt-0.5">Upload Form 16A, manage tracker, and reconcile TDS amounts</p>
        </div>

        <div className="flex gap-1 mb-6 border-b border-[#e5e5e5]">
          {([
            { key: 'form16a', label: 'Form 16A Upload' },
            { key: 'tracker', label: 'TDS Tracker' },
            { key: 'reconciliation', label: 'Reconciliation' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-[#6c47ff] text-[#6c47ff]'
                  : 'border-transparent text-[#666666] hover:text-[#111111]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'form16a' && <Form16ATab />}
        {tab === 'tracker' && <TrackerTab />}
        {tab === 'reconciliation' && <ReconciliationTab />}
      </div>
    </div>
  )
}

// ─── Tab 1: Form 16A Upload ───────────────────────────────────────────────────

function Form16ATab() {
  const [subTab, setSubTab] = useState<UploadSubTab>('pdf')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedResult[]>([])
  const [failed, setFailed] = useState<FailedFile[]>([])
  const [saved, setSaved] = useState<Form16ARow[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const fetchSaved = useCallback(async () => {
    const res = await fetch('/api/tds/form16a')
    if (res.ok) setSaved(await res.json())
  }, [])

  useEffect(() => { fetchSaved() }, [fetchSaved])

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    if (!arr.length) return
    setUploadError(null)
    setFailed([])
    setProgress(10)

    const fd = new FormData()
    arr.forEach(f => fd.append('files', f))

    try {
      setProgress(40)
      const res = await fetch('/api/tds/extract-form16a', { method: 'POST', body: fd })
      setProgress(80)
      if (!res.ok) {
        const body = await res.json()
        setUploadError(body.error || 'Extraction failed')
        setProgress(null)
        return
      }
      const data: { processed: number; rows: ExtractedResult[]; failed: FailedFile[] } = await res.json()
      setExtracted(prev => [...prev, ...data.rows])
      setFailed(prev => [...prev, ...data.failed])
      setProgress(100)
      setTimeout(() => setProgress(null), 800)
    } catch (e) {
      setUploadError(String(e))
      setProgress(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  async function saveAll() {
    if (!extracted.length) return
    setSaving(true)
    await fetch('/api/tds/form16a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extracted),
    })
    setSaving(false)
    setExtracted([])
    setFailed([])
    fetchSaved()
  }

  async function clearAll() {
    setClearing(true)
    await fetch('/api/tds/form16a', { method: 'DELETE' })
    setSaved([])
    setExtracted([])
    setFailed([])
    setClearing(false)
  }

  async function deleteRow(id: string) {
    await fetch(`/api/tds/form16a?id=${id}`, { method: 'DELETE' })
    setSaved(prev => prev.filter(r => r.id !== id))
  }

  const inputRef = subTab === 'pdf' ? pdfInputRef : zipInputRef

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-[#f0f0f0] rounded-lg p-1 w-fit">
        {([
          { key: 'pdf', label: 'Upload PDFs' },
          { key: 'zip', label: 'Upload ZIP' },
        ] as { key: UploadSubTab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              subTab === t.key ? 'bg-white text-[#111111] shadow-sm' : 'text-[#666666] hover:text-[#111111]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#6c47ff] bg-[#ede9ff]/30' : 'border-[#e5e5e5] hover:border-[#6c47ff] bg-white'
        }`}
      >
        <input ref={pdfInputRef} type="file" accept=".pdf" multiple className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)} />
        <input ref={zipInputRef} type="file" accept=".zip" className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)} />

        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-[#6c47ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[#111111]">
              {subTab === 'pdf' ? 'Drop PDF files here, or click to browse' : 'Drop a ZIP file here, or click to browse'}
            </p>
            <p className="text-xs text-[#666666] mt-1">
              {subTab === 'pdf' ? 'Select one or more PDF files' : 'Select a single ZIP archive containing PDFs'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {progress !== null && (
        <div className="w-full bg-[#e5e5e5] rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-[#6c47ff] h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {uploadError && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{uploadError}</p>
      )}

      {/* Failed files */}
      {failed.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 mb-2">Failed to process ({failed.length})</p>
          <ul className="space-y-1">
            {failed.map((f, i) => (
              <li key={i} className="text-xs text-red-600">
                <span className="font-mono font-medium">{f.file}</span> — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Extracted preview */}
      {extracted.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111111]">Extracted ({extracted.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setExtracted([]); setFailed([]) }}
                className="px-3 py-1.5 text-xs font-medium text-[#666666] border border-[#e5e5e5] rounded-lg hover:bg-[#fafafa] transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={saveAll}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium bg-[#6c47ff] text-white rounded-lg hover:bg-[#5a38e0] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save to Database'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e5e5e5]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Document Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">PAN</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#666666] uppercase tracking-wider">TDS Amount</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[#666666] uppercase tracking-wider">Remove</th>
                </tr>
              </thead>
              <tbody>
                {extracted.map((row, i) => (
                  <tr key={i} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#fafafa]">
                    <td className="px-5 py-3 text-[#111111] font-medium max-w-[220px] truncate">{row.document_name}</td>
                    <td className="px-5 py-3 font-mono text-[#111111]">{row.pan || <span className="text-[#aaa]">Not found</span>}</td>
                    <td className="px-5 py-3 text-right text-[#111111]">{fmt(row.tds_amount)}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => setExtracted(prev => prev.filter((_, j) => j !== i))}
                        className="text-[#666666] hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saved records */}
      {saved.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111111]">Saved Records ({saved.length})</h2>
            <button
              onClick={clearAll}
              disabled={clearing}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e5e5e5]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Document Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">PAN</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#666666] uppercase tracking-wider">TDS Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Uploaded</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[#666666] uppercase tracking-wider">Delete</th>
                </tr>
              </thead>
              <tbody>
                {saved.map(row => (
                  <tr key={row.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#fafafa]">
                    <td className="px-5 py-3 text-[#111111] max-w-[220px] truncate">{row.document_name || '—'}</td>
                    <td className="px-5 py-3 font-mono text-[#111111]">{row.pan || <span className="text-[#aaa]">—</span>}</td>
                    <td className="px-5 py-3 text-right text-[#111111]">{fmt(row.tds_amount)}</td>
                    <td className="px-5 py-3 text-xs text-[#666666]">
                      {new Date(row.uploaded_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => deleteRow(row.id)} className="text-[#666666] hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {saved.length === 0 && extracted.length === 0 && progress === null && (
        <p className="text-sm text-[#666666] text-center py-4">No Form 16A records yet. Upload files above.</p>
      )}
    </div>
  )
}

// ─── Tab 2: TDS Tracker ───────────────────────────────────────────────────────

interface EditableTrackerRow extends TrackerRow {
  _dirty?: boolean
  _new?: boolean
}

function TrackerTab() {
  const [rows, setRows] = useState<EditableTrackerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const pasteRef = useRef<HTMLTextAreaElement>(null)

  const fetchRows = useCallback(async () => {
    const res = await fetch('/api/tds/tracker')
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  function updateCell(id: string, field: 'pan' | 'tds_amount', value: string) {
    setRows(prev => prev.map(r => r.id === id
      ? { ...r, [field]: field === 'tds_amount' ? (value === '' ? null : parseFloat(value.replace(/₹/g, '').replace(/,/g, '').trim().replace(/[^0-9.-]/g, ''))) : value, _dirty: true }
      : r
    ))
  }

  async function saveRow(row: EditableTrackerRow) {
    setSaving(row.id)
    if (row._new) {
      const res = await fetch('/api/tds/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pan: row.pan, tds_amount: row.tds_amount }),
      })
      if (res.ok) {
        const [saved] = await res.json()
        setRows(prev => prev.map(r => r.id === row.id ? { ...saved, _dirty: false, _new: false } : r))
      }
    } else {
      await fetch(`/api/tds/tracker/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pan: row.pan, tds_amount: row.tds_amount }),
      })
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, _dirty: false } : r))
    }
    setSaving(null)
  }

  async function deleteRow(id: string, isNew: boolean) {
    if (!isNew) await fetch(`/api/tds/tracker/${id}`, { method: 'DELETE' })
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function clearAll() {
    setClearing(true)
    await fetch('/api/tds/tracker', { method: 'DELETE' })
    setRows([])
    setClearing(false)
  }

  function addRow() {
    const tempId = `new-${Date.now()}`
    setRows(prev => [{ id: tempId, pan: '', tds_amount: null, created_at: new Date().toISOString(), _dirty: true, _new: true }, ...prev])
  }

  async function handlePaste() {
    const text = pasteRef.current?.value || ''
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const newRows: { pan: string; tds_amount: number | null }[] = []
    for (const line of lines) {
      const upper = line.toUpperCase()
      const panMatch = upper.match(/[A-Z]{5}[0-9]{4}[A-Z]/)
      if (!panMatch) continue
      const pan = panMatch[0]
      const afterPan = line.slice((panMatch.index ?? 0) + 10)
      const cleaned = afterPan.replace(/₹/g, '').replace(/,/g, '').trim().replace(/[^0-9.-]/g, '')
      const amt = parseFloat(cleaned)
      newRows.push({ pan, tds_amount: isNaN(amt) ? null : amt })
    }
    if (!newRows.length) return
    const res = await fetch('/api/tds/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRows),
    })
    if (res.ok) {
      setShowPaste(false)
      if (pasteRef.current) pasteRef.current.value = ''
      fetchRows()
    }
  }

  if (loading) return <p className="text-sm text-[#666666]">Loading...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={addRow}
          className="px-3 py-1.5 text-xs font-medium bg-[#6c47ff] text-white rounded-lg hover:bg-[#5a38e0] transition-colors">
          + Add Row
        </button>
        <button onClick={() => setShowPaste(v => !v)}
          className="px-3 py-1.5 text-xs font-medium border border-[#e5e5e5] text-[#666666] rounded-lg hover:bg-[#fafafa] transition-colors">
          Paste Import
        </button>
        {rows.some(r => !r._new) && (
          <button onClick={clearAll} disabled={clearing}
            className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto">
            {clearing ? 'Clearing...' : 'Clear All'}
          </button>
        )}
      </div>

      {showPaste && (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 space-y-3">
          <p className="text-xs text-[#666666]">Paste tab-separated or comma-separated rows (PAN, TDS Amount):</p>
          <textarea ref={pasteRef} rows={6}
            className="w-full border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm font-mono text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#6c47ff]"
            placeholder={'ABCDE1234F\t12345.00\nXYZAB5678G\t9876.50'} />
          <div className="flex gap-2">
            <button onClick={handlePaste}
              className="px-3 py-1.5 text-xs font-medium bg-[#6c47ff] text-white rounded-lg hover:bg-[#5a38e0] transition-colors">
              Import
            </button>
            <button onClick={() => setShowPaste(false)}
              className="px-3 py-1.5 text-xs font-medium border border-[#e5e5e5] text-[#666666] rounded-lg hover:bg-[#fafafa] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-[#666666] text-center py-8">No tracker entries yet. Add a row or paste data above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e5e5e5]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">PAN</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#666666] uppercase tracking-wider">TDS Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Added</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[#666666] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className={`border-b border-[#e5e5e5] last:border-0 ${row._dirty ? 'bg-[#fffbe6]' : 'hover:bg-[#fafafa]'}`}>
                    <td className="px-5 py-2.5">
                      <input type="text" value={row.pan}
                        onChange={e => updateCell(row.id, 'pan', e.target.value.toUpperCase())}
                        onBlur={() => row._dirty && !row._new && saveRow(row)}
                        className="w-full font-mono text-sm text-[#111111] bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#6c47ff] rounded px-1"
                        placeholder="PAN" />
                    </td>
                    <td className="px-5 py-2.5">
                      <input type="number" value={row.tds_amount ?? ''}
                        onChange={e => updateCell(row.id, 'tds_amount', e.target.value)}
                        onBlur={() => row._dirty && !row._new && saveRow(row)}
                        className="w-full text-sm text-right text-[#111111] bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#6c47ff] rounded px-1"
                        placeholder="0.00" />
                    </td>
                    <td className="px-5 py-2.5 text-xs text-[#666666]">
                      {row._new ? '—' : new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {row._dirty && (
                          <button onClick={() => saveRow(row)} disabled={saving === row.id}
                            className="text-xs px-2 py-1 bg-[#6c47ff] text-white rounded hover:bg-[#5a38e0] transition-colors disabled:opacity-50">
                            {saving === row.id ? '...' : 'Save'}
                          </button>
                        )}
                        <button onClick={() => deleteRow(row.id, !!row._new)}
                          className="text-[#666666] hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab 3: Reconciliation ────────────────────────────────────────────────────

function ReconciliationTab() {
  const [rows, setRows] = useState<RecRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/tds/reconciliation')
    if (res.ok) setRows(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const total = rows.length
  const received = rows.filter(r => r.coverage === 'Received').length
  const pending = rows.filter(r => r.coverage === 'Not Received').length
  const matched = rows.filter(r => r.status === 'Matched').length
  const mismatched = rows.filter(r => r.status === 'TDS Mismatch').length
  const accuracy = received > 0 ? Math.round((matched / received) * 100) : 0

  if (loading) return <p className="text-sm text-[#666666]">Loading...</p>

  return (
    <div className="space-y-6">
      {/* 6 stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total PANs in Tracker" value={total} sub="unique PANs" color="text-[#111111]" />
        <StatCard label="Form 16A Received" value={received} sub="PANs with Form 16A" color="text-green-600" />
        <StatCard label="Form 16A Pending" value={pending} sub="PANs missing Form 16A" color="text-amber-600" />
        <StatCard label="Matched" value={matched} sub="TDS difference ≤ ₹5" color="text-green-600" />
        <StatCard label="Mismatched" value={mismatched} sub="TDS difference > ₹5" color="text-red-600" />
        <StatCard label="Accuracy" value={`${accuracy}%`} sub="of received PANs matched" color={accuracy >= 80 ? 'text-green-600' : accuracy >= 50 ? 'text-amber-600' : 'text-red-600'} />
      </div>

      <div className="flex justify-end">
        <button onClick={fetchData}
          className="px-3 py-1.5 text-xs font-medium border border-[#e5e5e5] text-[#666666] rounded-lg hover:bg-[#fafafa] transition-colors">
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-8 text-center">
          <p className="text-sm text-[#666666]">No data. Add entries to TDS Tracker and upload Form 16A to see reconciliation.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#e5e5e5]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">PAN</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#666666] uppercase tracking-wider">Tracker TDS</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#666666] uppercase tracking-wider">Form 16A TDS</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[#666666] uppercase tracking-wider">Difference</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#666666] uppercase tracking-wider">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#fafafa]">
                    <td className="px-5 py-3 font-mono font-medium text-[#111111]">{row.pan}</td>
                    <td className="px-5 py-3 text-right text-[#111111]">{fmt(row.tracker_amount)}</td>
                    <td className="px-5 py-3 text-right text-[#111111]">{fmt(row.form16a_amount)}</td>
                    <td className="px-5 py-3 text-right text-[#111111]">{row.difference !== null ? fmt(row.difference) : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.coverage === 'Received' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {row.coverage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e5e5] p-5">
      <div className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-[#666666] mt-1">{sub}</div>
    </div>
  )
}
