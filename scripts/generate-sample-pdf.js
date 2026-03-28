/**
 * Generate a sample Patient Vitals PDF for testing the OCR extraction.
 *
 * Run:  node scripts/generate-sample-pdf.js
 *
 * Output: server/sample-vitals-report.pdf
 */

const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

async function generateSamplePDF() {
  const pdf = PDFDocument.create ? await PDFDocument.create() : null;
  if (!pdf) {
    console.error("Failed to create PDF document");
    process.exit(1);
  }

  const page = pdf.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();

  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);

  const blue = rgb(0.15, 0.25, 0.55);
  const darkGray = rgb(0.2, 0.2, 0.2);
  const medGray = rgb(0.45, 0.45, 0.45);
  const lightBlue = rgb(0.9, 0.93, 0.98);
  const accentBlue = rgb(0.22, 0.42, 0.78);

  let y = height - 50;

  // ── Header bar ──
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: blue,
  });

  page.drawText("RESYNC HEALTH", {
    x: 40,
    y: height - 35,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("Patient Vitals Report", {
    x: 40,
    y: height - 58,
    size: 13,
    font: fontRegular,
    color: rgb(0.8, 0.85, 1),
  });

  page.drawText("CONFIDENTIAL", {
    x: width - 140,
    y: height - 50,
    size: 10,
    font: fontBold,
    color: rgb(1, 0.8, 0.8),
  });

  // ── Patient Info Section ──
  y = height - 120;

  page.drawRectangle({
    x: 30,
    y: y - 70,
    width: width - 60,
    height: 80,
    color: lightBlue,
    borderColor: accentBlue,
    borderWidth: 1,
  });

  page.drawText("Patient Information", {
    x: 45,
    y: y - 5,
    size: 13,
    font: fontBold,
    color: blue,
  });

  const patientInfo = [
    ["Patient Name:", "Rajesh Kumar"],
    ["Patient ID:", "PAT-2026-04521"],
    ["Date of Birth:", "15/06/1985"],
    ["Date of Report:", new Date().toLocaleDateString("en-IN")],
  ];

  let infoY = y - 25;
  patientInfo.forEach(([label, value], i) => {
    const xOffset = i < 2 ? 45 : 310;
    const yOffset = i % 2 === 0 ? infoY : infoY;
    if (i === 2 || i === 3) {
      page.drawText(label, {
        x: xOffset,
        y: infoY - 20,
        size: 9,
        font: fontBold,
        color: medGray,
      });
      page.drawText(value, {
        x: xOffset + 100,
        y: infoY - 20,
        size: 9,
        font: fontRegular,
        color: darkGray,
      });
    } else {
      page.drawText(label, {
        x: xOffset,
        y: infoY,
        size: 9,
        font: fontBold,
        color: medGray,
      });
      page.drawText(value, {
        x: xOffset + 100,
        y: infoY,
        size: 9,
        font: fontRegular,
        color: darkGray,
      });
    }
  });

  // ── Vitals Section ──
  y = y - 100;

  page.drawText("Vital Signs", {
    x: 40,
    y,
    size: 15,
    font: fontBold,
    color: blue,
  });

  page.drawLine({
    start: { x: 40, y: y - 8 },
    end: { x: width - 40, y: y - 8 },
    thickness: 2,
    color: accentBlue,
  });

  y -= 30;

  const vitals = [
    {
      label: "Blood Pressure",
      value: "120/80 mmHg",
      normal: "Normal: < 120/80",
      icon: "❤️",
    },
    {
      label: "Heart Rate",
      value: "72 bpm",
      normal: "Normal: 60–100 bpm",
      icon: "💓",
    },
    {
      label: "Oxygen Level (SpO2)",
      value: "98%",
      normal: "Normal: 95–100%",
      icon: "🫁",
    },
    {
      label: "Blood Glucose",
      value: "110 mg/dL",
      normal: "Normal: 70–140 mg/dL (random)",
      icon: "🩸",
    },
    {
      label: "Sleep Hours",
      value: "7.5 hrs",
      normal: "Recommended: 7–9 hrs",
      icon: "😴",
    },
  ];

  vitals.forEach((v, i) => {
    const rowY = y - i * 60;
    const bgColor = i % 2 === 0 ? lightBlue : rgb(1, 1, 1);

    // Row background
    page.drawRectangle({
      x: 35,
      y: rowY - 20,
      width: width - 70,
      height: 50,
      color: bgColor,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 0.5,
    });

    // Label
    page.drawText(v.label + ":", {
      x: 55,
      y: rowY + 8,
      size: 12,
      font: fontBold,
      color: darkGray,
    });

    // Value (large, prominent)
    page.drawText(v.value, {
      x: 250,
      y: rowY + 8,
      size: 14,
      font: fontBold,
      color: accentBlue,
    });

    // Normal range
    page.drawText(v.normal, {
      x: 380,
      y: rowY + 8,
      size: 8,
      font: fontRegular,
      color: medGray,
    });
  });

  // ── Footer ──
  y = y - vitals.length * 60 - 30;

  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  page.drawText("Doctor's Remarks:", {
    x: 40,
    y: y - 20,
    size: 11,
    font: fontBold,
    color: blue,
  });

  page.drawText(
    "Patient vitals are within normal limits. Continue current medication.",
    {
      x: 40,
      y: y - 38,
      size: 10,
      font: fontRegular,
      color: darkGray,
    }
  );

  page.drawText("Recommend follow-up in 2 weeks.", {
    x: 40,
    y: y - 53,
    size: 10,
    font: fontRegular,
    color: darkGray,
  });

  // Signature area
  page.drawText("Attending Physician:", {
    x: 40,
    y: y - 90,
    size: 9,
    font: fontBold,
    color: medGray,
  });

  page.drawText("Dr. Anita Sharma, MD", {
    x: 160,
    y: y - 90,
    size: 10,
    font: fontRegular,
    color: darkGray,
  });

  page.drawText("Date:", {
    x: 380,
    y: y - 90,
    size: 9,
    font: fontBold,
    color: medGray,
  });

  page.drawText(new Date().toLocaleDateString("en-IN"), {
    x: 415,
    y: y - 90,
    size: 10,
    font: fontRegular,
    color: darkGray,
  });

  // Footer text
  page.drawText(
    "This report is generated by ReSync Health and is for authorized medical use only.",
    {
      x: 120,
      y: 30,
      size: 7,
      font: fontRegular,
      color: medGray,
    }
  );

  // ── Save ──
  const pdfBytes = await pdf.save();
  const outputPath = path.join(__dirname, "..", "sample-vitals-report.pdf");
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`✅ Sample PDF generated: ${outputPath}`);
  console.log(`\n📋 Vitals in this PDF:`);
  console.log(`   Blood Pressure: 120/80 mmHg`);
  console.log(`   Heart Rate:     72 bpm`);
  console.log(`   Oxygen Level:   98%`);
  console.log(`   Blood Glucose:  110 mg/dL`);
  console.log(`   Sleep Hours:    7.5 hrs`);
}

generateSamplePDF().catch(console.error);
