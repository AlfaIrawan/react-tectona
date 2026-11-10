"""Original Steel-only 3D set. Run with Blender 4.2 --background --python this.py."""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.theme-render/steel-cinematic-v2'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = 18
scene.frame_start = 1
scene.frame_end = 144
scene.world.color = (.32, .35, .4)
scene.view_settings.view_transform = 'AgX'

def material(name, color, metallic=0, roughness=.4):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return mat

steel = material('Satin brushed titanium', (.47,.50,.54), .78, .34)
nodes = steel.node_tree.nodes
links = steel.node_tree.links
tex = nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = 8
mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation = 'MULTIPLY'
mapping.inputs[1].default_value = (1, 240, 2)
coords = nodes.new('ShaderNodeTexCoord')
links.new(coords.outputs['Generated'], mapping.inputs[0]); links.new(mapping.outputs[0], tex.inputs['Vector'])
bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .09; bump.inputs['Distance'].default_value = .025
links.new(tex.outputs['Fac'], bump.inputs['Height']); links.new(bump.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])
edge = material('Graphite sidewalls', (.105,.135,.18), .55, .42)
blue = material('Quiet corporate blue inlay', (.025,.14,.34), .6, .3)
floor = material('Architectural warm gray', (.58,.6,.63), .08, .62)

def slab(name, location, size, rotation, mat, bevel=.07):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object; obj.name = name
    obj.dimensions = size; obj.rotation_euler[2] = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new('Machined edge', 'BEVEL'); mod.width = bevel; mod.segments = 4
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj

slab('Infinite matte stage', (0,0,-.65), (200,200,.4), 0, floor, .01)
# Asymmetric plates at genuinely different elevations, not a recolored wave video.
for i, (x,y,z,w,length,angle) in enumerate([
    (-6.5,.4,.05,4.5,20,-.10), (-2.9,1,.4,3.9,18,-.10),
    (.7,-.5,.72,3.5,20,-.10), (4.0,.8,.22,3.0,18,-.10), (7.0,1,.56,2.8,19,-.10),
]):
    slab('Graphite plinth '+str(i), (x,y,z-.12), (w,length,.30), angle, edge)
    slab('Satin steel plate '+str(i), (x,y,z+.08), (w-.09,length-.09,.16), angle, steel, .055)
    if i in [1,3]:
        slab('Blue recessed seam '+str(i), (x+w*.5+.12,y,z-.08), (.12,length,.08), angle, blue, .02)

def area(name, location, energy, color, scale):
    bpy.ops.object.light_add(type='AREA', location=location)
    obj=bpy.context.object; obj.name=name; obj.data.energy=energy; obj.data.color=color
    obj.data.shape='RECTANGLE'; obj.data.size=scale[0]; obj.data.size_y=scale[1]
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Large softbox', (1,-4,11), 1900, (1,.97,.94), (10,7))
area('Long white reflection', (-7,2,7), 1500, (.86,.92,1), (3,12))
rim=area('Subtle blue edge light', (8,4,5), 600, (.36,.57,1), (3,10))
bpy.ops.object.camera_add()
camera=bpy.context.object; scene.camera=camera
camera.data.type='ORTHO'; camera.data.ortho_scale=16.7
camera.data.lens=50

def pose(frame):
    phase=2*math.pi*(frame-1)/144
    # Closed camera path: no reverse-playback trick or discontinuity at the loop.
    camera.location=(8+.32*math.sin(phase),-10+.22*math.cos(phase),13+.12*math.sin(phase))
    target=Vector((.3, .18*math.sin(phase), .15))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    rim.data.energy=600+80*math.sin(phase)

args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
frames = range(1,145) if 'animation' in args else [1]
for frame in frames:
    pose(frame); scene.frame_set(frame)
    scene.render.filepath=str(OUT/f'{frame:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'Steel cinematic frame {frame}/144', flush=True)
