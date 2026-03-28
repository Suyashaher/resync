const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { extractVitalsFromPDF } = require("../lib/ocr");
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/auth");

// ── Multer config — store uploads in /uploads ──
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."), false);
    }
  },
});

// ───────────────────────────────────────────────
// POST /api/vitals/upload
// Accepts: multipart/form-data  →  field "pdf"
// Body:    patient_id (required)
// Returns: extracted vitals JSON
// ───────────────────────────────────────────────
router.post(
  "/upload",
  requireAuth,
  upload.single("pdf"),
  async (req, res) => {
    const filePath = req.file?.path;

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded." });
      }

      const { patient_id } = req.body;
      if (!patient_id) {
        return res.status(400).json({ error: "patient_id is required." });
      }

      console.log(`📄 Processing PDF: ${req.file.originalname}`);

      // ── Run OCR ──
      const vitals = await extractVitalsFromPDF(filePath);

      // ── Store in Supabase ──
      const record = {
        patient_id,
        doctor_id: req.user.id,
        bp_systolic: vitals.bp_systolic,
        bp_diastolic: vitals.bp_diastolic,
        heart_rate: vitals.heart_rate,
        oxygen_level: vitals.oxygen_level,
        blood_glucose: vitals.blood_glucose,
        sleep_hours: vitals.sleep_hours,
      };

      const { data, error } = await supabase
        .from("patient_vitals")
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        return res.status(500).json({
          error: "Failed to save vitals to database.",
          details: error.message,
        });
      }

      return res.status(200).json({
        message: "Vitals extracted and saved successfully.",
        vitals: {
          bp_systolic: vitals.bp_systolic,
          bp_diastolic: vitals.bp_diastolic,
          heart_rate: vitals.heart_rate,
          oxygen_level: vitals.oxygen_level,
          blood_glucose: vitals.blood_glucose,
          sleep_hours: vitals.sleep_hours,
        },
        record: data,
      });
    } catch (err) {
      console.error("Vitals upload error:", err);
      return res.status(500).json({
        error: "Failed to process PDF.",
        details: err.message,
      });
    } finally {
      // Clean up uploaded file
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
);

// ───────────────────────────────────────────────
// GET /api/vitals/:patient_id
// Returns all vitals records for a patient
// ───────────────────────────────────────────────
router.get("/:patient_id", requireAuth, async (req, res) => {
  try {
    const { patient_id } = req.params;

    const { data, error } = await supabase
      .from("patient_vitals")
      .select("*")
      .eq("patient_id", patient_id)
      .order("recorded_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ vitals: data });
  } catch (err) {
    console.error("Get vitals error:", err);
    return res.status(500).json({ error: "Failed to fetch vitals." });
  }
});

// ───────────────────────────────────────────────
// GET /api/vitals/:patient_id/latest
// Returns the most recent vitals record
// ───────────────────────────────────────────────
router.get("/:patient_id/latest", requireAuth, async (req, res) => {
  try {
    const { patient_id } = req.params;

    const { data, error } = await supabase
      .from("patient_vitals")
      .select("*")
      .eq("patient_id", patient_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ vitals: data });
  } catch (err) {
    console.error("Get latest vitals error:", err);
    return res.status(500).json({ error: "Failed to fetch latest vitals." });
  }
});

module.exports = router;
