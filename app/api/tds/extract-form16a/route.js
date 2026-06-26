import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

async function extractWithPython(buffer, originalName) {
  const fileName = `${Date.now()}_${safeName(originalName)}`
  const tmpPath = join(tmpdir(), fileName)
  const scriptPath = join(process.cwd(), 'scripts', 'extract_form16a.py')

  try {
    writeFileSync(tmpPath, buffer)
    const stdout = execSync(`python3 "${scriptPath}" "${tmpPath}"`, {
      timeout: 30000,
      encoding: 'utf8',
    })
    const result = JSON.parse(stdout.trim())
    return {
      document_name: originalName,
      pan: result.pan === 'NOT_FOUND' ? null : result.pan,
      tds_amount: parseFloat(result.tds_amount) || 0,
    }
  } finally {
    if (existsSync(tmpPath)) unlinkSync(tmpPath)
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
          rows.push(await extractWithPython(buffer, file.name))
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
              const baseName = zipFileName.split('/').pop() || zipFileName
              const result = await extractWithPython(pdfBuffer, baseName)
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
