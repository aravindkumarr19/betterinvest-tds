from http.server import BaseHTTPRequestHandler
import json
import re
import os
import tempfile
import pdfplumber

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

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        # Save PDF to temp file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(body)
            tmp_path = tmp.name

        try:
            result = extract_from_pdf(tmp_path)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
        finally:
            os.unlink(tmp_path)
