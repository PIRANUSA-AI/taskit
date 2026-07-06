import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
  minHeight?: string
}

function getTextOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return -1
  const range = sel.getRangeAt(0)
  const pre = document.createRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString().length
}

function restoreOffset(el: HTMLElement, target: number) {
  const sel = window.getSelection()
  const range = document.createRange()
  let pos = 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
  while (walker.nextNode()) {
    const n = walker.currentNode as Text
    const next = pos + n.length
    if (next >= target) {
      range.setStart(n, target - pos)
      range.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(range)
      return
    }
    pos = next
  }
  range.selectNodeContents(el)
  range.collapse(false)
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function highlightText(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(
    /(@\w[\w.\s]*?\b)|(![\w\s]+?(?=\s|$|[,.]))|(#[^\s#,!]+)/g,
    (m, at, due, tag) => {
      if (at) return `<span class="hl-at" data-user="${at.slice(1)}">${at}</span>`
      if (due) return `<span class="hl-due" data-due="${due.slice(1)}">${due}</span>`
      if (tag) return `<span class="hl-tag" data-tag="${tag.slice(1)}">${tag}</span>`
      return m
    }
  )
}

export function HighlightedInput({ value, onChange, placeholder, maxLength, className = '', minHeight = '80px' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const ignoreNext = useRef(false)
  const navigate = useNavigate()

  const [picker, setPicker] = useState<{ due: string; rect: DOMRect } | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (ignoreNext.current) { ignoreNext.current = false; return }
    const el = ref.current
    const offset = getTextOffset(el)
    const html = value ? highlightText(value) : ''
    if (el.innerHTML !== html) {
      el.innerHTML = html
      if (offset >= 0) restoreOffset(el, offset)
    }
    el.dataset.placeholder = value ? '' : (placeholder ?? '')
  }, [value, placeholder])

  const handleInput = () => {
    if (!ref.current) return
    const text = ref.current.textContent ?? ''
    if (maxLength && text.length > maxLength) {
      ignoreNext.current = true
      ref.current.textContent = text.slice(0, maxLength)
      onChange(text.slice(0, maxLength))
      const r = document.createRange()
      r.selectNodeContents(ref.current)
      r.collapse(false)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(r)
      return
    }
    onChange(text)
  }

  const handleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    const at = t.closest('.hl-at')
    if (at) {
      e.preventDefault()
      const u = at.getAttribute('data-user')
      if (u) navigate(`/profil?user=${encodeURIComponent(u)}`)
      return
    }
    const due = t.closest('.hl-due')
    if (due) {
      e.preventDefault()
      setPicker({ due: due.getAttribute('data-due') ?? '', rect: due.getBoundingClientRect() })
      return
    }
  }

  const pickDate = (day: string) => {
    if (!picker || !ref.current) return
    setPicker(null)
    const text = ref.current.textContent ?? ''
    const idx = text.indexOf(`!${picker.due}`)
    if (idx !== -1) {
      const next = text.slice(0, idx) + `!${day}` + text.slice(idx + picker.due.length + 1)
      onChange(next)
    }
  }

  return (
    <>
      <div className={`relative ${className}`}>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleClick}
          data-placeholder={placeholder ?? ''}
          className="hl-input"
          style={{ minHeight }}
        />
      </div>
      {picker && <DatePicker rect={picker.rect} onPick={pickDate} onClose={() => setPicker(null)} />}
    </>
  )
}

const DAYS = ['besok', 'lusa', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'minggu depan', 'bulan depan', 'hari ini']

function DatePicker({ rect, onPick, onClose }: { rect: DOMRect; onPick: (d: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('click', h), 0)
    return () => document.removeEventListener('click', h)
  }, [onClose])

  return createPortal(
    <div ref={ref} className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-2 w-44"
      style={{ top: rect.bottom + 8 + window.scrollY, left: Math.min(rect.left, window.innerWidth - 200) }}
    >
      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide px-2 py-1">Pilih tenggat</p>
      <div className="mt-1 space-y-0.5">
        {DAYS.map((d) => (
          <button key={d} onClick={() => onPick(d)}
            className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-violet-50 text-ink hover:text-violet-700 transition-colors"
          >{d}</button>
        ))}
      </div>
    </div>,
    document.body
  )
}
