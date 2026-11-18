// Music Moves: camera or video in, body tracking, live music out.
import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { createTracker, update, away } from "./motion.js";
import * as music from "./music.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const $ = (id) => document.getElementById(id);
const video = $("video"), fx = $("fx"), fxc = fx.getContext("2d"), wave = $("wave"), wc = wave.getContext("2d");

let landmarker, stream, tracker, running = false, lastVideoTime = -1;
let vibe = saved("vibe") || "amapiano";
let glow = saved("glow") !== "off";
let calmEnergy = 0, phase = 0;      // the bottom wave eases slowly so it feels calm, not like a heartbeat
const trails = [[], [], [], []];    // recent positions of hands and feet, for the soft glow
const log = [];                     // movement numbers from the last 2 minutes, for "Save readings"
const reached = new Set();

// ---------- Saved choices (this browser only) ----------
function saved(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key, value) { try { localStorage.setItem(key, value); } catch {} }

// ---------- Usage counts ----------
// Only actions and sound choices are counted (Google Analytics). Never video or body points.
function track(name, params) {
  try { window.gtag?.("event", name, params); } catch {}
}

// ---------- Sound picker ----------
const COLORS = { amapiano: "#ffb547", house: "#7cf8ff", afro: "#5cf2a6", hiphop: "#ff5a6e", calm: "#a9b8ff" };
const glowColor = () => COLORS[music.current().key] || COLORS[vibe];

function drawPickers() {
  for (const box of document.querySelectorAll('[data-role="vibe-picker"]')) {
    const big = box.classList.contains("big");
    box.innerHTML = Object.entries(music.VIBES).map(([key, v]) =>
      `<button class="vibe" data-vibe="${key}" aria-pressed="${key === vibe}" style="--c:${COLORS[key]}">${v.name}${big ? `<small>${v.about}</small>` : ""}</button>`
    ).join("");
  }
  document.body.style.setProperty("--glow", COLORS[vibe]);
  $("vibe-name").textContent = music.VIBES[vibe].name;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".vibe");
  if (!b) return;
  vibe = b.dataset.vibe;
  save("vibe", vibe);
  music.setVibe(vibe);
  drawPickers();
  if (running) track("vibe_change", { vibe });
});
drawPickers();

// ---------- Start and stop ----------
$("start-btn").addEventListener("click", () => begin(() => openCamera(saved("camera") || "")));
$("file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (file) running ? openFile(file) : begin(() => openFile(file));
});
$("camera-select").addEventListener("change", (e) => { save("camera", e.target.value); openCamera(e.target.value); });
$("menu-btn").addEventListener("click", () => ($("sheet").hidden = !$("sheet").hidden));
$("volume").addEventListener("input", (e) => music.setVolume(+e.target.value));
$("glow-toggle").checked = glow;
$("glow-toggle").addEventListener("change", (e) => { glow = e.target.checked; save("glow", glow ? "on" : "off"); });
$("save-btn").addEventListener("click", saveReadings);
$("stop-btn").addEventListener("click", stopAll);

async function begin(openSource) {
  $("start-btn").disabled = true;
  await music.start(vibe); // sound has to start right from the tap
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
  $("hud").hidden = false;
  showStatus("");
  track("music_start", { vibe });
  requestAnimationFrame(loop);
}

function stopAll() {
  running = false;
  closeCamera();
  video.pause();
  video.removeAttribute("src");
  video.load();
  music.stop();
  fxc.clearRect(0, 0, fx.width, fx.height);
  $("hud").hidden = true;
  $("sheet").hidden = true;
  $("intro").hidden = false;
  $("start-btn").disabled = false;
}

