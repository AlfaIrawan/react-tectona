"""Encode approved-frame animation without overwriting the approved poster."""
from pathlib import Path
import cv2,json,sys,shutil

root=Path(__file__).resolve().parents[1]
visible_motion = 'motion-v2' in sys.argv
variant = 'glass-horizon-motion-v2' if visible_motion else 'glass-horizon-v1'
frames=sorted((root/('.theme-render/'+variant)).glob('*.png'))
assert len(frames)==216, f'Incomplete animation: {len(frames)}/216 frames'
first=cv2.imread(str(frames[0])); height,width=first.shape[:2]
target=root/('public/images/themes/tectona-steel-'+variant+'.webm')
writer=cv2.VideoWriter(str(target),cv2.VideoWriter_fourcc(*'VP80'),18,(width,height))
assert writer.isOpened()
for path in frames:
    frame=cv2.imread(str(path)); assert frame.shape==first.shape; writer.write(frame)
writer.release()
if visible_motion:shutil.copyfile(frames[0],target.with_suffix('.png'))
capture=cv2.VideoCapture(str(target)); assert int(capture.get(cv2.CAP_PROP_FRAME_COUNT))==216
ok,start=capture.read(); capture.set(cv2.CAP_PROP_POS_FRAMES,215); last_ok,last=capture.read(); capture.release()
assert ok and last_ok
delta=float(cv2.absdiff(start,last).mean())
assert delta<2, f'Unexpected hard loop boundary: {delta}'
motion = None
if visible_motion:
    import numpy as np
    capture=cv2.VideoCapture(str(target)); capture.set(cv2.CAP_PROP_POS_FRAMES,54); quarter_ok,quarter=capture.read(); capture.release()
    assert quarter_ok
    shift,response=cv2.phaseCorrelate(np.float32(cv2.cvtColor(start,cv2.COLOR_BGR2GRAY)),np.float32(cv2.cvtColor(quarter,cv2.COLOR_BGR2GRAY)))
    motion={'horizontal_shift_pixels_at_3s':float(shift[0]),'vertical_shift_pixels_at_3s':float(shift[1]),'correlation':float(response)}
    assert abs(shift[0])>12, f'Motion still too subtle: {motion}'
print(json.dumps({'video':target.name,'duration_seconds':12,'fps':18,'size_bytes':target.stat().st_size,'loop_boundary_mean_pixel_delta':delta,'motion':motion,'basis':'approved still with image-based camera/illumination animation, not independent 3D glass objects','default_and_silver_written':False}))
