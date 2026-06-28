'use client'

import { useState, useEffect, useRef } from 'react'
import type { TdsPh, TdsQuarter, TdsMessage, Quarter } from '@/lib/types'
import { QUARTERS, TEAM_MEMBERS } from '@/lib/types'
import StatusDropdown from './StatusDropdown'

interface Props {
  ph: TdsPh
  currentUser: string
  onClose: () => void
  onUpdate: () => void
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

export default function PHDetailPanel({ ph, currentUser, onClose, onUpdate }: Props) {
  const [quarters, setQuarters] = useState<Record<string, TdsQuarter>>({})
  const [messages, setMessages] = useState<TdsMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [mentionSearch, setMentionSearch] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [status, setStatus] = useState(ph.overall_status)
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const displayName = getDisplayName(currentUser)

  useEffect(() => {
    fetchAllQuarters()
    fetchMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ph.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchAllQuarters() {
    const data: Record<string, TdsQuarter> = {}
    await Promise.all(
      QUARTERS.map(async q => {
        const res = await fetch(`/api/tds/quarters?ph_id=${ph.id}&quarter=${q.key}`)
        if (res.ok) {
          const arr = await res.json()
          if (arr.length > 0) data[q.key] = arr[0]
        }
      })
    )
    setQuarters(data)
  }

  async function fetchMessages() {
    const res = await fetch(`/api/tds/messages?ph_id=${ph.id}`)
    if (res.ok) setMessages(await res.json())
  }

  async function toggleCheckbox(quarter: Quarter, field: 'challan_done' | 'form_26q_done' | 'form_16a_done') {
    const q = quarters[quarter]
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
      if (res.ok) {
        await fetchAllQuarters()
        onUpdate()
        return
      }
    }
    setQuarters(prev => ({
      ...prev,
      [quarter]: {
        ...(prev[quarter] || { id: '', ph_id: ph.id, quarter, challan_done: false, form_26q_done: false, form_16a_done: false, comment: null, updated_at: '' }),
        [field]: newVal,
      },
    }))
    onUpdate()
  }

  async function updateComment(quarter: Quarter, comment: string) {
    const q = quarters[quarter]
    if (q?.id) {
      await fetch(`/api/tds/quarters/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
    }
    setQuarters(prev => ({
      ...prev,
      [quarter]: { ...prev[quarter], comment },
    }))
  }

  function handleMessageChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setNewMessage(val)
    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1 && atIdx === val.length - 1 - (val.slice(atIdx + 1).indexOf(' ') === -1 ? 0 : val.slice(atIdx + 1).indexOf(' '))) {
      const search = val.slice(atIdx + 1)
      if (!search.includes(' ')) {
        setMentionSearch(search)
        setShowMentions(true)
        setMentionIndex(0)
        return
      }
    }
    setShowMentions(false)
  }

  function insertMention(name: string) {
    const atIdx = newMessage.lastIndexOf('@')
    setNewMessage(newMessage.slice(0, atIdx) + '@' + name + ' ')
    setShowMentions(false)
    inputRef.current?.focus()
  }

  const filteredMembers = TEAM_MEMBERS.filter(m =>
    m.toLowerCase().startsWith(mentionSearch.toLowerCase())
  )

  async function sendMessage() {
    if (!newMessage.trim()) return
    setSending(true)
    await fetch('/api/tds/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ph_id: ph.id, content: newMessage.trim(), sender_name: displayName }),
    })
    setNewMessage('')
    await fetchMessages()
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentions) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMembers.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (filteredMembers[mentionIndex]) insertMention(filteredMembers[mentionIndex]) }
      if (e.key === 'Escape') setShowMentions(false)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Panel */}
      <div
        className="relative w-[500px] bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[#111111] text-base leading-tight truncate">{ph.ph_name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-[#666666]">{ph.poc}</span>
              <StatusDropdown
                phId={ph.id}
                status={status}
                onStatusChange={newStatus => { setStatus(newStatus); onUpdate() }}
                size="xs"
              />
              {ph.is_critical && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Critical</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onClose} className="text-[#666666] hover:text-[#111111] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Quarter grid */}
          <div className="p-5">
            <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Filing Status</h3>
            <div className="grid grid-cols-2 gap-3">
              {QUARTERS.map(({ key, label }) => {
                const q = quarters[key]
                return (
                  <div key={key} className="border border-[#e5e5e5] rounded-xl p-3 bg-[#fafafa]">
                    <div className="text-xs font-semibold text-[#111111] mb-2.5">{label.replace(' — ', ' ')}</div>
                    <div className="space-y-1.5">
                      {[
                        { field: 'challan_done' as const, label: 'Challan' },
                        { field: 'form_26q_done' as const, label: 'Form 26Q' },
                        { field: 'form_16a_done' as const, label: 'Form 16A' },
                      ].map(({ field, label: fl }) => (
                        <label key={field} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q?.[field] ?? false}
                            onChange={() => toggleCheckbox(key, field)}
                            className="flex-shrink-0"
                          />
                          <span className="text-xs text-[#666666]">{fl}</span>
                        </label>
                      ))}
                    </div>
                    <QuarterComment
                      value={q?.comment ?? ''}
                      onSave={comment => updateComment(key, comment)}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Conversation */}
          <div className="px-5 pb-2">
            <h3 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Conversation</h3>
            <div className="space-y-3 min-h-[80px]">
              {messages.length === 0 ? (
                <p className="text-xs text-[#666666] text-center py-4">No messages yet. Start the conversation.</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {msg.sender_name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-semibold text-[#111111]">{msg.sender_name}</span>
                        <span className="text-[10px] text-[#666666]">
                          {new Date(msg.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-[#333333] mt-0.5 leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: msg.content.replace(/@(\w+)/g, '<span class="text-[#2563eb] font-medium">@$1</span>')
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>

        {/* Message input */}
        <div className="border-t border-[#e5e5e5] p-4 bg-white">
          <div className="relative">
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-[#e5e5e5] rounded-lg shadow-lg overflow-hidden z-10">
                {filteredMembers.map((m, i) => (
                  <div
                    key={m}
                    onClick={() => insertMention(m)}
                    className={`px-3 py-2 text-xs cursor-pointer transition-colors ${i === mentionIndex ? 'bg-[#dbeafe] text-[#2563eb]' : 'text-[#111111] hover:bg-[#fafafa]'}`}
                  >
                    @{m}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                placeholder="Message... (@ to mention, Enter to send)"
                rows={2}
                className="flex-1 resize-none border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#111111] placeholder:text-[#999] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="px-3 py-2 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 self-end flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuarterComment({ value, onSave }: { value: string; onSave: (v: string) => void }) {
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
        className="w-full mt-2 text-xs border border-[#2563eb] rounded-lg px-2 py-1.5 resize-none focus:outline-none text-[#111111]"
        placeholder="Add comment..."
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="mt-2 text-xs text-[#666666] min-h-[20px] cursor-text hover:text-[#111111] transition-colors"
    >
      {text || <span className="italic opacity-50">Add comment...</span>}
    </div>
  )
}
