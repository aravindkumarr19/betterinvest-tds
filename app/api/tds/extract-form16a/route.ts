import { NextResponse } from 'next/server'

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
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
          const result = await extractPdf(buffer, file.name)
          rows.push(result)
        } catch (e) {
          failed.push({ file: file.name, error: String(e) })
        }
      } else if (name.endsWith('.zip')) {
        try {
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(buffer)
          for (const [zipFileName, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue
            if (!zipFileName.toLowerCase().endsWith('.pdf')) continue
            try {
              const pdfBuffer = Buffer.from(await zipEntry.async('arraybuffer'))
              const result = await extractPdf(pdfBuffer, zipFileName)
              rows.push(result)
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
