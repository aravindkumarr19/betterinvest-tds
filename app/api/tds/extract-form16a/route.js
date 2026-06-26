import { NextResponse } from 'next/server'

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://betterinvest-tds.onrender.com'

async function extractPdf(pdfBuffer, fileName) {
  const formData = new FormData()
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName)

  const response = await fetch(`${PDF_SERVICE_URL}/extract`, {
    method: 'POST',
    body: formData,
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

    const rows = []
    const failed = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const name = file.name.toLowerCase()

      if (name.endsWith('.pdf')) {
        try {
          rows.push(await extractPdf(buffer, file.name))
        } catch (e) {
          console.error('[extract-form16a] PDF error:', e)
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
              console.error('[extract-form16a] ZIP entry error:', e)
              failed.push({ file: zipFileName, error: String(e) })
            }
          }
        } catch (e) {
          console.error('[extract-form16a] ZIP error:', e)
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
