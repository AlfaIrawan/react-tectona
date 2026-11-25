"""Broad flowing optical ribbons framing a bright, quiet workspace.
Blender --background --python scripts/render-glass-flow.py -- animation
All motion comes from ribbon mesh deformation; camera and lights are static.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.theme-render/glass-flow-v4'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples=64
scene.eevee.use_raytracing=True
scene.render.resolution_x=1280
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.fps=24
COUNT=240
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=.55
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.88,.93,1,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8

def material(name,color,transmission=0,roughness=.15):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    shader=mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=roughness
    shader.inputs['Transmission Weight'].default_value=transmission
    shader.inputs['IOR'].default_value=1.46
    if transmission:
        mat.surface_render_method='DITHERED'
        mat.use_raytrace_refraction=True
        shader.inputs['Coat Weight'].default_value=.4
        shader.inputs['Coat Roughness'].default_value=.08
    return mat

glass=material('Pale blue optical crystal',(.77,.9,1),.88,.09)
silver=material('Clear silver crystal',(.94,.97,1),.94,.12)
edge=material('Fine polished blue rim',(.4,.65,.9),.65,.08)
floor=material('Soft white studio',(.92,.95,.98),0,.6)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.5))
bpy.context.object.data.materials.append(floor)

N=180
ACROSS=8
def coordinates(kind,phase):
    points=[]
    for i in range(N+1):
        u=i/N
        q=u*math.pi*2
        wave=phase-q
        x=-15+30*u
        if kind==0:
            y=-4.0+1.10*math.cos(q+.25)+.38*math.sin(wave)
            z=.5+.45*math.sin(q+.8)+.22*math.cos(wave)
            width=1.75
            twist=.25+1.15*math.sin(q+.6)+.23*math.sin(wave+.7)
        elif kind==1:
            y=5.5+1.25*math.cos(q+1.4)+.30*math.sin(wave+1.3)
            z=.25+.55*math.sin(q+1.7)+.18*math.cos(wave+.4)
            width=1.9
            twist=.4+.95*math.sin(q+1.2)+.25*math.sin(wave+1.5)
        else:
            y=-5.2+.9*math.cos(q+.6)+.30*math.sin(wave+.6)
            z=.2+.38*math.sin(q+1)+.18*math.cos(wave+.8)
            width=.65
            twist=.2+1.0*math.sin(q+.6)+.22*math.sin(wave+1.0)
        for j in range(ACROSS+1):
            v=(j/ACROSS-.5)*width
            # A softly crowned, twisted cross-section catches long highlights.
            points.append((x,y+v*math.cos(twist),z+v*math.sin(twist)+.08*(1-(2*j/ACROSS-1)**2)))
    return points

objects=[]
for kind in range(3):
    mesh=bpy.data.meshes.new(f'Flow ribbon {kind}')
    faces=[]
    for i in range(N):
        for j in range(ACROSS):
            k=i*(ACROSS+1)+j
            faces.append((k,k+ACROSS+1,k+ACROSS+2,k+1))
    mesh.from_pydata(coordinates(kind,0),[],faces)
    mesh.update()
    obj=bpy.data.objects.new(f'Continuous optical ribbon {kind}',mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(glass if kind!=1 else silver)
    mesh.materials.append(edge)
    for face in mesh.polygons:face.use_smooth=True
    solid=obj.modifiers.new('Thin optical depth','SOLIDIFY')
    solid.thickness=.055
    solid.material_offset_rim=1
    bevel=obj.modifiers.new('Polished edges','BEVEL')
    bevel.width=.025
    bevel.segments=3
    objects.append(obj)

def light(name,location,energy,color,size):
    bpy.ops.object.light_add(type='AREA',location=location)
    obj=bpy.context.object
    obj.name=name
    obj.data.energy=energy
    obj.data.color=color
    obj.data.shape='RECTANGLE'
    obj.data.size=size[0]
    obj.data.size_y=size[1]
    obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
light('Long white reflection',(-3,-1,9),2100,(1,1,1),(18,3))
light('Soft blue edge',(6,6,6),1600,(.64,.8,1),(12,4))
light('Left silver reflection',(-10,-4,5),1300,(1,1,1),(3,10))
bpy.ops.object.camera_add(location=(0,-13,14))
camera=bpy.context.object
camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=21
scene.camera=camera
bpy.context.view_layer.update()
fixed=[list(row) for row in camera.matrix_world]
start=coordinates(0,0)
quarter=coordinates(0,math.pi/2)
delta=[Vector(b)-Vector(a) for a,b in zip(start,quarter)]
assert max((Vector(a)-Vector(b)).length for a,b in zip(start,coordinates(0,math.tau)))<1e-9
(OUT/'geometry.json').write_text(json.dumps({'camera_fixed':True,'deforming_meshes':3,'image_textures':0,'period_seconds':10,'fps':24,'frames':COUNT,'max_vertex_displacement':max(d.length for d in delta)}))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
frames=range(1,COUNT+1) if 'animation' in args else [1,61]
for frame in frames:
    phase=math.tau*(frame-1)/COUNT
    for kind,obj in enumerate(objects):
        for vertex,position in zip(obj.data.vertices,coordinates(kind,phase)):vertex.co=position
        obj.data.update()
    bpy.context.view_layer.update()
    assert [list(row) for row in camera.matrix_world]==fixed
    scene.render.filepath=str(OUT/f'{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'Glass flow {frame}/{COUNT}',flush=True)
