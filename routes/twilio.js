const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/auth");

/**
 * POST /api/twilio/send-summary
 * Body: { patientId: string }
 *
 * 1. Fetches the patient's latest day of health_metrics.
 * 2. Looks up the caretaker via patient_details → profiles.
 * 3. Formats a readable summary and sends it via Twilio WhatsApp.
 */
router.post("/send-summary", requireAuth, async (req, res) => {
  try {
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required." });
    }

    // ── 1. Get the latest day's health metrics ──
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();

    const { data: metrics, error: metricsErr } = await supabase
      .from("health_metrics")
      .select("*")
      .eq("patient_id", patientId)
      .gte("recorded_at", startOfDay)
      .order("recorded_at", { ascending: false });

    if (metricsErr) throw metricsErr;

    if (!metrics || metrics.length === 0) {
      return res.status(404).json({ error: "No health metrics found for today." });
    }

    // ── 2. Look up the caretaker ──
    const { data: patientDetail, error: pdErr } = await supabase
      .from("patient_details")
      .select("caretaker_id")
      .eq("patient_id", patientId)
      .single();

    if (pdErr || !patientDetail) {
      return res.status(404).json({ error: "Patient details not found." });
    }

    const { data: caretaker, error: ctErr } = await supabase
      .from("profiles")
      .select("full_name, contact_number")
      .eq("id", patientDetail.caretaker_id)
      .single();

    if (ctErr || !caretaker) {
      return res.status(404).json({ error: "Caretaker profile not found." });
    }

    if (!caretaker.contact_number) {
      return res.status(400).json({ error: "Caretaker has no contact number on file." });
    }

    // ── 3. Get patient name ──
    const { data: patientProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", patientId)
      .single();

    const patientName = patientProfile?.full_name || "Patient";

    // ── 4. Format summary ──
    const latest = metrics[0];
    const summary = [
      `🩺 *ReSync — Daily Health Summary*`,
      `👤 Patient: ${patientName}`,
      `📅 Date: ${new Date().toLocaleDateString("en-IN")}`,
      ``,
      `❤️ Heart Rate: ${latest.heart_rate ?? "—"} bpm`,
      `🩸 Blood Pressure: ${latest.bp_systolic ?? "—"}/${latest.bp_diastolic ?? "—"} mmHg`,
      `🫁 Oxygen Level: ${latest.oxygen_level ?? "—"}%`,
      `🍬 Blood Glucose: ${latest.blood_glucose ?? "—"} mg/dL`,
      `😴 Sleep: ${latest.sleep_hours ?? "—"} hrs`,
      latest.notes ? `📝 Notes: ${latest.notes}` : "",
      ``,
      `Total readings today: ${metrics.length}`,
    ]
      .filter(Boolean)
      .join("\n");

    // ── 5. Send via Twilio WhatsApp ──
    const twilio = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await twilio.messages.create({
      body: summary,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${caretaker.contact_number}`,
    });

    return res.json({
      success: true,
      messageSid: message.sid,
      sentTo: caretaker.full_name,
    });
  } catch (err) {
    console.error("Twilio send-summary error:", err);
    return res.status(500).json({ error: "Failed to send health summary." });
  }
});

/**
 * POST /api/twilio/send-meeting-link
 * Body: { appointmentId: string }
 *
 * Looks up the appointment → patient → caretaker, then sends
 * a WhatsApp message with the video-call meeting link.
 */
router.post("/send-meeting-link", requireAuth, async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: "appointmentId is required." });
    }

    // 1. Get the appointment (must be approved and have a meeting_link)
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("*, profiles!appointments_patient_id_fkey ( full_name )")
      .eq("id", appointmentId)
      .single();

    if (apptErr || !appt) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    if (!appt.meeting_link) {
      return res.status(400).json({ error: "No meeting link set for this appointment." });
    }

    // 2. Look up the caretaker via patient_details
    const { data: patientDetail, error: pdErr } = await supabase
      .from("patient_details")
      .select("caretaker_id")
      .eq("patient_id", appt.patient_id)
      .single();

    if (pdErr || !patientDetail) {
      return res.status(404).json({ error: "Patient details not found." });
    }

    const { data: caretaker, error: ctErr } = await supabase
      .from("profiles")
      .select("full_name, contact_number")
      .eq("id", patientDetail.caretaker_id)
      .single();

    if (ctErr || !caretaker) {
      return res.status(404).json({ error: "Caretaker profile not found." });
    }

    if (!caretaker.contact_number) {
      return res.status(400).json({ error: "Caretaker has no contact number on file." });
    }

    // 3. Build the message
    const patientName = appt.profiles?.full_name || "Patient";
    const scheduledTime = appt.scheduled_time
      ? new Date(appt.scheduled_time).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "TBD";

    const body = [
      `🩺 *ReSync — Video Consultation Approved*`,
      ``,
      `👤 Patient: ${patientName}`,
      `📅 Scheduled: ${scheduledTime}`,
      ``,
      `🔗 *Room ID:* ${appt.meeting_link}`,
      `📱 *App ID:* ${process.env.ZEGOCLOUD_APP_ID}`,
      ``,
      `Open the ReSync app and join the video call when it's time.`,
    ].join("\n");

    // 4. Send via Twilio WhatsApp
    const twilio = require("twilio")(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const message = await twilio.messages.create({
      body,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${caretaker.contact_number}`,
    });

    return res.json({
      success: true,
      messageSid: message.sid,
      sentTo: caretaker.full_name,
    });
  } catch (err) {
    console.error("Twilio send-meeting-link error:", err);
    return res.status(500).json({ error: "Failed to send meeting link." });
  }
});

module.exports = router;
