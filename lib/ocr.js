const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

/**
 * Extract patient vitals from a PDF file.
 *
 * Strategy:
 *  1. First try text-based extraction using pdfjs-dist (for digital / searchable PDFs).
 *  2. If text extraction gives too little text, fall back to Tesseract OCR
 *     on the raw PDF (Tesseract can handle some image-based files).
 *
 * Returns an object with the extracted vitals values.
 */
async function extractVitalsFromPDF(filePath) {
  // ── Step 1: Try text-based extraction with pdfjs-dist ──
  let rawText = "";
  try {
    rawText = await extractTextWithPDFJS(filePath);
  } catch (err) {
    console.warn("pdfjs-dist extraction failed, will fall back to OCR:", err.message);
  }

  // ── Step 2: If text is too short, use Tesseract OCR ──
  if (rawText.trim().length < 30) {
    console.log("📸 Text-based extraction insufficient, running Tesseract OCR…");
    rawText = await runTesseractOCR(filePath);
  }

  console.log("── Extracted raw text (first 500 chars) ──");
  console.log(rawText.substring(0, 500));

  // ── Step 3: Parse vitals from text ──
  const vitals = parseVitals(rawText);
  vitals.notes = rawText;

  return vitals;
}

/**
 * Extract text from a PDF using Mozilla's pdfjs-dist.
 * Works with searchable / digitally-created PDFs.
 */
async function extractTextWithPDFJS(filePath) {
  // pdfjs-dist is ESM in v4+, so we dynamic-import it
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  let fullText = "";

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

/**
 * Run Tesseract OCR on an image file (PNG, JPG, TIFF, etc.).
 * For scanned PDFs that have been converted to images.
 */
async function runTesseractOCR(filePath) {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(filePath, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          process.stdout.write(
            `\r  OCR progress: ${(m.progress * 100).toFixed(0)}%`
          );
        }
      },
    });
    console.log(""); // newline after progress
    return text;
  } catch (err) {
    console.error("Tesseract OCR error:", err.message);
    return "";
  }
}

/**
 * Parse vitals from extracted text using flexible regex patterns.
 *
 * Supported formats in the PDF:
 *   - "Blood Pressure: 120/80 mmHg"  or  "BP: 120 / 80"
 *   - "Heart Rate: 72 bpm"           or  "Pulse: 72"
 *   - "Oxygen Level: 98%"            or  "SpO2: 98"
 *   - "Blood Glucose: 110 mg/dL"     or  "Glucose: 110"
 *   - "Sleep Hours: 7.5"             or  "Sleep: 7.5 hrs"
 */
function parseVitals(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  return {
    bp_systolic: extractNumber(
      cleaned,
      /(?:blood\s*pressure|bp|b\.p)\s*[:\-]?\s*(\d{2,3})\s*[\/\\]\s*\d{2,3}/i,
      1
    ),
    bp_diastolic: extractNumber(
      cleaned,
      /(?:blood\s*pressure|bp|b\.p)\s*[:\-]?\s*\d{2,3}\s*[\/\\]\s*(\d{2,3})/i,
      1
    ),
    heart_rate: extractNumber(
      cleaned,
      /(?:heart\s*rate|pulse|hr)\s*[:\-]?\s*(\d{2,3})/i,
      1
    ),
    oxygen_level: extractNumber(
      cleaned,
      /(?:oxygen\s*(?:level|saturation)?(?:\s*\(?spo2\)?)?\s*|spo2|sp\s*o2|o2\s*sat)\s*[:\-]?\s*(\d{2,3})/i,
      1
    ),
    blood_glucose: extractNumber(
      cleaned,
      /(?:blood\s*glucose|glucose|sugar|fasting\s*glucose|random\s*glucose|blood\s*sugar)\s*[:\-]?\s*(\d{2,3})/i,
      1
    ),
    sleep_hours: extractFloat(
      cleaned,
      /(?:sleep\s*(?:hours|duration|hrs)?)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)/i,
      1
    ),
  };
}

/**
 * Helper: extract an integer value from text using a regex.
 */
function extractNumber(text, regex, group = 1) {
  const match = text.match(regex);
  if (match && match[group]) {
    const num = parseInt(match[group], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Helper: extract a float value from text using a regex.
 */
function extractFloat(text, regex, group = 1) {
  const match = text.match(regex);
  if (match && match[group]) {
    const num = parseFloat(match[group]);
    return isNaN(num) ? null : num;
  }
  return null;
}

module.exports = { extractVitalsFromPDF, parseVitals };
