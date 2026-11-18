// Looks at the camera picture to decide which objects belong there and which colors to use.
// Runs on this device with Google's free MediaPipe models. Nothing is uploaded.
import { THEMES, SPOTTED } from "./sprites.js";

const DETECT = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
const CLASSIFY = "https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite";
const BEACH = /seashore|sandbar|lakeside|coral|breakwater|boathouse|pier|beach|sand|swimming/i;
const OUTDOORS = /valley|alp|cliff|volcano|forest|park|garden|mountain|geyser|meadow|tree|daisy|field|patio|yard/i;

export async function loadScene(V, files) {
  const [detector, classifier] = await Promise.all([
    V.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: DETECT }, runningMode: "IMAGE", scoreThreshold: 0.35, maxResults: 8 }),
    V.ImageClassifier.createFromOptions(files, { baseOptions: { modelAssetPath: CLASSIFY }, runningMode: "IMAGE", maxResults: 5 }),
  ]);
  return { detector, classifier, canvas: document.createElement("canvas") };
}

// Returns { theme, spotted: [object types seen in the room], palette: [4 colors] }
export function readScene(models, video) {
  const c = models.canvas;
  c.width = 320;
  c.height = Math.round(320 * video.videoHeight / video.videoWidth) || 180;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(video, 0, 0, c.width, c.height);

  const labels = models.classifier.classify(c).classifications[0]?.categories.map((x) => x.categoryName) || [];
  const found = models.detector.detect(c).detections.map((d) => d.categories[0].categoryName);
  const spotted = [...new Set(found.map((name) => SPOTTED[name]).filter(Boolean))];
  let theme = "room";
  if (labels.some((l) => BEACH.test(l))) theme = "beach";
  else if (labels.some((l) => OUTDOORS.test(l))) theme = "outdoors";
  return { theme, spotted, palette: paletteOf(g.getImageData(0, 0, c.width, c.height).data), labels, found };
}

// The most colorful hues in the picture, brightened so objects still stand out against it.
function paletteOf(px) {
  const bins = Array.from({ length: 12 }, () => ({ w: 0, s: 0, l: 0 }));
  for (let i = 0; i < px.length; i += 16) {
    const [h, s, l] = hsl(px[i], px[i + 1], px[i + 2]);
    const b = bins[Math.floor(h * 12) % 12];
    b.w += s; b.s += s * s; b.l += l * s;
  }
  const top = bins.map((b, i) => ({ i, ...b })).filter((b) => b.w > 0).sort((a, b) => b.w - a.w).slice(0, 4);
  while (top.length < 4) top.push({ i: (top.length * 3) % 12, w: 1, s: 0.5, l: 0.5 });
  return top.map((b) => hslHex((b.i + 0.5) / 12, Math.max(0.55, b.s / b.w), Math.min(0.72, Math.max(0.55, b.l / b.w + 0.15))));
}

export const themeName = (t) => THEMES[t].name;

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslHex(h, s, l) {
  const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
