from flask import Flask, request, jsonify
import re, os, io, tempfile, zipfile, pdfplumber

app = Flask(__name__)
PAN_REGEX = r'[A-Z]{5}[0-9]{4}[A-Z]'

def extract_from_pdf(pdf_path):
    deductee_pan = "NOT_FOUND"
    tds_amount = "0.00"
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            width = page.width
            height = page.height
            right_column = page.within_bbox((width / 2, 0, width, height))
            text = right_column.extract_text()
            if text:
                pan_match = re.search(PAN_REGEX, text)
                if pan_match:
                    deductee_pan = pan_match.group()
                total_tds = 0.0
                for line in text.split("\n"):
                    if re.search(r'^\d', line) or line.startswith("Q"):
                        values = re.findall(r"(\d{1,3}(?:,?\d{3})*\.\d{2})", line)
                        if values:
                            total_tds += float(values[-1].replace(",", ""))
                if total_tds > 0:
                    tds_amount = f"{total_tds:.2f}"
            if deductee_pan != "NOT_FOUND":
                break
    return {"filename": os.path.basename(pdf_path), "pan": deductee_pan, "tds_amount": tds_amount}

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/extract", methods=["POST"])
def extract():
    file = request.files.get("file")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        file.save(tmp.name)
        result = extract_from_pdf(tmp.name)
        os.unlink(tmp.name)
    return jsonify(result)

@app.route("/extract-batch", methods=["POST"])
def extract_batch():
    file = request.files.get("file")
    results = []
    with zipfile.ZipFile(io.BytesIO(file.read())) as zf:
        for entry in zf.infolist():
            if entry.is_dir() or not entry.filename.lower().endswith('.pdf'):
                continue
            original_name = os.path.basename(entry.filename)
            try:
                pdf_bytes = zf.read(entry.filename)
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(pdf_bytes)
                    tmp_path = tmp.name
                result = extract_from_pdf(tmp_path)
                os.unlink(tmp_path)
                result['filename'] = original_name
                results.append(result)
            except Exception as e:
                results.append({"filename": original_name, "pan": "NOT_FOUND", "tds_amount": "0.00", "error": str(e)})
    return jsonify(results)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
