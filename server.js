require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const twilioRoutes = require("./routes/twilio");
const zegocloudRoutes = require("./routes/zegocloud");
const vitalsRoutes = require("./routes/vitals");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());

// ── Health check ──
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "resync-server" });
});

// ── Routes ──
app.use("/api/twilio", twilioRoutes);
app.use("/api/zegocloud", zegocloudRoutes);
app.use("/api/vitals", vitalsRoutes);

// ── Public Video Call Page ──
// Anyone with the link can join — no auth required
app.get("/call/:roomId", (req, res) => {
  const { roomId } = req.params;
  const userName = req.query.name || "Guest";
  const userId = req.query.uid || `user_${Date.now()}`;

  const appID = parseInt(process.env.ZEGOCLOUD_APP_ID, 10);
  const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ReSync — Video Call</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0a0b10; color: #e4e4e7;
      height: 100vh; overflow: hidden;
    }
    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 24px;
      background: rgba(10,11,16,0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    }
    .logo {
      font-weight: 700; font-size: 1.1rem;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .info { font-size: 0.8rem; color: #71717a; }
    .info span { color: #a5b4fc; font-weight: 600; }
    #video-container { width: 100%; height: 100vh; padding-top: 48px; }
    .loading {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100vh; gap: 16px;
    }
    .spinner {
      width: 44px; height: 44px;
      border: 3px solid rgba(99,102,241,0.15);
      border-top-color: #6366f1; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { color: #71717a; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="logo">ReSync</div>
    <div class="info">Room: <span>${roomId}</span></div>
  </div>
  <div id="video-container">
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <div class="loading-text">Connecting to video call…</div>
    </div>
  </div>

  <script src="https://unpkg.com/@zegocloud/zego-uikit-prebuilt/zego-uikit-prebuilt.js"></script>
  <script>
    const APP_ID = ${appID};
    const SERVER_SECRET = "${serverSecret}";
    const ROOM_ID = "${roomId}";
    const USER_ID = "${userId}";
    const USER_NAME = "${userName}";

    async function start() {
      try {
        document.getElementById("loading").style.display = "none";
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          APP_ID, SERVER_SECRET, ROOM_ID, USER_ID, USER_NAME
        );
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zp.joinRoom({
          container: document.getElementById("video-container"),
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          showScreenSharingButton: true,
          showPreJoinView: true,
          turnOnCameraWhenJoining: true,
          turnOnMicrophoneWhenJoining: true,
          showLeaveRoomConfirmDialog: true,
          onLeaveRoom: () => { window.location.href = "/"; },
        });
      } catch (err) {
        document.getElementById("video-container").innerHTML =
          '<div class="loading"><p style="color:#f87171">' + err.message + '</p></div>';
      }
    }
    start();
  </script>
</body>
</html>`);
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`🚀 ReSync server running on http://localhost:${PORT}`);
});
