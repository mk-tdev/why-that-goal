# Demo video master — 25 October 2026

The local upload master is complete: **110.000 seconds**, 1920×1080 at 30 fps, H.264/yuv420p video and 48 kHz stereo AAC narration. It includes burned-in English captions and an optional embedded English subtitle track. The MP4 is approximately 11.4 MB with fast-start playback.

Local deliverables, under ignored `artifacts/demo/`:

- `why-that-goal-hackathon-demo.mp4` — upload this master to the permitted public video host.
- `why-that-goal-demo-upload.zip` — master, subtitles, thumbnail, description, edit/provenance records and verification.
- `why-that-goal-demo.srt` — optional separate English captions.
- `why-that-goal-thumbnail.jpg` — original branded thumbnail.
- `upload-description.txt` — title, links, chapters and disclosures ready to paste.
- `capture-provenance.json`, `edit-decision-list.json`, `video-verification.json` — source/edit and technical checks.

This is recorded from **external Google Chrome**, not the in-app browser, using the real public Azure deployment. Original captured page frames are 1920×873. They are framed on a 1080p canvas with captions outside the application picture; selected inspection panels are cropped/enlarged for readability. The timeline uses hard cuts between authentic takes and static-panel holds. Live feed playback remains real-time. No application UI, model approval, metric or event outcome is fabricated.

The first app take uses revision `why-that-goal--0000001`; the final producer take uses `why-that-goal--0000002`. Recording exposed a misleading cached-output description in the console. That label was corrected and deployed before the producer take. The final feed ran with the console already mounted, so displayed arrivals were actually observed there. Cached model outputs and separately recorded test results retain their labels.

English narration uses the installed stock macOS **Daniel** voice. There is no cloned voice, copyrighted music or third-party football footage. Original title cards use the app's palette and a simple original pitch-line graphic. Captions approximate phrase timing, rather than claiming word-level alignment.

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

- Container duration: 110.000 seconds, safely below two minutes.
- Video and narration streams both run for the complete 110 seconds.
- Full MP4 decode completed without errors; the final picture storyboard was inspected across all chapters.
- Audio integrated loudness: approximately −16.4 LUFS; measured true peak −4.3 dBFS, with no clipping.
- Optional subtitle stream is English; a separate SRT is included.
- App tests: 97 passing; production build passes after the cached-label correction.
- The final master SHA-256 is stored in `video-verification.json`.

The first audio check caught a normalization timestamp offset that shortened chapter audio; it was fixed and the complete 110-second narration re-exported before delivery. Only the corrected master belongs in the upload package.

## Reproduce the edit locally

Capture the actual public browser interactions through the supported browser tools into timestamped JPEG clips under `artifacts/demo/raw/`. Each clip folder contains `frames.json` with `file` and CDP `time` fields. This source footage is intentionally not committed to Git. Do not substitute generated UI screenshots.

On macOS with the installed Daniel voice, Pillow, ffmpeg and ffprobe:

```sh
python3 scripts/video/make-narration.py
python3 scripts/video/render-demo.py --preview
python3 scripts/video/render-demo.py
```

Use a Python environment with Pillow; the bundled workspace Python was used for this export. Fonts currently reference installed Avenir Next and DIN Condensed. The script preserves recorded timestamp spacing, samples at 30 fps, holds static panels, renders captions and creates the final upload format. Narration text is versioned in `scripts/video/chapters.json`.

## Still required for final entry

Upload the master to an allowed public video host, verify playback while signed out, then add its public video URL to the existing Innovation Studio project. This task creates the finished video file; it does not publish a YouTube/Vimeo upload or perform final submission/entrant declarations.
