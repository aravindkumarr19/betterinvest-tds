import { NextResponse } from 'next/server'

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://betterinvest-tds.onrender.com'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files')

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Collect all PDFs — from direct uploads and by expanding any ZIPs
    const pdfs = []   // { name: string, buffer: Buffer }
    const failed = [] // { file: string, error: string }

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const nameLower = file.name.toLowerCase()

      if (nameLower.endsWith('.pdf')) {
        pdfs.push({ name: file.name, buffer })
      } else if (nameLower.endsWith('.zip')) {
        try {
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(buffer)
          for (const [zipFileName, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir || !zipFileName.toLowerCase().endsWith('.pdf')) continue
            const pdfBuffer = Buffer.from(await zipEntry.async('arraybuffer'))
            pdfs.push({ name: zipFileName, buffer: pdfBuffer })
          }
        } catch (e) {
          console.error('[extract-form16a] ZIP expand error:', e)
          failed.push({ file: file.name, error: String(e) })
        }
      }
    }

    if (!pdfs.length) {
      return NextResponse.json({ processed: 0, rows: [], failed })
    }

    // Bundle all PDFs into one ZIP and send as a single request to /extract-batch
    const JSZip = (await import('jszip')).default
    const batchZip = new JSZip()
    for (const { name, buffer } of pdfs) {
      batchZip.file(name, buffer)
    }
    const zipBuffer = await batchZip.generateAsync({ type: 'nodebuffer' })

    const batchForm = new FormData()
    batchForm.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'batch.zip')

    const response = await fetch(`${PDF_SERVICE_URL}/extract-batch`, {
      method: 'POST',
      body: batchForm,
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ error: `PDF service error ${response.status}: ${text}` }, { status: 500 })
    }

    const batchResults = await response.json()

    const rows = []
    for (const result of batchResults) {
      if (result.error) {
        failed.push({ file: result.filename, error: result.error })
      } else {
        rows.push({
          document_name: result.filename,
          pan: result.pan === 'NOT_FOUND' ? null : result.pan,
          tds_amount: parseFloat(result.tds_amount) || 0,
        })
      }
    }

    return NextResponse.json({ processed: rows.length, rows, failed })
  } catch (err) {
    console.error('[extract-form16a]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
