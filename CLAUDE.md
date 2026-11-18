# Music Moves: notes for Claude Code

Free web app: the camera reads how you move, and the music follows. Built by Suhitha (GitHub: suhibug). Plain HTML, CSS and JavaScript. No build step, no framework, no backend, no paid services.

## Files
- `index.html`: the page
- `app.js`: camera, MediaPipe Pose (loaded from jsDelivr, model from Google's storage), drawing the skeleton, the readings panel
- `motion.js`: all movement math as pure functions (energy, bounce rate, jump, arms up, mood). Thresholds live in `TUNING`
- `analytics.js`: GA4 (same property as the portfolio and Trail Prep)

## Rules
- Keep it free: no API keys, no accounts, no paid services. Music is generated in the browser (Tone.js planned), never copyrighted recordings.
- The camera view never leaves the device. Never upload, record or count video or body points. Count only actions and moods.
- Tuning videos go in `tuning-videos/` (gitignored). Never commit them; only share numbers measured from them.
- Keep it simple to read. Suhitha is learning; prefer clear code and short comments over clever code.
- Test with `python3 -m http.server 8000` and open http://localhost:8000.
