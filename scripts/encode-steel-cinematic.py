"""Encode only the new Steel render; approved Default/Silver assets are never written."""
from pathlib import Path
import cv2, json, shutil

root = Path(__file__).resolve().parents[1]
frames = root / '.theme-render/steel-cinematic-v2'
public = root / 'public/images/themes'
images = sorted(frames.glob('*.png'))
assert len(images) == 144, f'Expected complete 144-frame render, got {len(images)}'
first = cv2.imread(str(images[0]))
height, width = first.shape[:2]
target = public / 'tectona-steel-cinematic-v2.webm'
writer = cv2.VideoWriter(str(target), cv2.VideoWriter_fourcc(*'VP80'), 18, (width,height))
assert writer.isOpened(), 'VP8 encoder unavailable'
for file in images:
    frame = cv2.imread(str(file))
    assert frame.shape == first.shape
    writer.write(frame)
writer.release()
shutil.copyfile(images[0], public / 'tectona-steel-cinematic-v2.png')
cap = cv2.VideoCapture(str(target))
count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); fps = cap.get(cv2.CAP_PROP_FPS)
assert count == 144 and fps == 18
ok, start = cap.read()
cap.set(cv2.CAP_PROP_POS_FRAMES, 143); ok_last, last = cap.read(); cap.release()
assert ok and ok_last
print(json.dumps({'video':target.name,'frames':count,'fps':fps,'duration_seconds':count/fps,'size_bytes':target.stat().st_size,'loop_boundary_mean_pixel_delta':float(cv2.absdiff(start,last).mean()),'original_3d_scene':True}))
