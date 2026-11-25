"""Encode and verify the 2.5D concept, without installing it in the platform."""
from pathlib import Path
import sys, subprocess, json, shutil
import cv2
from PIL import Image
root=Path(__file__).resolve().parents[1]
hires='--hires' in sys.argv
feather='--feather' in sys.argv
orb_mode='--steel-orb' in sys.argv
work=root/('.theme-render/silver-feather-v1' if feather else '.theme-render/silver-ribbon-hq-v2' if hires else '.theme-render/silver-ribbon-preview')
if orb_mode:work=root/'.theme-render/steel-glass-orb-v1'
assert len(list(work.glob('[0-9][0-9][0-9][0-9].png')))==192
sys.path.insert(0,str(root/'.theme-render/tooling'))
import imageio_ffmpeg
target=root/'public/images/themes/tectona-silver-ribbon-hq-loop-v2.webm' if hires else root.parents[1]/'Artifacts/tectona-silver-ribbon-loop-preview.webm'
if feather:target=root.parents[1]/'Artifacts/tectona-silver-feather-loop-v1.webm'
if orb_mode:target=root/'public/images/themes/tectona-steel-glass-orb-loop-v1.webm'
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
    '-framerate','24','-i',str(work/'%04d.png'),'-an','-pix_fmt','yuv420p','-c:v','libvpx-vp9',
    '-crf','18' if hires or feather or orb_mode else '28','-b:v','0','-row-mt','1','-cpu-used','4','-threads','4',str(target)],check=True)
cap=cv2.VideoCapture(str(target))
assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT))==192
frames=[];first=None;last=None;palette=None;index=0
while True:
    ok,pixels=cap.read()
    if not ok:break
    if first is None:
        first=pixels.copy()
        if hires or orb_mode:shutil.copyfile(work/'0000.png',target.with_suffix('.png'))
    last=pixels
    if index%3==0:
        size=(480,round(480*pixels.shape[0]/pixels.shape[1])) if feather or orb_mode else (477,299)
        image=Image.fromarray(cv2.cvtColor(cv2.resize(pixels,size),cv2.COLOR_BGR2RGB))
        if palette is None:palette=image.quantize(colors=256)
        frames.append(image.quantize(palette=palette,dither=Image.Dither.NONE))
    index+=1
cap.release()
assert index==192 and len(frames)==64
seam=float(cv2.absdiff(first,last).mean())
assert seam<1.5, f'Visible loop seam: {seam}'
gif=root.parents[1]/'Artifacts/tectona-silver-ribbon-hq-loop-v2.gif' if hires else target.with_suffix('.gif')
if orb_mode:gif=root.parents[1]/'Artifacts/tectona-steel-glass-orb-loop-v1.gif'
frames[0].save(gif,save_all=True,append_images=frames[1:],duration=125,loop=0,optimize=False)
print(json.dumps({'video':str(target),'gif':str(gif),'seconds':8,'loop_boundary_delta':seam,'bytes':target.stat().st_size,'kind':'2.5D image deformation with fixed camera; not a newly simulated 3D object'}))
