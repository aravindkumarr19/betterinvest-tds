import { NextResponse } from 'next/server'

// pdfjs-dist (used by pdf-parse) references the browser-only DOMMatrix API.
// Polyfill it at module scope before pdf-parse is loaded.
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === 'undefined') {
  class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    m11 = 1; m12 = 0; m13 = 0; m14 = 0
    m21 = 0; m22 = 1; m23 = 0; m24 = 0
    m31 = 0; m32 = 0; m33 = 1; m34 = 0
    m41 = 0; m42 = 0; m43 = 0; m44 = 1
    is2D = true; isIdentity = true
    constructor(init?: string | number[]) {
      if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init
        this.m11 = init[0]; this.m12 = init[1]
        this.m21 = init[2]; this.m22 = init[3]
        this.m41 = init[4]; this.m42 = init[5]
      }
    }
    multiply() { return this }
    translate() { return this }
    scale() { return this }
    rotate() { return this }
    inverse() { return this }
    transformPoint(p: { x: number; y: number }) { return p }
    static fromMatrix(m: unknown) { return new DOMMatrix(m as number[]) }
    static fromFloat32Array(a: Float32Array) { return new DOMMatrix(Array.from(a)) }
    static fromFloat64Array(a: Float64Array) { return new DOMMatrix(Array.from(a)) }
  }
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix
}

// Require at module scope so Next.js bundler doesn't mangle the call inside
// an async function (which causes "i is not a function" in minified output).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _pdfParseRaw = require('pdf-parse')
// pdf-parse may expose the function as the export itself OR via .default
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  typeof _pdfParseRaw === 'function' ? _pdfParseRaw : _pdfParseRaw.default

const PAN_REGEX = /[A-Z]{5}[0-9]{4}[A-Z]/
const DECIMAL_REGEX = /(\d{1,3}(?:,?\d{3})*\.\d{2})/g

function parseDecimal(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

function extractFromText(text: string): { pan: string | null; tds_amount: number } {
  const panMatch = text.match(PAN_REGEX)
  const pan = panMatch ? panMatch[0] : null

  const lines = text.split('\n')
  let total = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const firstChar = trimmed[0]
    if ((firstChar >= '0' && firstChar <= '9') || firstChar === 'Q') {
      const matches = Array.from(trimmed.matchAll(DECIMAL_REGEX))
      if (matches.length > 0) {
        const last = matches[matches.length - 1][1]
        total += parseDecimal(last)
      }
    }
  }

  return { pan, tds_amount: total }
}

async function extractPdf(buffer: Buffer, fileName: string): Promise<{ document_name: string; pan: string | null; tds_amount: number }> {
  const data = await pdfParse(buffer)
  const { pan, tds_amount } = extractFromText(data.text)
  return { document_name: fileName, pan, tds_amount }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const rows: { document_name: string; pan: string | null; tds_amount: number }[] = []
    const failed: { file: string; error: string }[] = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const name = file.name.toLowerCase()

      if (name.endsWith('.pdf')) {
        try {
          rows.push(await extractPdf(buffer, file.name))
        } catch (e) {
          failed.push({ file: file.name, error: String(e) })
        }
      } else if (name.endsWith('.zip')) {
        try {
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(buffer)
          for (const [zipFileName, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir || !zipFileName.toLowerCase().endsWith('.pdf')) continue
            try {
              const pdfBuffer = Buffer.from(await zipEntry.async('arraybuffer'))
              rows.push(await extractPdf(pdfBuffer, zipFileName))
            } catch (e) {
              failed.push({ file: zipFileName, error: String(e) })
            }
          }
        } catch (e) {
          failed.push({ file: file.name, error: String(e) })
        }
      }
    }

    return NextResponse.json({ processed: rows.length, rows, failed })
  } catch (err) {
    console.error('[extract-form16a]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
