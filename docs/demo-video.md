# Demo video master — 25 October 2026

The current clean export is **110.000 seconds**, 1920×1080 at 30 fps, H.264/yuv420p. It has **no audio, no burned subtitles and no embedded subtitle tracks**. Original application text and editorial chapter headings remain. The user will record their own voiceover using the separate [timed narration script](demo-narration-script.md).

Local deliverables, under ignored `artifacts/demo/`:

- `why-that-goal-demo-clean.mp4` — current silent export for adding your own voiceover.
- `why-that-goal-demo-clean-package.zip` — clean video, timed script, thumbnail, description and verification.
- `timed-narration-script.md` and `timed-narration-script.txt` — chapter recording windows and exact picture cues.
- `why-that-goal-thumbnail.jpg` — original branded thumbnail.
- `upload-description.txt` — title, links, chapters and disclosures.
- `capture-provenance.json`, `edit-decision-list.json`, `clean-video-verification.json` — source/edit and technical checks.

The older `why-that-goal-hackathon-demo.mp4` is superseded: it included synthetic speech and two subtitle layers. Do not use that version. The current clean package excludes it.

This is recorded from **external Google Chrome**, not the in-app browser, using the real public Azure deployment. Original captured page frames are 1920×873. They are framed on a 1080p canvas with an empty lower margin outside the application picture; selected inspection panels are cropped/enlarged for readability. The timeline uses hard cuts between authentic takes and static-panel holds. Live feed playback remains real-time. No application UI, model approval, metric or event outcome is fabricated.

The first app take uses revision `why-that-goal--0000001`; the final producer take uses `why-that-goal--0000002`. Recording exposed a misleading cached-output description in the console. That label was corrected and deployed before the producer take. The final feed ran with the console already mounted, so displayed arrivals were actually observed there. Cached model outputs and separately recorded test results retain their labels.

No voiceover, music or captions are included in this export. Original title cards use the app's palette and a simple original pitch-line graphic. The separate script supplies chapter-level timing, rather than claiming word-level alignment.

## Timeline

| Time | Real product evidence |
| --- | --- |
| 0–10s | Public demo URL and original synthetic stadium; no login. |
| 10–32s | Paced live events, updating notebook, goal outcome and actual reviewed/cached Foundry label. |
| 32–50s | Goal recap and the cited 72:08 receiving-run replay with camera and pitch evidence. |
| 50–68s | Five-stage pipeline, three specialized roles, current shared snapshot and genuine revision handoffs. |
| 68–82s | Separately recorded false-save test, 40/40 deterministic checks, four authored cases and visible limits. |
| 82–100s | Passwordless entry, signal chain, observed event arrivals, process-local monitoring, actual Take Graphic to Air click, red PGM tally and lower third. |
| 100–110s | Public demo and repository URLs; closing line. |

## Verification

- Container duration: 110.000 seconds, below two minutes.
- Exactly one video stream; no audio or subtitle streams.
- Full MP4 decode checked with ffmpeg.
- Subtitle rendering is disabled entirely for the clean export.
- App tests: 97 passing; production build passed after the cached-label correction (previous app validation).
- Clean export hash and stream checks are stored in `clean-video-verification.json`.

## Reproduce the edit locally

Capture the actual public browser interactions through the supported browser tools into timestamped JPEG clips under `artifacts/demo/raw/`. Each clip folder contains `frames.json` with `file` and CDP `time` fields. This source footage is intentionally not committed to Git. Do not substitute generated UI screenshots.

On macOS with Pillow, ffmpeg and ffprobe:

```sh
python3 scripts/video/render-demo.py --preview
python3 scripts/video/render-demo.py
```

Use a Python environment with Pillow; the bundled workspace Python was used for this export. Fonts currently reference installed Avenir Next and DIN Condensed. The script preserves recorded timestamp spacing, samples at 30 fps, holds static panels, creates a silent, caption-free video by default. The optional `--narrated` variant requires running `make-narration.py` first and uses only burned captions, avoiding duplicate subtitle layers. Narration text is versioned in `scripts/video/chapters.json`.

## Final uploaded video and entry

The entrant provided https://www.youtube.com/watch?v=qVZuNPllBsk on 25 October 2026. It opens, plays and displays 1:50 in the existing browser session. Signed-out playback remains to be independently confirmed. Use this public URL in the existing Innovation Studio project, alongside the finished pitch and public repository. Portal completion and entrant declarations remain separate from producing/uploading this video.
