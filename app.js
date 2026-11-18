// Music Moves: objects float in the air around you, and playing with them makes music.
import * as V from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { createWorld, addObject, step } from "./world.js";
import { drawObject, drawPiece, STYLES, STYLE_NAMES, mix } from "./art.js";
import { SPRITES, THEMES } from "./sprites.js";
import { loadScene, readScene } from "./scene.js";
import * as sound from "./sound.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HANDS = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const $ = (id) => document.getElementById(id);
const video = $("video"), fx = $("fx"), ctx = fx.getContext("2d");

let handModel, sceneModel, stream, world, running = false, mirror = true;
let lastVideoTime = -1, lastFrame = 0, lastScan = 0, lastHandTime = 0;
let shownHands = [{ seen: false }, { seen: false }];
let style = saved("style") || "pixel", place = saved("place") || "auto", count = +(saved("count") || 5);
let scene = { theme: "room", spotted: [], palette: ["#ffcf5c", "#7cf8ff", "#ff7ab6", "#8affb0"] };
const closedNow = [false, false];
const firsts = new Set();

// ---------- Saved choices (this browser only) ----------
function saved(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key, value) { try { localStorage.setItem(key, value); } catch {} }

// ---------- Usage counts ----------
// Only actions and choices are counted (Google Analytics). Never video, hands or places.
function track(name, params) {
  try { window.gtag?.("event", name, params); } catch {}
}

// ---------- Settings ----------
function drawChoices() {
  const group = (id, items, current, onPick) => {
    $(id).innerHTML = items.map(([value, label]) => `<button class="choice" data-v="${value}" aria-pressed="${String(value) === String(current)}">${label}</button>`).join("");
    $(id).onclick = (e) => { const b = e.target.closest(".choice"); if (b) { onPick(b.dataset.v); drawChoices(); } };
  };
  group("place-choices", [["auto", "Auto"], ...Object.entries(THEMES).map(([k, t]) => [k, t.name])], place, (v) => { place = v; save("place", v); refill(); });
  group("style-choices", STYLES.map((k) => [k, STYLE_NAMES[k]]), style, setStyle);
  group("count-choices", [[3, "3"], [5, "5"], [8, "8"]], count, (v) => { count = +v; save("count", v); refill(); });
  $("style-btn").textContent = STYLE_NAMES[style];
  $("place-name").textContent = THEMES[themeNow()].name + (place === "auto" ? "" : " (set)");
}
function setStyle(v) { style = v; save("style", v); track("style_change", { style: v }); drawChoices(); }
$("style-btn").addEventListener("click", () => setStyle(STYLES[(STYLES.indexOf(style) + 1) % STYLES.length]));
$("menu-btn").addEventListener("click", () => ($("sheet").hidden = !$("sheet").hidden));
$("volume").addEventListener("input", (e) => sound.setVolume(+e.target.value));
$("camera-select").addEventListener("change", (e) => { save("camera", e.target.value); openCamera(e.target.value); });
$("stop-btn").addEventListener("click", stopAll);
$("start-btn").addEventListener("click", begin);
const themeNow = () => (place === "auto" ? scene.theme : place);
drawChoices();

// ---------- Start and stop ----------
async function begin() {
  $("start-btn").disabled = true;
  await sound.start(); // sound has to start right from the tap
  try {
    showStatus("Opening the camera…");
    await openCamera(saved("camera") || "");
    showStatus("Loading hand tracking (first time takes a few seconds)…");
    const files = await V.FilesetResolver.forVisionTasks(WASM);
    [handModel, sceneModel] = await Promise.all([handModel || loadHands(files), sceneModel || loadScene(V, files).catch(() => null)]);
  } catch (err) {
    sound.stop();
    $("start-btn").disabled = false;
    return showStatus(err.message || "Something went wrong. Try again.");
  }
  scan(true);
  world = createWorld();
  sizeWorld();
  refill();
  running = true;
  $("intro").hidden = true;
  $("hud").hidden = false;
  showStatus("");
  track("play_start", { style, place: themeNow() });
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function stopAll() {
  running = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  sound.stop();
  ctx.clearRect(0, 0, fx.width, fx.height);
  $("hud").hidden = true;
  $("sheet").hidden = true;
  $("intro").hidden = false;
  $("start-btn").disabled = false;
}

async function loadHands(files) {
  const options = (delegate) => ({ baseOptions: { modelAssetPath: HANDS, delegate }, runningMode: "VIDEO", numHands: 2 });
  try { return await V.HandLandmarker.createFromOptions(files, options("GPU")); }
  catch { return await V.HandLandmarker.createFromOptions(files, options("CPU")); }
}

// ---------- Camera ----------
async function openCamera(deviceId) {
  stream?.getTracks().forEach((t) => t.stop());
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: "user", ...size }, audio: false });
  } catch {
    if (deviceId) return openCamera("");
    throw new Error("The camera didn't open. Allow camera access in your browser settings and try again.");
  }
  const cam = stream.getVideoTracks()[0];
  // Front cameras show a mirror image, so your right hand moves on the right side of the screen.
  mirror = cam.getSettings().facingMode !== "environment" && !/back|rear/i.test(cam.label);
  $("stage").classList.toggle("mirror", mirror);
  video.srcObject = stream;
  await video.play();
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  $("camera-select").innerHTML = cams.map((c, i) => `<option value="${c.deviceId}">${c.label || "Camera " + (i + 1)}</option>`).join("");
  $("camera-select").value = cam.getSettings().deviceId;
  if (world) sizeWorld();
}

