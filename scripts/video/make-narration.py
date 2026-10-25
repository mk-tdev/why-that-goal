#!/usr/bin/env python3
"""Generate local stock-voice narration on macOS; no external speech API or cloned voice."""
from pathlib import Path
import json, subprocess
root=Path(__file__).resolve().parents[2]
base=root/'artifacts/demo'
chapters=json.loads(Path(__file__).with_name('chapters.json').read_text())
(base/'audio').mkdir(parents=True,exist_ok=True)
(base/'chapters.json').write_text(json.dumps(chapters,indent=2)+'\n')
for i,chapter in enumerate(chapters):
 path=base/f'audio/{i:02}.txt';path.write_text(chapter['speech'])
 rate='145' if i in (1,2) else '150'
 subprocess.run(['say','-v','Daniel','-r',rate,'-f',str(path),'-o',str(base/f'audio/{i:02}.aiff')],check=True)
