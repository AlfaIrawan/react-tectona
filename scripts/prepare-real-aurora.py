"""Prepare an attributed real aurora shot from CC BY 3.0 footage.
Source: Harriniva Hotels&Safaris, Aurora borealis timelapse (2013),
https://commons.wikimedia.org/wiki/File:Aurora_borealis_timelapse.webm
"""
from pathlib import Path
import urllib.request, sys, json, subprocess
import cv2
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'.theme-render/real-aurora'
WORK.mkdir(parents=True,exist_ok=True)
SOURCE=WORK/'aurora-borealis-original.webm'
URL='https://upload.wikimedia.org/wikipedia/commons/d/df/Aurora_borealis_timelapse.webm'
if not SOURCE.exists():
    request=urllib.request.Request(URL,headers={'User-Agent':'TectonaAssetPreparation/1.0'})
    with urllib.request.urlopen(request,timeout=60) as response, SOURCE.with_suffix('.part').open('wb') as output:
        while chunk:=response.read(1024*1024):output.write(chunk)
    SOURCE.with_suffix('.part').replace(SOURCE)
capture=cv2.VideoCapture(str(SOURCE))
assert capture.isOpened()
fps=capture.get(cv2.CAP_PROP_FPS)
if '--inspect' in sys.argv:
    sheet=Image.new('RGB',(1280,4*202),(12,16,24))
    draw=ImageDraw.Draw(sheet)
    for index,second in enumerate(range(0,128,8)):
        capture.set(cv2.CAP_PROP_POS_MSEC,second*1000)
        ok,pixels=capture.read();assert ok
        image=Image.fromarray(cv2.cvtColor(cv2.resize(pixels,(320,180)),cv2.COLOR_BGR2RGB))
        x=(index%4)*320;y=(index//4)*202
        sheet.paste(image,(x,y));draw.text((x+8,y+183),f'{second}s',fill='white')
    sheet.save(WORK/'contact-sheet.jpg')
    capture.release()
    print(json.dumps({'source_bytes':SOURCE.stat().st_size,'fps':fps,'sheet':str(WORK/'contact-sheet.jpg')}))
    sys.exit(0)

# One continuous shot, selected after inspecting the source contact sheet.
START=float(sys.argv[sys.argv.index('--start')+1]) if '--start' in sys.argv else 32
cinematic='--cinematic' in sys.argv
SECONDS=12
FPS=30 if cinematic else 24
W,H=(1920,1080) if cinematic else (1280,720)
capture.release()
graded='--silver-grade' in sys.argv or cinematic
variant='tectona-silver-aurora-cinematic-v4' if cinematic else ('tectona-silver-aurora-gray-blue-v3' if graded else 'tectona-silver-real-aurora-v2')
out=ROOT/f'public/images/themes/{variant}.webm'
sys.path.insert(0,str(ROOT/'.theme-render/tooling'))
import imageio_ffmpeg
filters=f'scale={W}:{H},fps={FPS}'
if cinematic:filters+=",hqdn3d=1:1:2:2"
if graded:
    # Preserve captured light detail and movement, remap its luminance to the
    # Silver theme's neutral shadows and pale blue/silver highlights.
    filters+=",colorchannelmixer=rr=.15:rg=.75:rb=.1:gr=.15:gg=.75:gb=.1:br=.15:bg=.75:bb=.1"
    if cinematic:
        filters+=",curves=red='0/.10 .22/.25 .5/.57 .75/.80 1/.98':green='0/.12 .22/.29 .5/.64 .75/.86 1/1':blue='0/.16 .22/.36 .5/.74 .75/.94 1/1'"
        filters+=",unsharp=5:5:0.45:3:3:0,vignette=PI/10"
    else:
        filters+=",curves=red='0/.20 .5/.60 1/.95':green='0/.22 .5/.66 1/.98':blue='0/.26 .5/.74 1/1'"
if '--grade-preview' in sys.argv:
    preview_path=ROOT.parents[1]/f'Artifacts/{variant}.png'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
        '-ss',str(START),'-i',str(SOURCE),'-vf',filters,'-frames:v','1',str(preview_path)],check=True)
    print(str(preview_path));sys.exit(0)
if '--preview-existing' not in sys.argv:
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
        '-ss',str(START),'-i',str(SOURCE),'-t',str(SECONDS),
        '-vf',filters, '-an','-c:v','libvpx-vp9',
        '-crf','24' if cinematic else '32','-b:v','1800k' if cinematic else '1000k',
        '-maxrate','2600k','-bufsize','5200k','-row-mt','1','-deadline','good',
        '-cpu-used','4','-threads','4',str(out)],check=True)
capture=cv2.VideoCapture(str(out))
frames=[];count=0
sample_every=round(FPS/8)
while True:
    ok,frame=capture.read()
    if not ok:break
    if count==0:cv2.imwrite(str(out.with_suffix('.png')),frame)
    if count%sample_every==0:frames.append(cv2.resize(frame,(640,360),interpolation=cv2.INTER_AREA))
    count+=1
capture.release()
assert count==SECONDS*FPS
assert out.stat().st_size<5*1024*1024
preview=[];palette=None
# Preview the same steady-state 1.6-second crossfade used by the app player.
fade=round(1.6*FPS/sample_every)
loop=frames[fade:-fade]+[cv2.addWeighted(frames[-fade+i],1-(i+1)/fade,frames[i],(i+1)/fade,0) for i in range(fade)]
for frame in loop:
    image=Image.fromarray(cv2.cvtColor(cv2.resize(frame,(640,360)),cv2.COLOR_BGR2RGB))
    if palette is None:palette=image.quantize(colors=256)
    preview.append(image.quantize(palette=palette,dither=Image.Dither.NONE))
gif=ROOT.parents[1]/f'Artifacts/{variant}.gif'
preview[0].save(gif,save_all=True,append_images=preview[1:],duration=round(1000*sample_every/FPS),loop=0,optimize=False)
print(json.dumps({'video':str(out),'preview':str(gif),'bytes':out.stat().st_size,'source_start_seconds':START,'duration_seconds':SECONDS,'loop':'player crossfade, not a falsely seamless source shot'}))
