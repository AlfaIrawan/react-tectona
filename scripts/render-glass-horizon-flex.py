"""Local image-based glass deformation using the approved artwork.
This preserves the illustration, not a newly generated 3D replacement.
Only regional UV fields deform; the camera, framing and horizon stay fixed.
"""
import bpy, math, sys, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.theme-render/glass-horizon-flex-v5'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'public/images/themes/tectona-steel-glass-horizon-v1.png'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=1
scene.render.resolution_x=1280
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.view_settings.exposure=0
scene.view_settings.gamma=1
scene.render.fps=24
COUNT=240
bpy.ops.mesh.primitive_plane_add(size=2)
quad=bpy.context.object
quad.scale=(16/9,1,1)
mat=bpy.data.materials.new('Approved artwork with independent glass flex fields')
mat.use_nodes=True
nodes=mat.node_tree.nodes
nodes.clear()
links=mat.node_tree.links
def mathnode(operation,a,b=None):
    node=nodes.new('ShaderNodeMath')
    node.operation=operation
    for index,value in enumerate([a,b] if b is not None else [a]):
        if isinstance(value,(int,float)):node.inputs[index].default_value=value
        else:links.new(value,node.inputs[index])
    return node.outputs[0]
def add(a,b):return mathnode('ADD',a,b)
def mul(a,b):return mathnode('MULTIPLY',a,b)
def sub(a,b):return mathnode('SUBTRACT',a,b)
def gaussian(v,c,w,power=2):
    q=mathnode('DIVIDE',sub(v,c),w)
    return mathnode('EXPONENT',mul(-1,mathnode('POWER',mathnode('ABSOLUTE',q),power)))
uv=nodes.new('ShaderNodeTexCoord')
split=nodes.new('ShaderNodeSeparateXYZ')
links.new(uv.outputs['UV'],split.inputs[0])
u=split.outputs['X'];v=split.outputs['Y']
phaseSin=nodes.new('ShaderNodeValue')
phaseCos=nodes.new('ShaderNodeValue')
s=phaseSin.outputs[0];c=phaseCos.outputs[0]
# Each field is confined to one glass group and its reflected footprint.
# The empty middle and distant horizon do not participate in the displacement.
left=mul(gaussian(u,.12,.195,4),gaussian(v,.54,.45,4))
back=mul(gaussian(u,.37,.125,4),gaussian(v,.47,.17,4))
right=mul(gaussian(u,.92,.27,4),gaussian(v,.19,.24,4))
leftWave=mathnode('COSINE',add(mul(v,6.5),mul(u,2)))
rightWave=mathnode('COSINE',add(mul(u,6),mul(v,3)))
dx=add(add(mul(left,mul(.018,mul(s,leftWave))),mul(back,mul(.008,mul(c,mathnode('COSINE',mul(v,9)))))),mul(right,mul(.022,mul(c,rightWave))))
dy=add(mul(left,mul(.007,mul(c,mathnode('SINE',mul(u,11))))),mul(right,mul(.012,mul(s,mathnode('COSINE',mul(u,7))))))
combine=nodes.new('ShaderNodeCombineXYZ')
links.new(add(u,dx),combine.inputs['X'])
links.new(add(v,dy),combine.inputs['Y'])
texture=nodes.new('ShaderNodeTexImage')
texture.image=bpy.data.images.load(str(SOURCE))
texture.interpolation='Linear'
texture.extension='EXTEND'
links.new(combine.outputs[0],texture.inputs['Vector'])
emission=nodes.new('ShaderNodeEmission')
links.new(texture.outputs['Color'],emission.inputs['Color'])
output=nodes.new('ShaderNodeOutputMaterial')
links.new(emission.outputs[0],output.inputs['Surface'])
quad.data.materials.append(mat)
bpy.ops.object.camera_add(location=(0,0,10))
camera=bpy.context.object
camera.data.type='ORTHO'
camera.data.ortho_scale=32/9
scene.camera=camera
bpy.context.view_layer.update()
fixed=[list(row) for row in camera.matrix_world]
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
frames=range(1,COUNT+1) if 'animation' in args else [1,61,121]
for frame in frames:
    phase=math.tau*(frame-1)/COUNT
    phaseSin.outputs[0].default_value=math.sin(phase)
    phaseCos.outputs[0].default_value=(1-math.cos(phase))*.65
    assert [list(row) for row in camera.matrix_world]==fixed
    scene.render.filepath=str(OUT/f'{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'Glass flex {frame}/{COUNT}',flush=True)
(OUT/'geometry.json').write_text(json.dumps({'camera_fixed':True,'deforming_regions':3,'image_textures':1,'basis':'localized image deformation of approved reference; not reconstructed 3D geometry','period_seconds':10,'fps':24,'frames':COUNT}))
