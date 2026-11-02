/** Encode gentle periodic foliage sway from the generated poster; camera stays fixed.
 * Usage: node scripts/encode-slate-botanical-loop.mjs [path/to/ffmpeg]
 * This is a 2D displacement animation, not generative video or a 3D simulation.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const base = path.join(root, 'public/images/themes/tectona-slate-botanical-v1')
const phase = '2*PI*T/10'
const border = 'pow(2*X/W-1,2)'
// Round around neutral 128 so tiny negative offsets cannot create a loop-seam step.
const map = expression => `geq=r='floor(0.5+${expression})':g='floor(0.5+${expression})':b='floor(0.5+${expression})'`
const filter = [
  '[0:v]scale=1600:900:force_original_aspect_ratio=increase,crop=1600:900,setsar=1,format=gbrp[source]',
  // Smooth low-resolution motion fields avoid evaluating trig per output pixel.
  'nullsrc=s=160x90:r=24:d=10,format=gbrp,split=2[xbase][ybase]',
  `[xbase]${map(`128+4*sin(${phase})*cos(2*PI*Y/H)*${border}`)},scale=1600:900:flags=bilinear[xmap]`,
  `[ybase]${map(`128+3*sin(${phase})*sin(3*PI*Y/H+0.7)*${border}`)},scale=1600:900:flags=bilinear[ymap]`,
  '[source][xmap][ymap]displace=edge=mirror,format=yuv420p[out]',
].join(';')
const result = spawnSync(process.argv[2] || process.env.FFMPEG_PATH || 'ffmpeg', [
  '-hide_banner', '-loglevel', 'warning', '-y', '-loop', '1', '-framerate', '24', '-i', `${base}.png`,
  '-filter_complex_threads', '2', '-filter_complex', filter, '-map', '[out]', '-t', '10', '-an',
  '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-row-mt', '1', '-cpu-used', '4', '-threads', '4',
  `${base}.webm`,
], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