// ---------- Objects ----------
function sizeWorld() {
  fx.width = world.w = video.videoWidth || 1280;
  fx.height = world.h = video.videoHeight || 720;
}

// Looks at the picture now and then to match objects and colors to where you are.
function scan(first = false) {
  lastScan = performance.now();
  if (!sceneModel) return;
  try {
    const before = themeNow();
    scene = readScene(sceneModel, video);
    if (first || themeNow() !== before) track("place_detected", { place: scene.theme });
    if (!first && themeNow() !== before) refill();
    drawChoices();
  } catch {}
}

// Picks an object for this place. Real things spotted in your room come up more often.
function pickObject() {
  const pool = [...THEMES[themeNow()].objects, ...(themeNow() === "room" ? [...scene.spotted, ...scene.spotted] : [])];
  const present = new Set(world.objects.filter((o) => o.state !== "broken").map((o) => o.type));
  const fresh = pool.filter((t) => !present.has(t));
  const type = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  // Colors lean toward the colors in your background, so objects feel like they belong there.
  const colors = SPRITES[type].colors.map((c, k) => mix(c, scene.palette[k % scene.palette.length], 0.3));
  return { type, colors };
}

function refill() {
  if (!world) return;
  world.objects = [];
  world.pieces = [];
  for (let k = 0; k < count; k++) {
    const { type, colors } = pickObject();
    const x = world.w * (k + 0.5) / count + (Math.random() - 0.5) * world.w * 0.06;
    const y = world.h * (0.22 + Math.random() * 0.3);
    addObject(world, type, colors, x, y);
  }
}

// ---------- Hands ----------
const avg = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Turns MediaPipe's 21 hand points into "where is the hand, and is it grabbing?"
function readHands(result) {
  const out = [{ seen: false }, { seen: false }];
  result.landmarks.forEach((pts, n) => {
    const slot = result.handednesses[n]?.[0]?.categoryName === "Left" ? 1 : 0;
    const k = out[slot].seen ? 1 - slot : slot;
    const px = pts.map((p) => ({ x: (mirror ? 1 - p.x : p.x) * world.w, y: p.y * world.h }));
    const palm = gap(px[0], px[9]);
    const curl = [8, 12, 16, 20].reduce((s, i) => s + gap(px[i], px[0]), 0) / 4 / palm; // fist: small, open: big
    const pinch = gap(px[4], px[8]) / palm;
    // Grab = a closed hand or a pinch. It takes a clearer open hand to let go, so it doesn't flicker.
    closedNow[k] = closedNow[k] ? curl < 1.55 || pinch < 0.4 : curl < 1.25 || pinch < 0.28;
    const at = pinch < 0.4 ? avg([px[4], px[8]]) : avg([px[0], px[5], px[9], px[17]]);
    out[k] = { seen: true, x: at.x, y: at.y, closed: closedNow[k] };
  });
  return out;
}

// ---------- Every frame ----------
function loop(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (video.videoWidth && fx.width !== video.videoWidth) sizeWorld();
  // Hands only update when the camera has a new picture (about 30 times a second).
  let fresh = null, handDt = 0;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    fresh = readHands(handModel.detectForVideo(video, now));
    handDt = Math.min(0.1, (now - lastHandTime) / 1000);
    lastHandTime = now;
    shownHands = fresh;
  }

  const events = step(world, fresh, dt, now, pickObject, handDt);
  for (const e of events) {
    sound.play1(e);
    if (["catch", "shatter", "crush", "stretchStart", "throw"].includes(e.type) && !firsts.has(e.type)) { firsts.add(e.type); track("first_" + e.type); }
  }
  if (now - lastScan > 20000) scan();
  draw(shownHands);
  requestAnimationFrame(loop);
}

function draw(hands) {
  ctx.clearRect(0, 0, fx.width, fx.height);
  for (const o of world.objects) if (o.state !== "broken") drawObject(ctx, o, style);
  for (const p of world.pieces) drawPiece(ctx, p, style);
  // Small rings show where the app sees your hands: filled while grabbing.
  const r = Math.min(world.w, world.h) * 0.03;
  for (const h of hands) {
    if (!h.seen) continue;
    ctx.beginPath();
    ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.25;
    ctx.strokeStyle = "rgba(255,255,255,.75)";
    ctx.fillStyle = "rgba(255,255,255,.35)";
    h.closed ? ctx.fill() : ctx.stroke();
  }
}

function showStatus(text) {
  $("status").hidden = !text;
  $("status").textContent = text;
}
