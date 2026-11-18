// Music Moves: camera, body tracking, and the readings panel.
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { createTracker, update } from "./motion.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("skeleton"), ctx = canvas.getContext("2d");
const MODE_NAMES = { away: "Step into view", calm: "Calm", groove: "Groove", rave: "Rave" };

let landmarker, stream, tracker, lastVideoTime = -1, running = false;
let jumpUntil = 0;
const history = [];      // energy over the last 10 seconds, for the little graph
const reached = new Set(); // moods reached this session, counted once each

// ---------- Usage counts ----------
// Only actions and moods are counted (Google Analytics). Never video or body points.
function track(name, params) {
  try { window.gtag?.("event", name, params); } catch {}
}

// ---------- Start and stop ----------
$("start-btn").addEventListener("click", start);
$("stop-btn").addEventListener("click", stop);

async function start() {
  $("start-btn").disabled = true;
  showStatus("Opening the camera…");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
  } catch {
    $("start-btn").disabled = false;
    return showStatus("The camera didn't open. Allow camera access in your browser settings and try again.");
  }
  video.srcObject = stream;
  await video.play();
  $("intro").hidden = true;

  if (!landmarker) {
    showStatus("Loading body tracking (first time takes a few seconds)…");
    landmarker = await loadLandmarker();
  }
  tracker = createTracker();
  history.length = 0;
  running = true;
  $("stop-btn").hidden = false;
  showStatus("");
  track("camera_start");
  requestAnimationFrame(loop);
}

function stop() {
  running = false;
  stream?.getTracks().forEach((t) => t.stop());
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("intro").hidden = false;
  $("start-btn").disabled = false;
  $("stop-btn").hidden = true;
  render({ visible: false, energy: 0, mode: "none", bpm: null, jumping: false, armsUp: false });
}

// Uses the graphics chip when it can (faster), and falls back to the regular processor.
async function loadLandmarker() {
  const files = await FilesetResolver.forVisionTasks(WASM);
  const options = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numPoses: 1 });
  try { return await PoseLandmarker.createFromOptions(files, options("GPU")); }
  catch { return await PoseLandmarker.createFromOptions(files, options("CPU")); }
}

// ---------- Every video frame ----------
function loop() {
  if (!running) return;
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    const body = result.landmarks[0];
    drawSkeleton(body);
    let reading;
    if (body) reading = update(tracker, body, now);
    else {
      tracker.prev = null;
      tracker.energy *= 0.9; // fade out while nobody is in view
      reading = { visible: false, energy: tracker.energy, mode: "away", bpm: null, jumping: false, armsUp: false };
    }
    if (reading.jumping) jumpUntil = now + 400; // keep "Jump!" on screen long enough to see
    reading.jumpShown = now < jumpUntil;
    history.push(reading.energy);
    if (history.length > 300) history.shift();
    if (reading.visible && !reached.has(reading.mode)) {
      reached.add(reading.mode);
      track("reached_mood", { mood: reading.mode });
    }
    render(reading);
  }
  requestAnimationFrame(loop);
}

function drawSkeleton(body) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!body) return;
  const draw = new DrawingUtils(ctx);
  draw.drawConnectors(body, PoseLandmarker.POSE_CONNECTIONS, { color: "#7cf8ff", lineWidth: 4 });
  draw.drawLandmarks(body, { color: "#ff4fd8", fillColor: "#ff4fd8", radius: 3 });
}

// ---------- Panel ----------
function render(r) {
  const pct = Math.round(r.energy * 100);
  $("energy-num").textContent = pct + "%";
  $("energy-bar").style.width = pct + "%";
  $("mode").textContent = MODE_NAMES[r.mode] || "Waiting";
  $("mode").dataset.mode = r.mode;
  document.body.dataset.mode = r.mode;
  $("bpm").textContent = r.bpm ? `${r.bpm}/min` : "–";
  $("jump").textContent = r.jumpShown ? "Jump!" : "–";
  $("arms").textContent = r.armsUp ? "Up!" : "–";
  drawHistory();
}

function drawHistory() {
  const c = $("history"), g = c.getContext("2d");
  c.width = c.clientWidth * devicePixelRatio;
  c.height = 70 * devicePixelRatio;
  g.clearRect(0, 0, c.width, c.height);
  if (history.length < 2) return;
  g.beginPath();
  history.forEach((e, i) => {
    const x = (i / 299) * c.width;
    const y = c.height - 2 - e * (c.height - 4);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.strokeStyle = "#7cf8ff";
  g.lineWidth = 2 * devicePixelRatio;
  g.stroke();
}

function showStatus(text) {
  $("status").hidden = !text;
  $("status").textContent = text;
}
