import sys
import re
import json
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
    return {"filename": pdf_path.split("/")[-1], "pan": deductee_pan, "tds_amount": tds_amount}

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    result = extract_from_pdf(pdf_path)
    print(json.dumps(result))
