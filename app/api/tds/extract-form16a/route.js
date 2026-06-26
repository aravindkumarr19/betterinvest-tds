import { NextResponse } from 'next/server'

// Polyfill DOMMatrix before pdfjs-dist loads (its module scope calls new DOMMatrix())
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0
      this.m11=1;this.m12=0;this.m13=0;this.m14=0
      this.m21=0;this.m22=1;this.m23=0;this.m24=0
      this.m31=0;this.m32=0;this.m33=1;this.m34=0
      this.m41=0;this.m42=0;this.m43=0;this.m44=1
      this.is2D=true;this.isIdentity=true
      if (Array.isArray(init) && init.length === 6) {
        [this.a,this.b,this.c,this.d,this.e,this.f]=init
        this.m11=init[0];this.m12=init[1];this.m21=init[2];this.m22=init[3];this.m41=init[4];this.m42=init[5]
      }
    }
    invertSelf(){return this}
    preMultiplySelf(){return this}
    multiplySelf(){return this}
    scaleSelf(){return this}
    translateSelf(){return this}
    rotateSelf(){return this}
    translate(){return new globalThis.DOMMatrix()}
    scale(){return new globalThis.DOMMatrix()}
    rotate(){return new globalThis.DOMMatrix()}
    inverse(){return new globalThis.DOMMatrix()}
    transformPoint(p){return p||{x:0,y:0,z:0,w:1}}
    static fromMatrix(){return new globalThis.DOMMatrix()}
    static fromFloat32Array(a){return new globalThis.DOMMatrix(Array.from(a))}
    static fromFloat64Array(a){return new globalThis.DOMMatrix(Array.from(a))}
  }
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {
    constructor(){}
    addPath(){}
    moveTo(){}
    lineTo(){}
    closePath(){}
    rect(){}
    arc(){}
    bezierCurveTo(){}
    quadraticCurveTo(){}
  }
}

let _pdfjs = null
async function getPdfjs() {
  if (_pdfjs) return _pdfjs
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
  _pdfjs = mod
  // In Node.js, pdfjs auto-sets #isWorkerDisabled=true and workerSrc="./pdf.worker.mjs"
  // (see PDFWorker static initializer). Do NOT override workerSrc to '' — that breaks it.
  return _pdfjs
}

const PAN_REGEX = /[A-Z]{5}[0-9]{4}[A-Z]/
const DECIMAL_REGEX = /(\d{1,3}(?:,?\d{3})*\.\d{2})/g

function parseDecimal(s) {
  return parseFloat(s.replace(/,/g, ''))
}

async function extractFromPdf(buffer, fileName) {
  const pdfjsLib = await getPdfjs()

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true,
    isEvalSupported: false,
  })
  const doc = await loadingTask.promise

  let pan = null
  let tdsTotal = 0

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const pageWidth = viewport.width
    const textContent = await page.getTextContent()

    // Keep only right-column items (x >= half page width)
    const rightItems = textContent.items
      .filter(item => Array.isArray(item.transform) && item.transform[4] >= pageWidth / 2)
      .sort((a, b) => {
        const dy = b.transform[5] - a.transform[5]
        return Math.abs(dy) > 2 ? dy : a.transform[4] - b.transform[4]
      })

    // Group into text lines by y-position (5pt tolerance)
    const lines = []
    let lineTokens = []
    let lineY = null

    for (const item of rightItems) {
      const y = item.transform[5]
      if (lineY === null || Math.abs(y - lineY) <= 5) {
        lineTokens.push(item.str)
        if (lineY === null) lineY = y
      } else {
        if (lineTokens.length) lines.push(lineTokens.join(' '))
        lineTokens = [item.str]
        lineY = y
      }
    }
    if (lineTokens.length) lines.push(lineTokens.join(' '))

    // Extract PAN (first match across all lines)
    if (!pan) {
      for (const line of lines) {
        const m = line.match(PAN_REGEX)
        if (m) { pan = m[0]; break }
      }
    }

    // Sum TDS: last decimal on lines starting with a digit or "Q"
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const first = trimmed[0]
      if ((first >= '0' && first <= '9') || first === 'Q') {
        const matches = Array.from(trimmed.matchAll(DECIMAL_REGEX))
        if (matches.length > 0) {
          tdsTotal += parseDecimal(matches[matches.length - 1][1])
        }
      }
    }

    if (pan) break
  }

  return {
    document_name: fileName,
    pan: pan || null,
    tds_amount: Math.round(tdsTotal * 100) / 100,
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
          rows.push(await extractFromPdf(buffer, file.name))
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
              rows.push(await extractFromPdf(pdfBuffer, zipFileName))
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
