"""Encode versioned Blender loops; retain each renderer's provenance metadata."""
from pathlib import Path
import cv2, json, sys
from PIL import Image

root=Path(__file__).resolve().parents[1]
variant=next((v for v in ['glass-horizon-flex-v5','glass-flow-v4'] if v in sys.argv),'glass-ribbons-v3')
source=root/'.theme-render'/variant
frames=sorted(source.glob('[0-9][0-9][0-9][0-9].png'))
geometry=json.loads((source/'geometry.json').read_text())
count=geometry.get('frames',216)
fps=geometry.get('fps',18)
assert len(frames)==count, f'Incomplete render: {len(frames)}/{count}'
assert geometry['camera_fixed']
if variant=='glass-horizon-flex-v5':
    assert geometry['deforming_regions']==3 and geometry['image_textures']==1
else:
    assert geometry['deforming_meshes']==3
    assert geometry['image_textures']==0 and geometry['max_vertex_displacement']>.3
target=root/f'public/images/themes/tectona-steel-{variant}.webm'
writer=cv2.VideoWriter(str(target),cv2.VideoWriter_fourcc(*'VP80'),fps,(1280,720))
assert writer.isOpened()
for index,path in enumerate(frames):
    frame=cv2.imread(str(path))
    assert frame.shape[:2]==(720,1280)
    # Suppress EEVEE sampling grain before inter-frame compression.
    if variant!='glass-horizon-flex-v5':frame=cv2.GaussianBlur(frame,(5,5),.85)
    if index==0:cv2.imwrite(str(target.with_suffix('.png')),frame)
    writer.write(frame)
writer.release()
capture=cv2.VideoCapture(str(target))
assert int(capture.get(cv2.CAP_PROP_FRAME_COUNT))==count
ok,first=capture.read()
capture.set(cv2.CAP_PROP_POS_FRAMES,count-1);last_ok,last=capture.read()
capture.release();assert ok and last_ok
boundary=float(cv2.absdiff(first,last).mean())
assert boundary<2, f'Visible loop seam: {boundary}'
assert target.stat().st_size<5*1024*1024
capture=cv2.VideoCapture(str(target))
preview=[];palette=None;index=0
while True:
    ok,frame=capture.read()
    if not ok:break
    if index%3==0:
        image=Image.fromarray(cv2.cvtColor(cv2.resize(frame,(640,360)),cv2.COLOR_BGR2RGB))
        if palette is None:palette=image.quantize(colors=128)
        preview.append(image.quantize(palette=palette,dither=Image.Dither.NONE))
    index+=1
capture.release()
artifact=root.parents[1]/f'Artifacts/tectona-{variant}.gif'
preview[0].save(artifact,save_all=True,append_images=preview[1:],duration=round(3000/fps),loop=0,optimize=False)
print(json.dumps({'video':str(target),'preview':str(artifact),'bytes':target.stat().st_size,'loop_boundary_mean_delta':boundary,**geometry}))
