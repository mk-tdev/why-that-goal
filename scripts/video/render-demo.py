#!/usr/bin/env python3
"""Render the submission edit from authentic Chrome CDP frame captures.
Requires Pillow, ffmpeg and ffprobe. Source footage stays in ignored artifacts/demo/raw.
No UI pixels, model output, metrics or approval states are fabricated by this renderer.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import bisect, json, math, re, subprocess, sys
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'artifacts/demo'
W,H,FPS=1920,1080,30
GOLD='#efbd7c'; TEAL='#79d7c4'; WHITE='#edf3f4'; MUTED='#a9bdc5'; BG='#08131c'
fontpath='/System/Library/Fonts/Avenir Next.ttc'
font=lambda size: ImageFont.truetype(fontpath,size)
titlefont=lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf',size)
chapters_path=BASE/'chapters.json' if (BASE/'chapters.json').exists() else Path(__file__).with_name('chapters.json')
chapters=json.loads(chapters_path.read_text())
# duration, source, source offset, optional crop. Source time is preserved; still panels hold.
shots=[
 (3,'title',0,None),(7,'01-stadium',0,None),
 (20,'02-live',0,None),(2,'02b-reviewed',0,(1160,350,760,523)),
 (6,'03-recap',0,(140,210,1380,650)),(12,'03b-evidence-run',0,None),
 (6,'04-pipeline',0,(370,28,1180,580)),(8,'04b-agents',0,(370,190,1180,650)),
 (4,'04c-handoffs',0,(390,230,1140,600)),
 (14,'05-review-test',0,(390,325,1140,510)),
 (5,'06-entry-final',0,None),(3,'06b-chain-metrics',0,(115,80,850,410)),
 (2,'06b-chain-metrics',3,(115,500,1750,310)),
 (8,'06d-onair',0,None),(10,'closing',0,None),
]
assert abs(sum(s[0] for s in shots)-110)<0.001

def probe(path):
 return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(path)]))['format']

def wrap(text,f,maxw):
 d=ImageDraw.Draw(Image.new('RGB',(1,1))); lines=[]; line=''
 for word in text.split():
  candidate=(line+' '+word).strip()
  if line and d.textlength(candidate,font=f)>maxw: lines.append(line);line=word
  else: line=candidate
 if line:lines.append(line)
 return lines

def center(d,text,y,f,color=WHITE):
 d.text(((W-d.textlength(text,font=f))/2,y),text,font=f,fill=color)

def card(closing=False):
 im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
 # Original graphic treatment inspired by a tactical pitch, not another product's asset.
 for x in range(1050,2000,90): d.line((x,0,x-400,H),fill='#10232c',width=2)
 d.ellipse((1190,200,1800,810),outline='#244942',width=3)
 d.ellipse((1375,385,1615,625),outline='#35584e',width=2)
 d.line((108,135,108,850),fill=GOLD,width=5)
 d.text((160,140),'WTG / ORIGINAL SYNTHETIC MATCH INTELLIGENCE',font=font(25),fill=GOLD)
 if not closing:
  d.text((155,235),'WHY THAT GOAL?',font=titlefont(135),fill=WHITE)
  d.text((160,405),'See the play behind the finish.',font=font(42),fill=TEAL)
  d.text((160,535),'REAL DEPLOYED APP  /  RECORDED IN CHROME',font=font(23),fill=MUTED)
  d.text((160,595),'why-that-goal.blacksand-18241469.',font=font(31),fill=WHITE)
  d.text((160,640),'southeastasia.azurecontainerapps.io',font=font(31),fill=WHITE)
  d.text((160,735),'Fictional match data. No account or password required.',font=font(25),fill=GOLD)
 else:
  d.text((155,225),'SEE THE PLAY.',font=titlefont(130),fill=WHITE)
  d.text((155,355),'BEHIND THE FINISH.',font=titlefont(130),fill=TEAL)
  d.text((160,535),'PUBLIC DEMO',font=font(22),fill=GOLD)
  d.text((160,575),'https://why-that-goal.blacksand-18241469.',font=font(28),fill=WHITE)
  d.text((160,615),'southeastasia.azurecontainerapps.io',font=font(28),fill=WHITE)
  d.text((160,695),'PUBLIC SOURCE',font=font(22),fill=GOLD)
  d.text((160,735),'https://github.com/mk-tdev/why-that-goal',font=font(30),fill=WHITE)
  d.text((160,815),'Ingest  →  Interpret  →  Explain  →  Render  →  Personalize',font=font(25),fill=MUTED)
 return im

card(False).save(BASE/'why-that-goal-thumbnail.jpg',quality=96)

# Silent, caption-free export is the default; narration is an explicit optional variant.
clean='--narrated' not in sys.argv
subs=[]; audio=[]
if not clean:
 for i,c in enumerate(chapters):
  path=BASE/f'audio/{i:02}.aiff'; duration=float(probe(path)['duration'])
  allowed=c['end']-c['start']-.6
  speed=max(1,duration/allowed)
  out=BASE/f'audio/{i:02}.wav'
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-af',f'atempo={speed:.6f},adelay=300|300,loudnorm=I=-16:TP=-1.5:LRA=7,asetpts=N/SR/TB,apad,atrim=duration={c["end"]-c["start"]}', '-ar','48000','-ac','2',str(out)],check=True)
  audio.append(out)
  # Natural clause groups, with words-per-group timing approximating the generated speech.
  parts=re.split(r'(?<=[.!?])\s+',c['speech'])
  groups=[]
  for part in parts:
   words=part.split()
   while len(words)>15:
    split=next((j+1 for j in range(8,min(15,len(words))) if words[j].endswith((',',':',';'))),12)
    groups.append(' '.join(words[:split]));words=words[split:]
   if words:groups.append(' '.join(words))
  total=sum(len(g.split()) for g in groups); t=c['start']+.3
  spoken=duration/speed
  for g in groups:
   end=t+spoken*len(g.split())/total
   subs.append((t,end,g));t=end

 concat=BASE/'audio/concat.txt';concat.write_text(''.join(f"file '{p.as_posix()}'\n" for p in audio))
 subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','pcm_s16le',str(BASE/'narration.wav')],check=True)

 def srt_time(t):
  ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
 (BASE/'why-that-goal-demo.srt').write_text('\n\n'.join(f'{i+1}\n{srt_time(a)} --> {srt_time(b)}\n{text}' for i,(a,b,text) in enumerate(subs))+'\n')

# Prepare recordings with their genuine timestamp spacing. Do not invent intermediate states.
records={}
for _,name,_,_ in shots:
 if name in ('title','closing') or name in records:continue
 folder=BASE/'raw'/name;rows=json.loads((folder/'frames.json').read_text());assert rows,name
 records[name]=(folder,rows,[r['time']-rows[0]['time'] for r in rows])

caption_cache={}
for _,_,text in subs:
 overlay=Image.new('RGBA',(W,150),(0,0,0,0));d=ImageDraw.Draw(overlay);lines=wrap(text,font(32),1740)
 if len(lines)>2:lines=wrap(text,font(29),1780)
 y=22 if len(lines)==2 else 44
 for line in lines: center(d,line,y,font(32 if len(lines)<=2 else 29));y+=43
 caption_cache[text]=overlay

silent=BASE/('why-that-goal-demo-clean.mp4' if clean else 'picture-only.mp4')
command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)]
preview='--preview' in sys.argv
process=None if preview else subprocess.Popen(command,stdin=subprocess.PIPE)
elapsed=0;cached_key=None;cached_image=None;story=[]
for duration,name,offset,crop in shots:
 start=elapsed; elapsed+=duration
 chapter=next(c for c in chapters if start>=c['start'] and start<c['end'])
 story.append({'start':start,'end':elapsed,'source':name,'sourceOffset':offset,'crop':crop})
 sample_indices=[round(duration*FPS/2)] if preview else range(round(duration*FPS))
 for i in sample_indices:
  t=start+i/FPS
  if name in ('title','closing'):
   key=name
   if cached_key!=key:cached_image=card(name=='closing');cached_key=key
   frame=cached_image.copy()
  else:
   folder,rows,times=records[name];st=i/FPS+offset
   idx=max(0,min(len(rows)-1,bisect.bisect_right(times,st)-1));key=(name,idx,crop)
   if key!=cached_key:
    image=Image.open(folder/rows[idx]['file']).convert('RGB')
    if crop:
     x,y,w,h=crop;image=image.crop((x,y,x+w,y+h))
    # Keep all screenshot pixels in the visible picture area, including recorded-test limits.
    factor=min(1920/image.width,873/image.height)
    image=image.resize((round(image.width*factor),round(image.height*factor)),Image.Resampling.LANCZOS)
    cached_image=image;cached_key=key
   frame=Image.new('RGB',(W,H),BG);frame.paste(cached_image,((W-cached_image.width)//2,48+(873-cached_image.height)//2))
  d=ImageDraw.Draw(frame)
  d.rectangle((0,0,W,47),fill=BG)
  d.text((40,12),chapter['title'],font=font(21),fill=GOLD)
  right='REAL CHROME CAPTURE · SYNTHETIC DATA' if name not in ('title','closing') else 'WHY THAT GOAL? / HACKATHON DEMO'
  d.text((W-40-d.textlength(right,font=font(18)),15),right,font=font(18),fill=MUTED)
  d.line((0,47,W,47),fill='#29434a',width=1)
  sub=next((text for a,b,text in subs if a<=t<b),None)
  if sub:frame.paste(caption_cache[sub],(0,924),caption_cache[sub])
  d=ImageDraw.Draw(frame)
  d.rectangle((0,1073,W,1079),fill='#142831');d.rectangle((0,1073,int(W*t/110),1079),fill=GOLD)
  if preview:frame.save(BASE/f'graphics/preview-{start:05.1f}-{name}.jpg',quality=95)
  else:process.stdin.write(frame.tobytes())
 print(json.dumps({'shot':name,'timelineEnd':elapsed,'preview':preview}),flush=True)
if not preview:
 process.stdin.close();assert process.wait()==0
 if clean:
  print(json.dumps({'output':str(silent),'duration':probe(silent)['duration'],'audio':False,'subtitles':False}),flush=True)
 else:
  final=BASE/'why-that-goal-hackathon-demo.mp4'
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(BASE/'narration.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-metadata','title=Why That Goal? — See the Play Behind the Finish','-metadata','comment=Edited screen recording of the real public app in Chrome. Original synthetic match data. Recorded evaluation panels retain their limitations. Locally synthesized English narration.','-t','110','-movflags','+faststart',str(final)],check=True)
  print(json.dumps({'output':str(final),'duration':probe(final)['duration']}),flush=True)
(BASE/'edit-decision-list.json').write_text(json.dumps(story,indent=2)+'\n')
