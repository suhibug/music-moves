// Music Moves: camera or video in, body tracking, live music out.
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { createTracker, update, away, foldTempo } from "./motion.js";
import * as music from "./music.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("skeleton"), ctx = canvas.getContext("2d");

let landmarker, stream, tracker, running = false, lastVideoTime = -1;
const log = [];               // readings from the last 2 minutes, for "Save readings"
const flashUntil = {};        // keeps quick moves (a jump, a step) lit long enough to see
const reached = new Set();    // styles reached this session, counted once each

// ---------- Usage counts ----------
// Only actions and styles are counted (Google Analytics). Never video or body points.
function track(name, params) {
  try { window.gtag?.("event", name, params); } catch {}
}

// ---------- Start and stop ----------
$("start-btn").addEventListener("click", () => begin(() => openCamera(savedCamera())));
$("file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (file) begin(() => openFile(file));
});
$("camera-select").addEventListener("change", async (e) => {
  try { localStorage.setItem("camera", e.target.value); } catch {}
  await openCamera(e.target.value);
});
$("stop-btn").addEventListener("click", stopAll);
$("volume").addEventListener("input", (e) => music.setVolume(+e.target.value));
$("collapse-btn").addEventListener("click", () => $("panel").classList.toggle("collapsed"));
$("save-btn").addEventListener("click", saveReadings);

async function begin(openSource) {
  $("start-btn").disabled = true;
  await music.start(); // sound has to start right from the tap
  showStatus("Opening…");
  try {
    await openSource();
  } catch (err) {
    music.stop();
    $("start-btn").disabled = false;
    return showStatus(err.message || "Something went wrong. Try again.");
  }
  if (!landmarker) {
    showStatus("Loading body tracking (first time takes a few seconds)…");
    landmarker = await loadLandmarker();
  }
  tracker = createTracker();
  running = true;
  $("intro").hidden = true;
  $("panel").hidden = false;
  // On phones, start with settings tucked away so the panel doesn't cover the dancer.
  $("panel").classList.toggle("collapsed", matchMedia("(max-width: 640px)").matches);
  showStatus("");
  requestAnimationFrame(loop);
}

function stopAll() {
  running = false;
  closeCamera();
  video.pause();
  video.removeAttribute("src");
  video.load();
  music.stop();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $("panel").hidden = true;
  $("intro").hidden = false;
  $("start-btn").disabled = false;
}

// ---------- Camera ----------
const savedCamera = () => { try { return localStorage.getItem("camera") || ""; } catch { return ""; } };

async function openCamera(deviceId) {
  closeCamera();
  video.removeAttribute("src");
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: "user", ...size },
      audio: false,
    });
  } catch {
    if (deviceId) return openCamera(""); // the saved camera is gone: fall back to the front one
    throw new Error("The camera didn't open. Allow camera access in your browser settings and try again.");
  }
  const cam = stream.getVideoTracks()[0];
  widest(cam);
  // Front cameras show a mirror image, so moving your right hand moves the right side of the screen.
  const front = cam.getSettings().facingMode === "user" || /front|facetime/i.test(cam.label);
  $("stage").classList.toggle("mirror", front);
  video.srcObject = stream;
  await video.play();
  await listCameras(cam.getSettings().deviceId);
  track("camera_start", { camera: front ? "front" : "back" });
}

// On phones that allow it (mostly Android), zoom out as far as the camera goes.
function widest(cam) {
  const zoom = cam.getCapabilities?.().zoom;
  if (zoom) cam.applyConstraints({ advanced: [{ zoom: zoom.min }] }).catch(() => {});
}

// Fills the camera list. iPhones list "Back Ultra Wide Camera" here: that's the 0.5x lens.
async function listCameras(currentId) {
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  $("camera-select").innerHTML = cams
    .map((c, i) => `<option value="${c.deviceId}">${c.label || "Camera " + (i + 1)}</option>`)
    .join("");
  $("camera-select").value = currentId;
  $("camera-select").disabled = false;
}

function closeCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

// ---------- A saved video instead of the camera ----------
// Good for testing with dance clips. The clip's own sound is muted so you hear the generated music.
async function openFile(file) {
  closeCamera();
  $("stage").classList.remove("mirror");
  video.src = URL.createObjectURL(file);
  video.loop = true;
  video.muted = true;
  await video.play();
  $("camera-select").innerHTML = `<option>Video: ${file.name}</option>`;
  $("camera-select").disabled = true;
  track("video_start");
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
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const body = landmarker.detectForVideo(video, now).landmarks[0];
    drawSkeleton(body);
    const r = body ? update(tracker, body, now) : away(tracker, now);
    r.bpmFolded = r.bpm ? foldTempo(r.bpm) : null;
    music.follow(r);
    remember(r, now);
    render(r, now);
  }
  requestAnimationFrame(loop);
}

function drawSkeleton(body) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!body) return;
  const glow = getComputedStyle(document.body).getPropertyValue("--glow").trim() || "#8fa6ff";
  const draw = new DrawingUtils(ctx);
  draw.drawConnectors(body, PoseLandmarker.POSE_CONNECTIONS, { color: glow, lineWidth: 5 });
  draw.drawLandmarks(body, { color: "#ffffff", fillColor: glow, radius: 4 });
}

// ---------- Side bar ----------
function render(r, now) {
  const playing = music.currentStyle();
  $("style").textContent = playing.name;
  $("tempo").textContent = `${playing.bpm} BPM`;
  document.body.dataset.style = playing.key;
  $("energy-bar").style.width = Math.round(r.energy * 100) + "%";

  if (r.hands.length) flashUntil.hands = now + 250;
  if (r.steps) flashUntil.steps = now + 250;
  if (r.jumped) flashUntil.jump = now + 500;
  const on = {
    hands: now < (flashUntil.hands || 0),
    steps: now < (flashUntil.steps || 0),
    bounce: !!r.bpm,
    jump: now < (flashUntil.jump || 0),
    arms: r.armsUp,
    freeze: r.frozen,
  };
  for (const [k, v] of Object.entries(on)) $("chip-" + k).classList.toggle("on", v);

  if (!reached.has(playing.key)) {
    reached.add(playing.key);
    track("style_reached", { style: playing.key });
  }
}

// ---------- Save readings ----------
// The numbers only (no video), so dance clips can be used to tune the thresholds in motion.js.
function remember(r, now) {
  log.push([Math.round(now), r.visible ? 1 : 0, r.energy.toFixed(3), r.bpm ?? "", r.hands.length, r.steps, r.jumped ? 1 : 0, r.armsUp ? 1 : 0, r.frozen ? 1 : 0, r.style]);
  while (log.length && now - log[0][0] > 120000) log.shift();
}

function saveReadings() {
  const head = "time_ms,body_seen,energy,bounce_per_min,hand_moves,steps,jump,arms_up,frozen,style";
  const csv = [head, ...log.map((row) => row.join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `music-moves-readings-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  a.click();
  track("save_readings");
}

function showStatus(text) {
  $("status").hidden = !text;
  $("status").textContent = text;
}
