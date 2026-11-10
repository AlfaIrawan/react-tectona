"""Procedural silver-blue aurora: animated light curtains, fixed viewpoint.
No stock media, source image warping, or changes to other themes.
"""
from pathlib import Path
import sys, json
import numpy as np
import cv2
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/images/themes'
ART=ROOT.parents[1]/'Artifacts'
W,H,FPS,COUNT=1280,720,24,240
X,Y=np.meshgrid(np.linspace(0,1,W,dtype=np.float32),np.linspace(0,1,H,dtype=np.float32))

def frame(phase):
    sky=np.array([151,169,193],dtype=np.float32)[None,None,:]*(1-Y[...,None])
    sky=sky+np.array([232,239,247],dtype=np.float32)[None,None,:]*Y[...,None]
    glow=np.exp(-(((X-.55)/.7)**2+((Y-.46)/.5)**2))
    sky+=glow[...,None]*11
    # Layers have independent folds, rays, and vertical breathing. Their shape
    # returns exactly after one cycle; the image itself never pans or zooms.
    for index in range(3):
        p=phase+index*1.5
        ridge=.49+.12*index-.22*X+.105*np.sin(X*5.7+.35*np.sin(p)+index)
        ridge+=.034*np.sin(X*16+.55*np.cos(p)+index*1.7)
        distance=ridge-Y
        height=.15+.045*np.sin(X*10+index+.6*np.sin(p))
        folds=(.5+.5*np.sin(X*58+1.6*np.sin(X*12+index)+.65*np.sin(p)))**2
        fine=(.5+.5*np.sin(X*190+.8*np.cos(p)+index))**4
        curtain=np.exp(-np.maximum(distance,0)/height)*np.exp(-np.maximum(-distance,0)/.018)
        curtain*=.30+.50*folds+.20*fine
        bloom=np.exp(-(distance/.075)**2)
        core=np.exp(-(distance/.014)**2)
        side=np.maximum(0,np.sin(np.pi*X))**.45
        alpha=np.clip((curtain*.32+bloom*.11+core*.15)*side,0,.7)
        tint=np.array([[160,212,247],[201,215,250],[207,237,250]],dtype=np.float32)[index]
        sky=sky*(1-alpha[...,None])+tint[None,None,:]*alpha[...,None]
        sky+=(core*.085+curtain*.065)[...,None]*np.array([215,240,255],dtype=np.float32)
    haze=np.exp(-((Y-.82)/.22)**2)*.12
    sky=sky*(1-haze[...,None])+np.array([237,242,248])*haze[...,None]
    assert np.isfinite(sky).all()
    return np.uint8(np.clip(sky,0,255))[...,::-1].copy()

target=OUT/'tectona-silver-aurora-v1.webm'
poster=target.with_suffix('.png')
if '--preview' in sys.argv:
    cv2.imwrite(str(ART/'tectona-silver-aurora-preview.png'),frame(0))
    print(str(ART/'tectona-silver-aurora-preview.png'))
    sys.exit(0)
writer=cv2.VideoWriter(str(target),cv2.VideoWriter_fourcc(*'VP80'),FPS,(W,H))
assert writer.isOpened()
preview=[];palette=None
for i in range(COUNT):
    pixels=frame(2*np.pi*i/COUNT)
    if i==0:cv2.imwrite(str(poster),pixels)
    writer.write(pixels)
    if i%3==0:
        image=Image.fromarray(cv2.cvtColor(cv2.resize(pixels,(640,360)),cv2.COLOR_BGR2RGB))
        if palette is None:palette=image.quantize(colors=128)
        preview.append(image.quantize(palette=palette,dither=Image.Dither.NONE))
writer.release()
cap=cv2.VideoCapture(str(target))
assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT))==COUNT
ok,start=cap.read()
cap.set(cv2.CAP_PROP_POS_FRAMES,COUNT-1);end_ok,end=cap.read()
cap.release();assert ok and end_ok
seam=float(cv2.absdiff(start,end).mean())
assert seam<1.5 and target.stat().st_size<2*1024*1024
assert np.abs(frame(0).astype(float)-frame(2*np.pi).astype(float)).mean()<.01
gif=ART/'tectona-silver-aurora-v1.gif'
preview[0].save(gif,save_all=True,append_images=preview[1:],duration=125,loop=0,optimize=False)
print(json.dumps({'video':str(target),'preview':str(gif),'bytes':target.stat().st_size,'seconds':COUNT/FPS,'loop_mean_pixel_delta':seam}))
