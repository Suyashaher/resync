const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const requireAuth = require("../middleware/auth");

/**
 * GET /api/zegocloud/config
 *
 * Returns the ZEGOCLOUD appID and serverSecret so the client
 * can call `generateKitTokenForTest` directly.
 */
router.get("/config", requireAuth, (_req, res) => {
  const appID = parseInt(process.env.ZEGOCLOUD_APP_ID, 10);
  const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET;

  if (!appID || !serverSecret) {
    return res
      .status(500)
      .json({ error: "ZEGOCLOUD credentials are not configured on the server." });
  }

  return res.json({ appID, serverSecret });
});

/**
 * POST /api/zegocloud/approve
 * Body: { appointmentId: string }
 *
 * 1. Generates a unique room ID from the appointment ID.
 * 2. Builds a shareable meeting link.
 * 3. Updates the Supabase `appointments` row:
 *    - status → 'approved'
 *    - meeting_link → the generated link
 * 4. Returns { roomId, meetingLink }
 */
router.post("/approve", requireAuth, async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: "appointmentId is required." });
    }

    const appID = parseInt(process.env.ZEGOCLOUD_APP_ID, 10);
    const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET;
    const roomId = `resync-${appointmentId}`;

    // Build a public meeting link using the tunnel URL
    const baseUrl = process.env.TUNNEL_URL || `http://localhost:${process.env.PORT || 5000}`;
    const meetingLink = `${baseUrl}/call/${roomId}?name=Guest`;

    // Update the appointment in Supabase
    const { data, error } = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        meeting_link: meetingLink,
      })
      .eq("id", appointmentId)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return res.status(500).json({ error: "Failed to update appointment: " + error.message });
    }

    return res.json({
      success: true,
      roomId,
      meetingLink,
      // Flutter app can use these directly to join via ZEGOCLOUD SDK
      appID,
      serverSecret,
      appointment: data,
    });
  } catch (err) {
    console.error("Approve appointment error:", err);
    return res.status(500).json({ error: "Failed to approve appointment." });
  }
});

module.exports = router;