// ---------- Camera ----------
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
  const zoom = cam.getCapabilities?.().zoom; // on phones that allow it (mostly Android), zoom out all the way
  if (zoom) cam.applyConstraints({ advanced: [{ zoom: zoom.min }] }).catch(() => {});
  // Front cameras show a mirror image, so your right hand moves on the right side of the screen.
  const front = cam.getSettings().facingMode === "user" || /front|facetime/i.test(cam.label);
  $("stage").classList.toggle("mirror", front);
  video.srcObject = stream;
  await video.play();
  // iPhones list "Back Ultra Wide Camera" here: that's the 0.5x lens.
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  $("camera-select").innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${c.label || "Camera " + (i + 1)}</option>`).join("");
  $("camera-select").value = cam.getSettings().deviceId;
  $("camera-select").disabled = false;
}

function closeCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
}

// ---------- A saved video instead of the camera ----------
// Good for dancing along to a clip. Its own sound is muted, so you hear the music your moves make.
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
    const r = body ? update(tracker, body, now, video.videoWidth / video.videoHeight) : away(tracker);
    music.follow(r);
    drawGlow(r);
    remember(r, now);
    const playing = music.current();
    if (!reached.has(playing.layer)) { reached.add(playing.layer); track("layer_reached", { layer: playing.layer, vibe: playing.key }); }
  }
  drawWave();
  requestAnimationFrame(loop);
}

// Soft dots with short fading trails on hands and feet only, so your face and body stay clear.
function drawGlow(r) {
  fx.width = video.videoWidth;
  fx.height = video.videoHeight;
  fxc.clearRect(0, 0, fx.width, fx.height);
  if (!glow) return;
  const color = glowColor();
  r.points.forEach((p, k) => {
    const trail = trails[k];
    trail.push({ x: p.x * fx.width, y: p.y * fx.height });
    if (trail.length > 10) trail.shift();
  });
  for (let k = r.points.length; k < 4; k++) trails[k].length = 0;
  const size = Math.max(fx.width, fx.height) / 140;
  fxc.globalCompositeOperation = "lighter";
  for (const trail of trails) {
    trail.forEach((pt, j) => {
      const a = (j + 1) / trail.length;
      const g = fxc.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, size * (1 + a));
      g.addColorStop(0, hexAlpha(color, 0.5 * a));
      g.addColorStop(1, hexAlpha(color, 0));
      fxc.fillStyle = g;
      fxc.beginPath();
      fxc.arc(pt.x, pt.y, size * (1 + a), 0, Math.PI * 2);
      fxc.fill();
    });
  }
  fxc.globalCompositeOperation = "source-over";
}

// A slow, smooth wave at the bottom. It swells gently with your movement instead of jumping.
function drawWave() {
  const dpr = devicePixelRatio || 1;
  wave.width = wave.clientWidth * dpr;
  wave.height = wave.clientHeight * dpr;
  const e = tracker ? tracker.energy : 0;
  calmEnergy += (e - calmEnergy) * 0.02;
  phase += 0.008 + calmEnergy * 0.02;
  const color = glowColor();
  const mid = wave.height * 0.6, amp = (4 + calmEnergy * 26) * dpr;
  for (const [k, alpha] of [[1, 0.55], [0.6, 0.2]]) {
    wc.beginPath();
    for (let x = 0; x <= wave.width; x += 6 * dpr) {
      const u = x / wave.width;
      const y = mid + amp * k * Math.sin(u * Math.PI * 2 * 1.5 + phase * (k === 1 ? 1 : -0.7)) * Math.sin(Math.PI * u);
      x ? wc.lineTo(x, y) : wc.moveTo(x, y);
    }
    wc.strokeStyle = hexAlpha(color, alpha);
    wc.lineWidth = 2 * dpr;
    wc.stroke();
  }
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

// ---------- Save readings ----------
// Numbers only (no video), so clips can be used to tune the thresholds in motion.js.
function remember(r, now) {
  log.push([Math.round(now), r.visible ? 1 : 0, r.energy.toFixed(3), r.hands.length, r.hit ? 1 : 0, r.steps, r.jumped ? 1 : 0, r.extended ? 1 : 0, r.wentLow ? 1 : 0, r.level.toFixed(2), r.span.toFixed(2), r.frozen ? 1 : 0, music.current().layer, vibe]);
  while (log.length && now - log[0][0] > 120000) log.shift();
}

function saveReadings() {
  const head = "time_ms,body_seen,energy,hand_moves,hit,steps,jump,stretch,went_low,level,span,frozen,layer,sound";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([[head, ...log.map((row) => row.join(","))].join("\n")], { type: "text/csv" }));
  a.download = `music-moves-readings-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
  a.click();
  track("save_readings");
}

function showStatus(text) {
  $("status").hidden = !text;
  $("status").textContent = text;
}
