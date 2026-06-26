import { NextResponse } from 'next/server'

async function extractWithPython(buffer, originalName, baseUrl) {
  const response = await fetch(`${baseUrl}/api/extract_form16a`, {
    method: 'POST',
    body: buffer,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(buffer.length),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Python function error ${response.status}: ${text}`)
  }
  const result = await response.json()
  return {
    document_name: originalName,
    pan: result.pan === 'NOT_FOUND' ? null : result.pan,
    tds_amount: parseFloat(result.tds_amount) || 0,
  }
}

export async function POST(request) {
  // Derive base URL from incoming request so it works across deployments
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

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
          rows.push(await extractWithPython(buffer, file.name, baseUrl))
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
              const result = await extractWithPython(pdfBuffer, zipFileName, baseUrl)
              result.document_name = zipFileName
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
