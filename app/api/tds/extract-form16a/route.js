import { NextResponse } from 'next/server'

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://betterinvest-tds.onrender.com'

async function extractPdf(pdfBuffer, fileName) {
  const formData = new FormData()
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName)

  const response = await fetch(`${PDF_SERVICE_URL}/extract`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`PDF service error ${response.status}: ${text}`)
  }

  const result = await response.json()
  return {
    document_name: fileName,
    pan: result.pan === 'NOT_FOUND' ? null : result.pan,
    tds_amount: parseFloat(result.tds_amount) || 0,
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files')

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Collect all (buffer, name) pairs, expanding ZIPs inline
    const tasks = []
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const name = file.name.toLowerCase()

      if (name.endsWith('.pdf')) {
        tasks.push({ buffer, name: file.name })
      } else if (name.endsWith('.zip')) {
        try {
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(buffer)
          for (const [zipFileName, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir || !zipFileName.toLowerCase().endsWith('.pdf')) continue
            const pdfBuffer = Buffer.from(await zipEntry.async('arraybuffer'))
            tasks.push({ buffer: pdfBuffer, name: zipFileName })
          }
        } catch (e) {
          console.error('[extract-form16a] ZIP error:', e)
          // Return a failed entry for the whole ZIP; individual entries weren't reachable
          tasks.push({ buffer: null, name: file.name, zipError: String(e) })
        }
      }
    }

    // Send all PDFs to the Render service in parallel
    const results = await Promise.all(
      tasks.map(async ({ buffer, name, zipError }) => {
        if (zipError) return { type: 'failed', file: name, error: zipError }
        try {
          const row = await extractPdf(buffer, name)
          return { type: 'ok', row }
        } catch (e) {
          console.error('[extract-form16a] PDF error:', e)
          return { type: 'failed', file: name, error: String(e) }
        }
      })
    )

    const rows = results.filter(r => r.type === 'ok').map(r => r.row)
    const failed = results.filter(r => r.type === 'failed').map(r => ({ file: r.file, error: r.error }))

    return NextResponse.json({ processed: rows.length, rows, failed })
  } catch (err) {
    console.error('[extract-form16a]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
