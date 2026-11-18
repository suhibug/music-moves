# Music Moves

**We've always moved to the music. What if the music moved to us?**

A free web app that turns your movement into music. Pick a sound world, dance in front of your camera, and the way you move plays it.

**Try it:** https://suhibug.github.io/music-moves/

## How it works

1. **Pick a sound world:** Amapiano, House, Afro-Brazil, Hip hop or Calm. Each has its own tempo, chords, drums and instruments, all generated live with [Tone.js](https://tonejs.github.io/). No recordings, so nothing is copyrighted and nothing costs money.
2. **The camera finds your body.** [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) finds points on your body about 30 times a second, right in the browser.
3. **Your movement plays the music:**

| You | The music |
|---|---|
| Move more | Layers come in: a soft bed, then percussion and bass, then full drums, then the top layer |
| A sharp hit (a burst, then a stop) | An accent: a log drum, a chord stab, a surdo, a snare and 808 |
| Fast hand moves | Melody notes. Higher hand, higher note, always in key |
| Steps and stomps | Light percussion |
| Stretch wide | A long, warm swell |
| Go low | The sound gets darker, with a deep drop |
| Jump | A crash and a boom |
| Both arms up | A rising whoosh |
| Freeze | The music fades to a hum until you move again |

Everything lands on the beat grid, and layers only change on the first beat of a bar, so it always stays in time.

## How it was tuned

The first version used guessed thresholds and felt jumpy. I tuned it on 22 short clips of dancers in hip hop, house, amapiano and Afro-Brazilian styles (kept private, never committed), measuring body speed, hand speed, foot speed, stretch and height for each:

- **Energy alone can't tell genres apart.** Every dancer moved fast, so the old version called almost everything "Rave". Now you pick the sound world, and movement shapes it.
- **Fixed thresholds swing too much between dancers and cameras.** One dancer set off four times as many hand notes as another. Hand notes and hits are now measured against *your own* usual speed over the last few seconds.
- **Jumps were over-counted** when dancers moved toward the camera (their feet move up on screen). Jumps are now detected by upward speed of both feet and the hips together.

## Seeing your whole body

On a phone, start, tap ⋯ and pick the back **Ultra Wide** camera (the 0.5x lens). Prop the phone at about knee height, tilted up a little, a few steps away. On Android, the app zooms out as far as the camera allows. You can also tap **Use a video** to play music from a saved clip.

## Privacy

Your video never leaves your device. Nothing is recorded or uploaded. The only thing counted is anonymous usage (music started, which sound world, how many layers were reached) through Google Analytics.

## Roadmap

- [x] Step 1: camera, body tracking, energy meter
- [x] Step 2: generated music in five sound worlds, played by your movement
- [x] Step 3: tuned on real dance clips (**Save readings** downloads the numbers, never the video)
- [ ] Step 4: share a clip, plus usage data in my [personal analytics dashboard](https://github.com/suhibug/personal-analytics)

## Run it yourself

No build step. From this folder run `python3 -m http.server 8000` and open http://localhost:8000. The camera needs `localhost` or `https`.

Built by [Suhitha Lakkunda Rathnakara](https://suhibug.github.io/).
