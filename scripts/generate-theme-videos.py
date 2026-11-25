"""Generate original periodic Gray-to-Blue ambient motion; no stock media or default edits."""
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'public/images/themes'
ROOT.mkdir(parents=True, exist_ok=True)
W, H, FPS, SECONDS = 960, 540, 15, 10
X, Y = np.meshgrid(np.linspace(0, 1, W), np.linspace(0, 1, H))

def frame(theme, phase):
    if theme == 'silver':
        ridge = Y - .25*np.sin(X*4 + .07*np.sin(phase)) - .16*X
        light = .5 + .24*np.cos(ridge*15) + .06*np.sin(ridge*34)
        base, tint = np.array([199, 208, 220]), np.array([62, 126, 213])
        strength = .05 + .12*np.exp(-((ridge-.45)/.18)**2)
    elif theme == 'steel':
        ridge = X*.63 + Y*.9 + .025*np.sin(phase)
        light = .44 + .28*np.cos(ridge*18) + .04*np.cos(ridge*52)
        base, tint = np.array([132, 151, 176]), np.array([32, 108, 213])
        strength = .12 + .28*np.exp(-((ridge-.7)/.12)**2)
    elif theme == 'slate':
        ridge = Y + .20*np.sin(X*4.5 + .08*np.sin(phase))
        light = .28 + .17*np.sin(ridge*18) + .05*np.sin(ridge*37)
        base, tint = np.array([71, 88, 111]), np.array([36, 108, 203])
        strength = .17 + .38*np.exp(-((ridge-.67)/.075)**2)
    else:
        ridge = Y - .32*X + .025*np.sin(X*6 + phase)
        light = .12 + .10*np.cos(ridge*12)
        base, tint = np.array([27, 36, 53]), np.array([30, 97, 209])
        strength = .06 + .58*np.exp(-((ridge-.32)/.026)**2) + .22*np.exp(-((ridge-.59)/.055)**2)
    shimmer = .018*np.cos(X*5 + Y*3 + phase)
    pixels = base[None,None,:]*(.62 + light[...,None]*.65)
    pixels = pixels*(1-strength[...,None]) + tint[None,None,:]*strength[...,None]
    pixels += shimmer[...,None]*90
    vignette = 1 - .12*((X-.5)**2 + (Y-.5)**2)
    return np.uint8(np.clip(pixels*vignette[...,None], 0, 255))[...,::-1]

for theme in ['silver', 'steel', 'slate', 'midnight']:
    target = ROOT / f'tectona-{theme}.webm'
    writer = cv2.VideoWriter(str(target), cv2.VideoWriter_fourcc(*'VP80'), FPS, (W,H))
    if not writer.isOpened():
        raise RuntimeError('VP8 encoder unavailable; no substitute/default video written')
    for i in range(FPS*SECONDS):
        image = frame(theme, 2*np.pi*i/(FPS*SECONDS))
        if i == 0: cv2.imwrite(str(ROOT/f'tectona-{theme}.png'), image)
        writer.write(image)
    writer.release()
    capture = cv2.VideoCapture(str(target))
    assert capture.isOpened() and int(capture.get(cv2.CAP_PROP_FRAME_COUNT)) == FPS*SECONDS
    capture.release()
    print(f'{theme}: {target.stat().st_size} bytes, {SECONDS}s periodic VP8', flush=True)
