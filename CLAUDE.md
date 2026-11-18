# Music Moves: notes for Claude Code

Free web app: pixel-art objects float in the air on camera; you grab, stretch, throw, catch and smash them with your hands, and every action makes a sound. Built by Suhitha (GitHub: suhibug). Plain HTML, CSS and JavaScript. No build step, no framework, no backend, no paid services.

## Files
- `index.html`, `style.css`: start screen, full-screen camera, top pills (place, art style), ⋯ settings sheet
- `app.js`: camera, MediaPipe Hand Landmarker (grab = closed hand or pinch, with hysteresis), scene scans every 20 s, draw loop
- `world.js`: objects, hands and physics (grab, two-hand stretch/crush, throw, catch, bat, bounce, shatter, respawn). Pure logic, returns events. Numbers in `TUNE`
- `sound.js`: Tone.js voices per material, events -> notes on the beat grid, stretch pad, a beat that grows with activity and fades when idle. `safe()` nudges same-time hits on one-voice instruments
- `art.js`: draws objects and broken pieces in Pixel, ASCII, Watercolor or 3D from the same 12x12 drawing
- `sprites.js`: the 12x12 drawings, materials, places (room/beach/outdoors), and real objects the detector can spot
- `scene.js`: MediaPipe object detector + image classifier pick the place and spotted objects; palette from the picture
- `analytics.js`: GA4 (same property as the portfolio and Trail Prep)
- `tuning-data/` (gitignored): body data from earlier dance-clip tuning. Never commit

## Rules
- Keep it free: no API keys, no accounts, no paid services. Sound is generated with Tone.js, never copyrighted recordings.
- The camera never leaves the device. Never upload, record or count video, hands or places. Count only actions and choices.
- Silent until the person does something. No background track that plays on its own.
- Keep the screen minimal and artsy: no skeleton, no move labels.
- Never name the dancers from her reference clips in public files.
- Keep it simple to read. Suhitha is learning; prefer clear code and short comments over clever code.
- Test with `python3 -m http.server 8000` and open http://localhost:8000. After testing in a browser, stop the sound and close the browser.
