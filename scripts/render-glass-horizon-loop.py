"""Animate the approved Glass Horizon still, preserving its composition and palette.

Blender 4.2 --background --python scripts/render-glass-horizon-loop.py -- animation
This is an image-based ambient loop, not a claim of newly reconstructed 3D glass.
"""
import bpy, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
visible_motion = 'motion-v2' in args
SOURCE = ROOT / 'public/images/themes/tectona-steel-glass-horizon-v1.png'
OUT = ROOT / ('.theme-render/glass-horizon-motion-v2' if visible_motion else '.theme-render/glass-horizon-v1')
OUT.mkdir(parents=True, exist_ok=True)
assert SOURCE.is_file(), 'Approved source image must exist before animation'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples = 8
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = 18
scene.frame_start = 1
scene.frame_end = 216
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.film_transparent = False

bpy.ops.mesh.primitive_plane_add(size=2)
plane=bpy.context.object
plane.name='Approved Glass Horizon artwork, unchanged source'
image=bpy.data.images.load(str(SOURCE))
ratio=image.size[0]/image.size[1]
half_width = 8.9 if visible_motion else 8.16
plane.scale=(half_width,half_width/ratio,1)
mat=bpy.data.materials.new('Faithful artwork with very soft travelling illumination')
mat.use_nodes=True
nodes=mat.node_tree.nodes; nodes.clear(); links=mat.node_tree.links
texture=nodes.new('ShaderNodeTexImage'); texture.image=image; texture.interpolation='Linear'
uv=nodes.new('ShaderNodeTexCoord')
center=nodes.new('ShaderNodeCombineXYZ')
subtract=nodes.new('ShaderNodeVectorMath'); subtract.operation='SUBTRACT'
links.new(uv.outputs['UV'], subtract.inputs[0]); links.new(center.outputs[0], subtract.inputs[1])
distance=nodes.new('ShaderNodeVectorMath'); distance.operation='LENGTH'; links.new(subtract.outputs[0],distance.inputs[0])
square=nodes.new('ShaderNodeMath'); square.operation='MULTIPLY'
links.new(distance.outputs['Value'],square.inputs[0]); links.new(distance.outputs['Value'],square.inputs[1])
falloff=nodes.new('ShaderNodeMath'); falloff.operation='MULTIPLY'; falloff.inputs[1].default_value=-7
links.new(square.outputs[0],falloff.inputs[0])
gaussian=nodes.new('ShaderNodeMath'); gaussian.operation='EXPONENT'; links.new(falloff.outputs[0],gaussian.inputs[0])
gain=nodes.new('ShaderNodeMath'); gain.operation='MULTIPLY_ADD'; gain.inputs[1].default_value=.045; gain.inputs[2].default_value=.98
if visible_motion:
    gain.inputs[1].default_value=.08; gain.inputs[2].default_value=.96
links.new(gaussian.outputs[0],gain.inputs[0])
emission=nodes.new('ShaderNodeEmission'); links.new(texture.outputs['Color'],emission.inputs['Color']); links.new(gain.outputs[0],emission.inputs['Strength'])
output=nodes.new('ShaderNodeOutputMaterial'); links.new(emission.outputs[0],output.inputs['Surface'])
plane.data.materials.append(mat)
bpy.ops.object.camera_add(location=(0,0,10))
camera=bpy.context.object; scene.camera=camera; camera.data.type='ORTHO'; camera.data.ortho_scale=16

frames=range(1,217) if 'animation' in args else [1]
for frame in frames:
    phase=2*math.pi*(frame-1)/216
    camera.location.x=(.42 if visible_motion else .025)*math.sin(phase)
    camera.location.y=(.10 if visible_motion else .015)*math.sin(phase)
    camera.data.ortho_scale=(15.9+.15*(1-math.cos(phase))) if visible_motion else (16+.025*(1-math.cos(phase)))
    center.inputs['X'].default_value=.5+(.3 if visible_motion else .18)*math.sin(phase)
    center.inputs['Y'].default_value=.5+(.12 if visible_motion else .08)*math.cos(phase)
    scene.frame_set(frame)
    scene.render.filepath=str(OUT/f'{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'Glass Horizon frame {frame}/216',flush=True)
