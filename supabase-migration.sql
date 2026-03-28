-- =====================================================
-- Supabase Migration: patient_vitals table
-- Run this in the Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS patient_vitals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id    UUID NOT NULL,
  doctor_id     UUID NOT NULL,

  -- Vital signs
  bp_systolic   INTEGER,          -- e.g. 120
  bp_diastolic  INTEGER,          -- e.g. 80
  heart_rate    INTEGER,          -- e.g. 72 bpm
  oxygen_level  INTEGER,          -- e.g. 98 %
  blood_glucose INTEGER,          -- e.g. 110 mg/dL
  sleep_hours   DECIMAL(4,2),     -- e.g. 7.50

  -- Metadata
  notes            TEXT,           -- doctor's notes / OCR output
  source_filename  TEXT,           -- original PDF filename
  recorded_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by patient
CREATE INDEX IF NOT EXISTS idx_vitals_patient
  ON patient_vitals (patient_id, recorded_at DESC);

-- Index for doctor-level queries
CREATE INDEX IF NOT EXISTS idx_vitals_doctor
  ON patient_vitals (doctor_id);

-- Enable RLS (Row Level Security)
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all vitals
CREATE POLICY "Authenticated users can read vitals"
  ON patient_vitals
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert vitals
CREATE POLICY "Authenticated users can insert vitals"
  ON patient_vitals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
