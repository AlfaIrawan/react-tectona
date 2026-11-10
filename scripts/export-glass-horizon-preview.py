"""Export a small animated proof from the encoded video, not the production asset."""
from pathlib import Path
import cv2
from PIL import Image

root=Path(__file__).resolve().parents[1]
cap=cv2.VideoCapture(str(root/'public/images/themes/tectona-steel-glass-horizon-motion-v2.webm'))
frames=[];palette=None;index=0
while True:
    ok,frame=cap.read()
    if not ok:break
    if index%3==0:
        frame=cv2.cvtColor(cv2.resize(frame,(640,360),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2RGB)
        image=Image.fromarray(frame)
        if palette is None:palette=image.quantize(colors=256)
        frames.append(image.quantize(palette=palette,dither=Image.Dither.NONE))
    index+=1
cap.release();assert len(frames)==72
output=root.parents[1]/'Artifacts/tectona-glass-horizon-motion-preview.gif'
frames[0].save(output,save_all=True,append_images=frames[1:],duration=167,loop=0,optimize=False)
print(str(output))
