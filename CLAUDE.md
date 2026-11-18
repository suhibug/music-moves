# Music Moves: notes for Claude Code

Free web app: the camera reads how you move, and the music follows. Built by Suhitha (GitHub: suhibug). Plain HTML, CSS and JavaScript. No build step, no framework, no backend, no paid services.

## Files
- `index.html`, `style.css`: start screen (sound picker), full-screen camera, small ⋯ settings sheet, bottom wave
- `app.js`: camera picker (incl. back Ultra Wide) or a video file, MediaPipe Pose (jsDelivr, model from Google's storage), hand/foot glow, calm wave, Save readings CSV
- `motion.js`: all movement math as pure functions (energy, adaptive hand notes and hits, steps, jumps by upward speed, stretch, level, freeze). Thresholds live in `TUNING`
- `music.js`: Tone.js (classic script tag, jsDelivr). `VIBES` (5 sound worlds), a 16th-note sequencer with 4 energy layers, `VOICES` for move sounds. `safe()` nudges same-time hits on one-voice drums
- `analytics.js`: GA4 (same property as the portfolio and Trail Prep)
- `tuning-data/` (gitignored): body points + beat envelopes captured from dance clips. Never commit

## Rules
- Keep it free: no API keys, no accounts, no paid services. Music is generated in the browser with Tone.js, never copyrighted recordings.
- The camera view never leaves the device. Never upload, record or count video or body points. Count only actions and moods.
- Tuning videos and `tuning-data/` are gitignored. Never commit them or name the dancers in public files; only share numbers measured from them.
- Keep the screen minimal: no skeleton, no move labels. She wants to see herself; music is the feedback.
- Keep it simple to read. Suhitha is learning; prefer clear code and short comments over clever code.
- Test with `python3 -m http.server 8000` and open http://localhost:8000.
