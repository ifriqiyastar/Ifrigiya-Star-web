"""Create the landing-page sculpture, editable source, and transparent poster.

Run from the repository: blender --background --python scripts/create-hero-star.py
The GLB contains only the sculpture; the .blend also includes a render studio.
"""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models"
SOURCE_DIR = ROOT / "assets" / "blender"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
SOURCE_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic, roughness, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Coat Weight"].default_value = 0.35
    shader.inputs["Coat Roughness"].default_value = 0.16
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return mat


chrome = material("Obsidian chrome", (0.095, 0.105, 0.085), 0.94, 0.23)
# Linear values corresponding to the brand's sRGB #aff70f.
lime = material("Ifriqiya lime edge", (0.429, 0.930, 0.0048), 0.55, 0.23, 0.45)

# Round the ten corners before building the inflated surface. The depth rings
# give the face a continuous convex profile rather than a flat extruded face.
corners = []
for i in range(10):
    angle = math.pi / 2 + i * math.pi / 5
    radius = 2.12 if i % 2 == 0 else 1.03
    corners.append(Vector((math.cos(angle) * radius, math.sin(angle) * radius)))

outline = []
for i, corner in enumerate(corners):
    start = corner.lerp(corners[(i - 1) % 10], 0.23)
    end = corner.lerp(corners[(i + 1) % 10], 0.23)
    for j in range(9):
        t = j / 8
        point = (1 - t) ** 2 * start + 2 * (1 - t) * t * corner + t * t * end
        outline.append(point)

profile = [
    (0.08, -0.435), (0.32, -0.43), (0.60, -0.40), (0.80, -0.34),
    (0.92, -0.25), (0.98, -0.14), (1.0, 0.0),
    (0.98, 0.14), (0.92, 0.25), (0.80, 0.34),
    (0.60, 0.40), (0.32, 0.43), (0.08, 0.435),
]
vertices = [(p.x * scale, depth, p.y * scale) for scale, depth in profile for p in outline]
count = len(outline)
faces = []
for ring in range(len(profile) - 1):
    for i in range(count):
        a = ring * count + i
        b = ring * count + (i + 1) % count
        faces.append((a, b, b + count, a + count))
faces.append(tuple(reversed(range(count))))
faces.append(tuple((len(profile) - 1) * count + i for i in range(count)))

mesh = bpy.data.meshes.new("Rounded five-point sculpture")
mesh.from_pydata(vertices, [], faces)
mesh.update()
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
star = bpy.data.objects.new("Ifriqiya Star | chrome body", mesh)
bpy.context.collection.objects.link(star)
star.data.materials.append(chrome)
for polygon in mesh.polygons:
    polygon.use_smooth = True
bpy.context.view_layer.objects.active = star
star.select_set(True)
subdivision = star.modifiers.new("Sculpture smoothing", "SUBSURF")
subdivision.levels = 1
bpy.ops.object.modifier_apply(modifier=subdivision.name)

# A fine lime inlay runs along the star's equator and catches the side light.
curve = bpy.data.curves.new("Lime perimeter inlay", "CURVE")
curve.dimensions = "3D"
curve.bevel_depth = 0.015
curve.bevel_resolution = 3
spline = curve.splines.new("POLY")
spline.points.add(len(outline) - 1)
for point, outline_point in zip(spline.points, outline):
    point.co = (outline_point.x * 0.997, 0.0, outline_point.y * 0.997, 1)
spline.use_cyclic_u = True
edge = bpy.data.objects.new("Ifriqiya Star | lime inlay", curve)
bpy.context.collection.objects.link(edge)
edge.data.materials.append(lime)
star.select_set(False)
edge.select_set(True)
bpy.context.view_layer.objects.active = edge
bpy.ops.object.convert(target="MESH")
edge = bpy.context.object
for polygon in edge.data.polygons:
    polygon.use_smooth = True
star.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(MODEL_DIR / "ifriqiya-star.glb"),
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)


def aim(obj, target=(0, 0, 0)):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area(name, position, power, color, size, size_y):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.color = color
    data.shape = "RECTANGLE"
    data.size = size
    data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    aim(obj)


area("Tall white softbox", (-3, -4, 4), 1000, (1, 1, 1), 3, 6)
area("Lime rim", (4, 0, 2), 1300, (0.58, 1, 0.08), 2, 5)
area("Lower white strip", (1, -3, -4), 650, (1, 1, 1), 4, 1)
area("Top reflection", (0, 1, 5), 900, (1, 1, 1), 3, 3)

bpy.ops.object.camera_add(location=(3.1, -9.5, 1.8))
camera = bpy.context.object
camera.name = "Hero poster camera"
aim(camera, (0, 0, 0.10))
camera.data.type = "ORTHO"
camera.data.ortho_scale = 5.8

scene = bpy.context.scene
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 960
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = str(MODEL_DIR / "ifriqiya-star-poster.png")
scene.world.color = (0.12, 0.12, 0.12)
scene.view_settings.view_transform = "AgX"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / "ifriqiya-star.blend"))
bpy.ops.render.render(write_still=True)
print(f"Created model, poster and editable Blender source in {ROOT}")
