"""Real deforming glass ribbons, fixed camera, no image-textured background.
Blender 4.2 --background --python scripts/render-glass-ribbons.py -- animation
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.theme-render/glass-ribbons-v3'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=32
scene.eevee.use_raytracing=True
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=18
scene.frame_start=1;scene.frame_end=216
scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.76,.86,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65

def material(name,color,roughness=.3,transmission=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Transmission Weight'].default_value=transmission
    shader.inputs['IOR'].default_value=1.45
    return mat

glass=material('Soft blue optical glass',(.73,.86,.96),.16,.94)
glass.surface_render_method='DITHERED'
glass.use_raytrace_refraction=True
edge=material('Polished blue glass edge',(.27,.52,.71),.12,.8)
floor=material('Pearl gray horizon',(.72,.76,.81),.32)
bpy.ops.mesh.primitive_plane_add(size=200)
bpy.context.object.name='Static pearl-gray floor';bpy.context.object.data.materials.append(floor)

N=128
def coordinates(kind,phase):
    vertices=[]
    for i in range(N+1):
        u=i/N
        if kind==0:
            # Tall left ribbon: genuine flexion, not a rigid translation.
            theta=-1.35+u*2.5
            x=-5.0+3.6*math.cos(theta)+.34*math.sin(phase+u*math.pi*2)
            y=2.5+3.6*math.sin(theta)+.22*math.cos(phase+u*math.pi*2)
            bottom=.04+.10*(1+math.sin(phase+u*math.pi*2))
            height=3.3+.3*math.sin(phase+u*math.pi*2)
        elif kind==1:
            # Smaller ribbon across the middle distance, with an independent phase.
            x=-5.5+u*6.4
            y=4.3+.45*math.sin(u*math.pi*1.5+phase+.9)
            bottom=.035+.06*(1+math.sin(phase+u*math.pi))
            height=1.5+.24*math.sin(u*math.pi*2+phase+.9)
        else:
            # Low foreground ribbon curls around the right, exposing the quiet center.
            theta=-2.5+u*2.5
            x=6+3.8*math.cos(theta)+.38*math.sin(phase+u*math.pi*2+1.8)
            y=-.7+2.6*math.sin(theta)+.28*math.sin(phase+u*math.pi*2+1.8)
            bottom=.045+.10*(1+math.cos(phase+u*math.pi*2))
            height=1.25+.26*math.sin(phase+u*math.pi*2+1.8)
        vertices.extend([(x,y,bottom),(x,y,bottom+height)])
    return vertices

objects=[]
for kind in range(3):
    mesh=bpy.data.meshes.new(f'Ribbon {kind} deformable mesh')
    faces=[(i*2,i*2+2,i*2+3,i*2+1) for i in range(N)]
    mesh.from_pydata(coordinates(kind,0),[],faces);mesh.update()
    obj=bpy.data.objects.new(f'Glass ribbon {kind}',mesh);scene.collection.objects.link(obj)
    obj.data.materials.append(glass);obj.data.materials.append(edge)
    for polygon in mesh.polygons:polygon.use_smooth=True
    solid=obj.modifiers.new('Optical glass thickness','SOLIDIFY');solid.thickness=.045;solid.material_offset_rim=1
    bevel=obj.modifiers.new('Soft polished edge','BEVEL');bevel.width=.025;bevel.segments=3
    obj.modifiers.new('Balanced surface normals','WEIGHTED_NORMAL')
    objects.append(obj)

def light(name,location,energy,color,size):
    bpy.ops.object.light_add(type='AREA',location=location)
    obj=bpy.context.object;obj.name=name;obj.data.energy=energy;obj.data.color=color
    obj.data.shape='RECTANGLE';obj.data.size=size[0];obj.data.size_y=size[1]
    obj.rotation_euler=(Vector((0,2,1))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Large stationary softbox',(-3,-4,9),1900,(.95,.97,1),(9,7))
light('Stationary blue rim',(7,5,6),1200,(.6,.76,1),(4,9))
light('Stationary white reflection',(-9,2,5),1400,(1,1,1),(2,8))
bpy.ops.object.camera_add(location=(0,-15,6.3))
camera=bpy.context.object;scene.camera=camera
camera.rotation_euler=(Vector((0,2,1.7))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=16.5
bpy.context.view_layer.update()
fixed_camera=[list(row) for row in camera.matrix_world]
baseline=coordinates(0,0)
quarter=coordinates(0,math.pi/2)
displacements=[tuple(b-a for a,b in zip(start,end)) for start,end in zip(baseline,quarter)]
assert len(set(tuple(round(v,4) for v in delta) for delta in displacements))>10
assert max(abs(a-b) for p,q in zip(baseline,coordinates(0,2*math.pi)) for a,b in zip(p,q))<1e-10
(OUT/'geometry.json').write_text(json.dumps({'camera_fixed':True,'deforming_meshes':3,'image_textures':0,'period_seconds':12,'max_vertex_displacement':max(Vector(d).length for d in displacements)}))

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
frames=range(1,217) if 'animation' in args else [1]
for frame in frames:
    phase=2*math.pi*(frame-1)/216
    for kind,obj in enumerate(objects):
        for vertex,position in zip(obj.data.vertices,coordinates(kind,phase)):vertex.co=position
        obj.data.update()
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    assert [list(row) for row in camera.matrix_world]==fixed_camera
    scene.render.filepath=str(OUT/f'{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'Glass ribbons frame {frame}/216 — camera fixed',flush=True)
