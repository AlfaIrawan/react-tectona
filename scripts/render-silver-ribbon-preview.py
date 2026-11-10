"""2.5D loop of the supplied silver ribbon image.
HQ: blender --background --python scripts/render-silver-ribbon-preview.py -- --hires
"""
import bpy, math, json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
hires='--hires' in sys.argv
feather='--feather' in sys.argv
orb_mode='--steel-orb' in sys.argv
OUT=ROOT/('.theme-render/silver-feather-v1' if feather else '.theme-render/silver-ribbon-hq-v2' if hires else '.theme-render/silver-ribbon-preview')
if orb_mode:OUT=ROOT/'.theme-render/steel-glass-orb-v1'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'public/images/themes/tectona-silver-ribbon-hq-source-v2.png' if hires else ROOT.parents[1]/'Artifacts/tectona-silver-ribbon-reference.png'
if feather:SOURCE=ROOT.parents[1]/'Artifacts/tectona-silver-feather-source-v1.png'
if orb_mode:SOURCE=ROOT/'public/images/themes/tectona-steel-glass-orb-source-v1.png'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=1
scene.render.resolution_x=2560 if hires else 720
scene.render.resolution_y=1600 if hires else 450
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.view_settings.exposure=0;scene.view_settings.gamma=1
image=bpy.data.images.load(str(SOURCE))
ratio=image.size[0]/image.size[1]
if feather:
    scene.render.resolution_x=1600
    scene.render.resolution_y=round(1600/ratio/2)*2
if orb_mode:
    scene.render.resolution_x=2560
    scene.render.resolution_y=round(2560/ratio/2)*2
bpy.ops.mesh.primitive_plane_add(size=2)
quad=bpy.context.object;quad.scale=(ratio,1,1)
mat=bpy.data.materials.new('Silver ribbon local flex preview');mat.use_nodes=True
nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
def op(kind,*values):
    node=nodes.new('ShaderNodeMath');node.operation=kind
    for index,value in enumerate(values):
        if isinstance(value,(int,float)):node.inputs[index].default_value=value
        else:links.new(value,node.inputs[index])
    return node.outputs[0]
def add(a,b):return op('ADD',a,b)
def mul(a,b):return op('MULTIPLY',a,b)
def gaussian(value,center,width,power=4):
    q=op('DIVIDE',op('SUBTRACT',value,center),width)
    return op('EXPONENT',mul(-1,op('POWER',op('ABSOLUTE',q),power)))
uv=nodes.new('ShaderNodeTexCoord')
split=nodes.new('ShaderNodeSeparateXYZ');links.new(uv.outputs['UV'],split.inputs[0])
u=split.outputs['X'];v=split.outputs['Y']
sine=nodes.new('ShaderNodeValue');cosine=nodes.new('ShaderNodeValue')
s=sine.outputs[0];c=cosine.outputs[0]
ridge=add(.42,mul(.49,op('SQRT',u)))
upper=gaussian(v,ridge,.15)
corner=mul(gaussian(u,.96,.23),gaussian(v,.10,.20))
wave=op('COSINE',add(mul(u,4.8),mul(v,3)))
dx=add(mul(upper,mul(.012,mul(s,wave))),mul(corner,mul(.009,mul(c,op('SINE',mul(v,9))))))
dy=add(mul(upper,mul(.022,mul(s,op('COSINE',mul(u,4.2))))),mul(corner,mul(.012,mul(c,op('COSINE',mul(u,5))))))
if feather:
    a=mul(gaussian(u,.30,.35),gaussian(v,.70,.32))
    b=mul(gaussian(u,.72,.32),gaussian(v,.35,.42))
    d=mul(gaussian(u,.22,.30),gaussian(v,.22,.25))
    pin=mul(op('SINE',mul(u,math.pi)),op('SINE',mul(v,math.pi)))
    dx=mul(pin,add(add(mul(a,mul(.010,mul(s,op('COSINE',add(mul(v,4),mul(u,2)))))),mul(b,mul(.008,mul(c,op('SINE',add(mul(v,5),u)))))),mul(d,mul(-.009,mul(s,op('SINE',mul(u,7)))))))
    dy=mul(pin,add(add(mul(a,mul(.014,mul(c,op('SINE',mul(u,3))))),mul(b,mul(.011,mul(s,op('COSINE',mul(v,4)))))),mul(d,mul(.007,mul(c,op('COSINE',mul(u,5)))))))
if orb_mode:
    # Preserve the sphere silhouette; refractive detail shifts only inside it.
    interior=mul(gaussian(u,.46,.14),gaussian(v,.52,.21))
    cloth=gaussian(v,.08,.32)
    pin=mul(op('SINE',mul(u,math.pi)),op('SINE',mul(v,math.pi)))
    dx=add(mul(interior,mul(.002,mul(s,op('COSINE',mul(v,8))))),mul(pin,mul(cloth,mul(.006,mul(s,op('COSINE',add(mul(u,6),mul(v,3))))))))
    dy=add(mul(interior,mul(.0015,mul(c,op('SINE',mul(u,9))))),mul(pin,mul(cloth,mul(.010,mul(c,op('COSINE',mul(u,7)))))))
vector=nodes.new('ShaderNodeCombineXYZ')
links.new(add(u,dx),vector.inputs['X']);links.new(add(v,dy),vector.inputs['Y'])
texture=nodes.new('ShaderNodeTexImage');texture.image=image
texture.interpolation='Linear';texture.extension='EXTEND'
links.new(vector.outputs[0],texture.inputs['Vector'])
emission=nodes.new('ShaderNodeEmission');links.new(texture.outputs['Color'],emission.inputs['Color'])
gain=add(1,mul(.035,mul(upper,mul(s,op('SINE',mul(u,5))))))
if feather:
    gain=add(1,mul(.028,mul(s,op('SUBTRACT',mul(a,op('COSINE',mul(v,7))),mul(b,op('COSINE',mul(u,6)))))))
if orb_mode:
    gain=add(1,add(mul(interior,mul(.024,mul(s,op('COSINE',mul(u,7))))),mul(cloth,mul(.015,mul(c,op('SINE',mul(u,6)))))))
links.new(gain,emission.inputs['Strength'])
output=nodes.new('ShaderNodeOutputMaterial');links.new(emission.outputs[0],output.inputs['Surface'])
quad.data.materials.append(mat)
bpy.ops.object.camera_add(location=(0,0,10))
camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2*ratio
scene.camera=camera
bpy.context.view_layer.update();fixed=[list(row) for row in camera.matrix_world]
for index in range(192):
    phase=math.tau*index/192
    s.default_value=math.sin(phase)
    c.default_value=(1-math.cos(phase))*.6
    assert [list(row) for row in camera.matrix_world]==fixed
    scene.render.filepath=str(OUT/f'{index:04d}.png')
    bpy.ops.render.render(write_still=True)
print(json.dumps({'kind':'2.5D local texture deformation','camera_fixed':True,'frames':192,'fps':24,'seconds':8,'production_files_changed':False}))
