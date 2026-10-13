"""Sims Mode's two figures: MakeHuman's base mesh and CC0/CC-BY community assets via MPFB, in Bavarian dress.

    python build-sims-people.py -- OUTDIR [--render] [--export]

--export writes OUTDIR/sims-him.glb and sims-her.glb (copy them to public/assets/models); --render writes review stills.
Bodies: him 1.80 m, average-to-athletic slim; her 1.65 m, slender with a defined waist (barefoot heights, measured and
then scaled to exactly). Clothes are fitted by MakeHuman's proxy fitting, layered, re-dressed in generated fabrics and
completed with generated pieces (braces and chest bar, trouser flap, horn buttons, hat cord, chamois tuft, dirndl apron);
every piece is skinned to the same rig. Skin, hair and eye colours are matched to the owners' photographs, which stay
out of the repository; nothing from them is embedded.

Setup: Blender as a Python module (pip install bpy==4.5.*) with the MPFB 2.0.18 extension enabled, MakeHuman's system
assets and the community packs bodyparts05, dress01, hair01, hats03, pants03, shirts02, shirts03, skirts01 and
underwear04 (https://files.makehumancommunity.org/asset_packs/) installed into MPFB's data folder (MPFB_DATA), and
Node for glTF-Transform. Credits: public/assets/models/CREDITS.md."""
import bpy, addon_utils, math, sys, os, mathutils, bmesh
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services import HumanService

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = ARGS[0]; os.makedirs(OUT, exist_ok=True)
RENDER = '--render' in ARGS; EXPORT = '--export' in ARGS
# MakeHuman's height setting that gives about 1.80 m and 1.65 m barefoot for these builds; each figure is then scaled exactly.
HEIGHT_HIM = float(os.environ.get('HEIGHT_HIM', '.546')); HEIGHT_HER = float(os.environ.get('HEIGHT_HER', '.585'))
bpy.ops.wm.read_factory_settings(use_empty=True)
c = lambda n: f'{n}/{n}.mhclo'
D = os.environ.get('MPFB_DATA', os.path.expanduser('~/.config/blender/4.5/extensions/.user/user_default/mpfb/data'))

# ---------- generated fabrics (linear colour, stored sRGB-encoded) -------------------------------------------------
rng = np.random.default_rng(7)
def noise(h, w, scale, octaves=3):
    out = np.zeros((h, w))
    for o in range(octaves):
        s = max(2, int(scale * 2 ** o)); g = rng.random((s + 1, s + 1))
        ys = np.linspace(0, s, h, endpoint=False); xs = np.linspace(0, s, w, endpoint=False)
        y0 = ys.astype(int); x0 = xs.astype(int); fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; cc = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
        out += ((a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy) / 2 ** o
    return out / out.max()
def srgb(hexs): v = np.array([int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)]); return np.where(v <= .04045, v / 12.92, ((v + .055) / 1.055) ** 2.4)
def encode(lin): lin = np.clip(lin, 0, 1); return np.where(lin <= .0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - .055)
def decode(enc): return np.where(enc <= .04045, enc / 12.92, ((enc + .055) / 1.055) ** 2.4)
def image(name, rgb, alpha=None):
    h, w, _ = rgb.shape; img = bpy.data.images.new(name, w, h, alpha=alpha is not None)
    px = np.ones((h, w, 4), dtype=np.float32); px[:, :, :3] = encode(rgb)
    if alpha is not None: px[:, :, 3] = alpha
    img.pixels.foreach_set(px.ravel()); img.pack(); return img
def weave(n, period=6):
    y, x = np.mgrid[0:n, 0:n]; return 1 + .06 * np.sin(x * 2 * np.pi / period) * np.sin(y * 2 * np.pi / period) + .04 * (noise(n, n, 64) - .5)
def gingham(n=2048, checks=48, colour='#2f5d9e'):
    y, x = np.mgrid[0:n, 0:n]; a = ((x * checks // n) % 2 == 0); b = ((y * checks // n) % 2 == 0)
    blue = srgb(colour); white = srgb('#f3efe6'); mixc = (blue + white) / 2
    rgb = np.where((a & b)[..., None], blue, np.where((a | b)[..., None], mixc, white)); return rgb * weave(n, 5)[..., None]
def taffeta(colour, shot, n=1024, stripes=64):
    """Shot silk with a fine woven stripe: warp and weft in two close colours."""
    y, x = np.mgrid[0:n, 0:n]; base = srgb(colour); alt = srgb(shot); st = (np.sin(x * 2 * np.pi * stripes / n) > .6)[..., None]
    rgb = np.where(st, alt, base) * weave(n, 3)[..., None]; return rgb * (1 + .05 * (noise(n, n, 30) - .5))[..., None]
def solid(colour, n=1024, grain=.12, scale=24, period=6):
    base = srgb(colour); return base * (1 + grain * (noise(n, n, scale) - .5))[..., None] * weave(n, period)[..., None]
def leather(n=1024, colour='#6a4a30', dark='#3a2617'):
    base = srgb(colour); dk = srgb(dark); t = noise(n, n, 6) * .6 + noise(n, n, 90) * .4
    return base * (1 - t[..., None] * .3) + dk * (t[..., None] * .2)
def ribbed(colour, n=1024, period=10):
    y, x = np.mgrid[0:n, 0:n]; return srgb(colour) * (.86 + .14 * (np.sin(x * 2 * np.pi / period) > 0))[..., None] * (1 + .06 * (noise(n, n, 40) - .5))[..., None]
def stitched(rgb, inset, dash=10, colour='#efe6cf', width=2, ends=True):
    """Saddle stitching: dashed cream lines `inset` pixels inside each edge (the long edges only for a strap)."""
    h, w, _ = rgb.shape; out = rgb.copy(); thread = srgb(colour)
    for y in ((inset, h - 1 - inset) if ends else ()):
        for x in range(inset, w - inset):
            if (x // dash) % 2 == 0: out[y - width // 2:y + width // 2 + 1, x] = thread
    for x in (inset, w - 1 - inset):
        for y in range(inset, h - inset):
            if (y // dash) % 2 == 0: out[y, x - width // 2:x + width // 2 + 1] = thread
    return out
def edelweiss(rgb, cx, cy, r, petals=9):
    """An embroidered edelweiss: felted white petals round a yellow-green centre, with two leaves."""
    h, w, _ = rgb.shape; y, x = np.mgrid[0:h, 0:w]; out = rgb.copy()
    for k in range(petals):
        a = 2 * np.pi * k / petals; px, py = cx + np.cos(a) * r * .55, cy + np.sin(a) * r * .55
        u = (x - px) * np.cos(a) + (y - py) * np.sin(a); v = -(x - px) * np.sin(a) + (y - py) * np.cos(a)
        m = (u / (r * .5)) ** 2 + (v / (r * .2)) ** 2 < 1; out[m] = srgb('#f1eee4') * (.9 + .1 * np.sin(u[m] * 2))[..., None]
    m = np.hypot(x - cx, y - cy) < r * .28; out[m] = srgb('#c9b84a') * (.85 + .3 * ((x[m] + y[m]) % 3 == 0))[..., None]
    for s in (-1, 1):
        lx, ly = cx + s * r * 1.35, cy + r * .35; a = s * .5
        u = (x - lx) * np.cos(a) + (y - ly) * np.sin(a); v = -(x - lx) * np.sin(a) + (y - ly) * np.cos(a)
        m = (u / (r * .75)) ** 2 + (v / (r * .2)) ** 2 < 1; out[m] = srgb('#5f7a4a')
    return out
def tendrils(rgb, cy, amp, colour='#5f7a4a', width=2):
    """A green chain-stitched vine running across the panel."""
    h, w, _ = rgb.shape; out = rgb.copy(); thread = srgb(colour)
    for x in range(w):
        y = int(cy + amp * math.sin(x / w * 4 * math.pi))
        if (x // 3) % 3: out[max(0, y - width):y + width, x] = thread
    return out
def tinted(img_path, colour):
    src = bpy.data.images.load(img_path); w, h = src.size; px = np.array(src.pixels[:]).reshape(h, w, src.channels)
    lum = (px[..., 0] * .3 + px[..., 1] * .59 + px[..., 2] * .11); lum = lum / max(lum.mean(), 1e-3) * .5
    rgb = srgb(colour) * np.clip(lum, 0, 2.2)[..., None]
    alpha = px[..., 3] if src.channels == 4 else None
    return image('tint-' + os.path.basename(img_path), rgb, alpha), alpha is not None
def recoloured(img_path, colour, sock, is_sock):
    """Leather in `colour`, the sock part of a shoe texture in `sock`, each keeping its shading."""
    src = bpy.data.images.load(img_path); w, h = src.size; px = np.array(src.pixels[:]).reshape(h, w, src.channels)[..., :3]
    mx = px.max(-1); mn = px.min(-1); sat = (mx - mn) / np.maximum(mx, 1e-3); lum = px @ np.array([.3, .59, .11]); s = is_sock(lum, sat)
    out = np.zeros((h, w, 3))
    for mask, col in ((~s, colour), (s, sock)):
        if mask.any(): out[mask] = srgb(col) * np.clip(lum[mask] / max(lum[mask].mean(), 1e-3), 0, 2)[..., None]
    return image('recolour-' + os.path.basename(img_path), out)
def ramped(img_path, dark, light):
    """Recolours a hair texture along a dark-to-light ramp by its own shading, keeping its alpha."""
    src = bpy.data.images.load(img_path); w, h = src.size; px = np.array(src.pixels[:]).reshape(h, w, src.channels)
    lum = px[..., :3] @ np.array([.3, .59, .11]); alpha = px[..., 3] if src.channels == 4 else np.ones((h, w)); m = alpha > .5
    lo, hi = (np.percentile(lum[m], 15), np.percentile(lum[m], 97)) if m.any() else (0, 1)
    t = np.clip((lum - lo) / max(hi - lo, 1e-3), 0, 1)[..., None]; rgb = srgb(dark) * (1 - t) + srgb(light) * t
    return image('ramp-' + os.path.basename(img_path), rgb, alpha)
def pure(nt):
    """MakeHuman's shader blends the texture toward a cream 'diffuse colour'; use the texture as it is."""
    di = nt.nodes.get('diffuseIntensity')
    if di: di.blend_type = 'MIX'; di.inputs['Fac'].default_value = 1.
def retexture(o, img):
    for m in o.data.materials:
        if m and m.use_nodes and 'diffuseTexture' in m.node_tree.nodes: m.node_tree.nodes['diffuseTexture'].image = img; pure(m.node_tree)
def material(name, img=None, colour=None, rough=.8, sheen=0., alpha=False, normal=None, metal=0., attribute=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    if 'Sheen Weight' in p.inputs: p.inputs['Sheen Weight'].default_value = sheen
    if img is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
        if alpha:
            nt.links.new(t.outputs['Alpha'], p.inputs['Alpha'])
            for attr, value in (('blend_method', 'HASHED'), ('surface_render_method', 'DITHERED')):
                try: setattr(m, attr, value)
                except Exception: pass
    elif attribute:
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = attribute; nt.links.new(a.outputs['Color'], p.inputs['Base Color'])   # exported as glTF vertex colours
    elif colour: p.inputs['Base Color'].default_value = (*srgb(colour), 1)
    if normal and os.path.exists(normal):
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(normal); n.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = .8; nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    return m
def dress(obj, mat):
    obj.data.materials.clear(); obj.data.materials.append(mat)
def texture_of(o):
    return next((bpy.path.abspath(nd.image.filepath) for m in o.data.materials if m and m.use_nodes for nd in m.node_tree.nodes if nd.type == 'TEX_IMAGE' and nd.image), None)

# ---------- people ------------------------------------------------------------------------------------------------
def world_mesh(*objs):
    verts, polys = [], []; deps = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        ev = o.evaluated_get(deps); m = ev.to_mesh(); base = len(verts)
        verts += [o.matrix_world @ v.co for v in m.vertices]; polys += [tuple(base + i for i in p.vertices) for p in m.polygons]; ev.to_mesh_clear()
    return verts, polys
def coords(*objs): return np.array([tuple(v) for v in world_mesh(*objs)[0]])
def body_coords(body):
    """The whole body, including the skin MakeHuman masks under the clothes; helper geometry stays hidden."""
    masks = [m for m in body.modifiers if m.type == 'MASK' and m.name.startswith('Delete')]
    for m in masks: m.show_viewport = False
    bpy.context.view_layer.update(); a = coords(body)
    for m in masks: m.show_viewport = True
    bpy.context.view_layer.update(); return a
def body_height(body):
    """Barefoot standing height: sole to crown, with the skin MakeHuman hides under shoes and clothes put back."""
    zs = body_coords(body)[:, 2]; return float(zs.max() - zs.min())
def person(name, pheno, targets, skin, hair, brows, clothes, x, height):
    info = HumanService._create_default_human_info_dict()
    info.update({"name": name, "rig": "game_engine", "eyes": "high-poly/high-poly.mhclo", "eyebrows": brows, "eyelashes": "eyelashes02/eyelashes02.mhclo",
                 "teeth": "teeth_base/teeth_base.mhclo", "tongue": "tongue01/tongue01.mhclo", "hair": hair, "skin_mhmat": skin, "skin_material_type": "MAKESKIN",
                 "alternative_materials": {}, "clothes": clothes, "targets": targets})
    info["phenotype"].update(pheno)
    settings = HumanService.get_default_deserialization_settings(); settings["subdiv_levels"] = 0
    body = HumanService.deserialize_from_dict(info, settings); rig = body.parent or body; bpy.context.view_layer.update()
    measured = body_height(body); k = height / measured; rig.scale = tuple(s * k for s in rig.scale); rig.location = (x, 0, 0); bpy.context.view_layer.update()
    print('HEIGHT', name, round(measured, 3), '->', height, 'scale', round(k, 3))
    return body, rig
def parts_of(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table(); seen = set(); parts = []
    for v in bm.verts:
        if v.index in seen: continue
        stack = [v]; comp = []
        while stack:
            q = stack.pop()
            if q.index in seen: continue
            seen.add(q.index); comp.append(q.index); stack.extend(e.other_vert(q) for e in q.link_edges)
        parts.append(comp)
    bm.free(); return parts
def delete_verts(obj, gone):
    if not gone: return
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table(); bmesh.ops.delete(bm, geom=[bm.verts[i] for i in sorted(set(gone))], context='VERTS'); bm.to_mesh(obj.data); bm.free()
def delete_faces(obj, gone):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.faces.ensure_lookup_table(); bmesh.ops.delete(bm, geom=[bm.faces[i] for i in sorted(set(gone))], context='FACES'); bm.to_mesh(obj.data); bm.free()
def drop(obj, keep):
    """Deletes the loose parts of a garment for which keep(indices, coords) is False."""
    co = np.array([v.co for v in obj.data.vertices]); gone = []
    for p in parts_of(obj):
        if not keep(p, co[p]): gone += p
    print('  dropped', obj.name, len(gone), 'of', len(co)); delete_verts(obj, gone)

him, him_rig = person('him', {"gender": 1.0, "age": .56, "muscle": .64, "weight": .42, "height": HEIGHT_HIM, "proportions": .78, "race": {"asian": 0, "caucasian": 1, "african": 0}}, [],
    "young_caucasian_male/young_caucasian_male.mhmat", "short02/short02.mhclo", "eyebrow001/eyebrow001.mhclo",
    [c('elvs_male_shirt_tie_tucked1'), c('elvs_male_trouser_short_1'), c('joepal_crude_high_socks'), c('shoes01'), c('grinsegold_beard_sigmund_wip'), c('elvs_male_trilby_hat')], -.55, 1.80)
her, her_rig = person('her', {"gender": 0.0, "age": .54, "muscle": .46, "weight": .3, "height": HEIGHT_HER, "proportions": .92, "cupsize": .5, "firmness": .65, "race": {"asian": .7, "caucasian": .3, "african": 0}},
    [{"target": "measure-waist-circ-decr", "value": .55}, {"target": "measure-hips-circ-incr", "value": .2}, {"target": "measure-underbust-circ-decr", "value": .2}],
    "young_caucasian_female/young_caucasian_female.mhmat", "rehmanpolanski_hair_bun_brown/rehmanpolanski_hair_bun_brown.mhclo", "eyebrow010/eyebrow010.mhclo",
    [c('elvs_ruffle_sleeve_peasant_blouse_1'), c('toigo_bodice_dress_with_lace_ruffle_skirt'), c('toigo_long_full_skirt'), c('shoes04')], .55, 1.65)

def find(rig, key): return next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig and key in o.name)
def bvh(*objs): v, p = world_mesh(*objs); return BVHTree.FromPolygons(v, p)
def bone(rig, name, tail=False): b = rig.data.bones[name]; return rig.matrix_world @ (b.tail_local if tail else b.head_local)
def torso_axis(body, px):
    a = body_coords(body); near = a[np.abs(a[:, 0] - px) < .13]; zs = np.arange(0, 2.0, .02); cx, cy = [], []
    for z in zs:
        s = near[np.abs(near[:, 2] - z) < .015]
        cx.append(float(np.median(s[:, 0])) if len(s) else px); cy.append(float((s[:, 1].min() + s[:, 1].max()) / 2) if len(s) else 0.)
    return lambda z: (float(np.interp(z, zs, cx)), float(np.interp(z, zs, cy)))
def waist_of(body, px, height):
    """The natural waist: the narrowest slice of the torso between 58% and 70% of standing height."""
    a = body_coords(body); best = None
    for z in np.arange(.58 * height, .70 * height, .005):
        s = a[(np.abs(a[:, 2] - z) < .004) & (np.abs(a[:, 0] - px) < .25)]
        if len(s) < 8: continue
        wdt = np.ptp(s[:, 0])
        if best is None or wdt < best[0]: best = (wdt, z)
    return best[1]
def layer(obj, others, gap, outside, axis, reach, zmin=-1., zmax=9., where=lambda p: True):
    """Keeps a garment outside (or inside) other garments, along rays out from the torso axis at each height."""
    tree = bvh(*others); mw = obj.matrix_world; inv = mw.inverted(); moved = 0
    for v in obj.data.vertices:
        p = mw @ v.co
        if not zmin <= p.z <= zmax or not where(p): continue
        cx, cy = axis(p.z); d = Vector((p.x - cx, p.y - cy, 0)); r = d.length
        if r < 1e-3: continue
        d /= r; o = Vector((cx, cy, p.z)); hits = []; start = 0.
        for _ in range(10):
            loc, n, i, dist = tree.ray_cast(o + d * start, d)
            if loc is None: break
            start += dist + 1e-4; hits.append(start)
        near = [h for h in hits if abs(h - r) < reach]
        if not near: continue
        t = max(near) + gap if outside else min(near) - gap
        if (r < t) if outside else (r > t): v.co = inv @ (o + d * t); moved += 1
    print('LAYER', obj.name, 'outside' if outside else 'inside', [o.name for o in others], 'moved', moved)

# ---------- garments: trim, layer, dress --------------------------------------------------------------------------
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    n = o.name.lower()
    if 'shirt_tie' in n: drop(o, lambda p, pts: not (np.ptp(pts[:, 0]) < .2 * max(np.ptp(pts[:, 2]), 1e-6) and len(p) < 2000))   # the tie
    elif 'trouser_short' in n: drop(o, lambda p, pts: len(p) > 400)   # watch chain, rivets and fly buttons; the flap and horn buttons replace them

her_body = find(her_rig, '.body'); her_axis = torso_axis(her_body, her_rig.location.x); her_waist = waist_of(her_body, her_rig.location.x, 1.65)
dress_o = find(her_rig, 'bodice_dress'); blouse_o = find(her_rig, 'blouse'); skirt_o = find(her_rig, 'long_full_skirt')
print('WAIST her', round(her_waist, 3))
# The dirndl: the bodice of the dress, a full gathered midi skirt sewn on at the waist, and a silk apron tied over it.
mw = dress_o.matrix_world; delete_verts(dress_o, [v.index for v in dress_o.data.vertices if (mw @ v.co).z < her_waist - .012])
# Midi length: the skirt's hem at mid-calf, about 30 cm above the ground, keeping its fullness.
hem = float(coords(skirt_o)[:, 2].min()); k = (her_waist - .3) / (her_waist - hem); mw = skirt_o.matrix_world; inv = mw.inverted()
for v in skirt_o.data.vertices:
    p = mw @ v.co
    if p.z < her_waist: p.z = her_waist - (her_waist - p.z) * k; v.co = inv @ p
print('SKIRT hem', round(hem, 3), '-> 0.30, scale', round(k, 2))
layer(blouse_o, [dress_o], .004, False, her_axis, .04, zmin=her_waist - .1)           # blouse under the bodice
mw = blouse_o.matrix_world; delete_verts(blouse_o, [v.index for v in blouse_o.data.vertices if (mw @ v.co).z < her_waist - .03])   # tucked into the skirt
layer(skirt_o, [dress_o], .003, False, her_axis, .05, zmin=her_waist - .04)           # skirt waistband under the bodice

him_body = find(him_rig, '.body'); him_axis = torso_axis(him_body, him_rig.location.x)
shirt_o = find(him_rig, 'shirt_tie'); trousers_o = find(him_rig, 'trouser_short'); hat_o = find(him_rig, 'trilby'); hair_o = find(him_rig, 'short02')
_tr = coords(trousers_o); _top = float(_tr[(np.abs(_tr[:, 0] - him_rig.location.x) < .09) & (_tr[:, 1] < 0), 2].max())
layer(shirt_o, [trousers_o], .004, False, him_axis, .04, zmax=_top - .004)              # shirt tucked into the trousers
# The shoe asset carries its own ankle sock (the atlas's top-right corner); the knee socks replace it. Its faces go,
# with the strip just below the corner that would stand up behind the ankle as a flap; the sole's faces beside it stay.
shoe_o = find(him_rig, 'shoes01'); suv = shoe_o.data.uv_layers.active.data
delete_faces(shoe_o, [p.index for p in shoe_o.data.polygons if all(suv[l].uv.x > .8 and suv[l].uv.y > .7 for l in p.loop_indices)])
# The knee socks run down into the shoes, just inside the leather (as fitted they push through it), to the insole. The
# skin under socks and shoes stays hidden, so the ankle shows sock all the way round down to the shoe's collar.
socks_o = find(him_rig, 'high_socks'); collar = float(coords(shoe_o)[:, 2].max())
mw = socks_o.matrix_world; delete_verts(socks_o, [v.index for v in socks_o.data.vertices if (mw @ v.co).z < .03])
_sk = coords(socks_o); _sk = _sk[(_sk[:, 2] > .15) & (_sk[:, 2] < .3)]; mid = him_rig.location.x
for side in (-1, 1):
    _leg = _sk[np.sign(_sk[:, 0] - mid) == side]; ax = (float(_leg[:, 0].mean()), float(_leg[:, 1].mean()))
    layer(socks_o, [shoe_o], .003, False, lambda z, ax=ax: ax, .08, zmax=collar + .01, where=lambda p, side=side: np.sign(p.x - mid) == side)
print('SOCKS into the shoes, collar', round(collar, 3))
# The hat as fitted rides above the head: settle its inner band at the forehead line, a size smaller.
hat_pts = coords(hat_o); head_top = float(body_coords(him_body)[:, 2].max()); ctr = hat_pts.mean(0)
hz0 = hat_pts[:, 2]; hr0 = np.hypot(hat_pts[:, 0] - ctr[0], hat_pts[:, 1] - ctr[1]); r0 = float(np.percentile(hr0[hz0 > np.percentile(hz0, 70)], 90))
rim0 = float(hz0[hr0 < r0 * 1.15].min()); dz = (head_top - .085) - rim0; mw = hat_o.matrix_world; inv = mw.inverted()
for v in hat_o.data.vertices:
    p = mw @ v.co; p.x = ctr[0] + (p.x - ctr[0]) * .94; p.y = ctr[1] + (p.y - ctr[1]) * .94; p.z = rim0 + (p.z - rim0) * .94 + dz; v.co = inv @ p
print('HAT head top', round(head_top, 3), 'rim', round(rim0, 3), 'moved', round(dz, 3))
# Hair under the hat's crown would push through the felt.
hat_pts = coords(hat_o); hc = hat_pts[:, :2].mean(0); hr = np.hypot(hat_pts[:, 0] - hc[0], hat_pts[:, 1] - hc[1]); hz = hat_pts[:, 2]; z0, z1 = hz.min(), hz.max()
crown_r = float(np.median([np.percentile(hr[np.abs(hz - z) < .0015], 90) for z in np.arange(z0 + .5 * (z1 - z0), z0 + .9 * (z1 - z0), .003) if (np.abs(hz - z) < .0015).any()]))
rim_z = float(hz[hr < crown_r * 1.15].min())
mw = hair_o.matrix_world; delete_verts(hair_o, [v.index for v in hair_o.data.vertices if (mw @ v.co).z > rim_z + .004])
print('HAT crown r', round(crown_r, 3), 'rim z', round(rim_z, 3))

mats = {
    'shirt': material('checked-shirt', image('gingham', gingham()), rough=.85, sheen=.3, normal=f'{D}/clothes/elvs_male_shirt_tie_tucked1/shirttietex1_normal.png'),
    'leather': material('lederhosen', image('leather', leather()), rough=.6, sheen=.2),
    'socks': material('wool-socks', image('wool', ribbed('#e6decb')), rough=.95, sheen=.5),
    'blouse': material('blouse', image('cotton', solid('#f4f1ea', grain=.05, period=4)), rough=.8, sheen=.4),
    'bodice': material('bodice', image('velvet', solid('#1f4a33', grain=.12, scale=30, period=3)), rough=.65, sheen=1.),
    'skirt': material('skirt', image('wine', solid('#7a1c2e', grain=.08, period=4)), rough=.8, sheen=.3),
    'apron': material('apron', image('silk', taffeta('#c4808f', '#c98b99', stripes=180)), rough=.3, sheen=.8),
}
for o in [o for o in bpy.data.objects if o.type == 'MESH']:
    n = o.name.lower(); tex = texture_of(o)
    if 'shirt_tie' in n: dress(o, mats['shirt'])
    elif 'trouser_short' in n: dress(o, mats['leather'])
    elif 'high_socks' in n: dress(o, mats['socks'])
    elif 'trilby' in n and tex: img, a = tinted(tex, '#4c5843'); dress(o, material('loden-felt', img, rough=.95, sheen=.5, normal=f'{D}/clothes/elvs_male_trilby_hat/trilby_normals.png'))
    elif 'shoes01' in n and tex: dress(o, material('haferlschuh', recoloured(tex, '#4a2e1b', '#e6decb', lambda l, s: np.fromfunction(lambda y, x: (x > .82 * l.shape[1]) & (y > .82 * l.shape[0]), l.shape)), rough=.45, sheen=.1, normal=f'{D}/clothes/shoes01/shoes01_normal.png'))
    elif 'shoes04' in n and tex: dress(o, material('ballet-flat', recoloured(tex, '#1b1714', '#f1ede4', lambda l, s: l > .3), rough=.4, normal=f'{D}/clothes/shoes04/shoes04_normal.png'))
    elif 'blouse' in n: dress(o, mats['blouse'])
    elif 'bodice_dress' in n: dress(o, mats['bodice'])
    elif 'long_full_skirt' in n: dress(o, mats['skirt'])
    elif 'beard' in n and tex: dress(o, material('beard', ramped(tex, '#24170f', '#8e6544'), rough=.7, alpha=True))
    elif 'short02' in n and tex: dress(o, material('his-hair', ramped(tex, '#2a1c13', '#6a4b34'), rough=.6, alpha=True))
    elif 'hair_bun' in n and tex:
        dress(o, material('her-hair', ramped(tex, '#120d0a', '#3b2c22'), rough=.62, alpha=True)); sd = o.modifiers.new('Smooth', 'SUBSURF'); sd.levels = 1; sd.render_levels = 1
    elif 'eyebrow' in n and tex: retexture(o, ramped(tex, '#2e2017', '#5a4130') if o.name.startswith('him') else ramped(tex, '#140f0c', '#2e231c'))

# ---------- skin, complexion and eyes -----------------------------------------------------------------------------
# Albedo targets read from two photographs of the couple, white-balanced against each other: him fair with a warm,
# ruddy flush; her medium olive, about a third darker. Hair: his warm dark brown, beard brown with ginger-blond lights;
# hers near-black. Eyes: his grey-green with hazel, hers dark brown.
def soft(a, r, passes=3):
    """Separable box blur, three passes (close to Gaussian), edges clamped."""
    for _ in range(passes):
        for axis in (0, 1):
            pad = [(0, 0)] * a.ndim; pad[axis] = (r + 1, r); c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis); n = a.shape[axis]
            a = (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis)) / (2 * r + 1)
    return a
def skin_tone(body, target, flush=None, shade=None, scalp=False):
    """One gain for the whole skin atlas, set so the front of the face lands on the target albedo. The atlas's flat
    background is left out of the measurement only: some atlases share its colour with real skin."""
    mat = body.data.materials[0]; nt = mat.node_tree; node = nt.nodes['diffuseTexture']; src = node.image; w, h = src.size
    px = np.array(src.pixels[:]).reshape(h, w, 4); q = np.round(px[..., :3] * 255).astype(np.int32)
    key = (q[..., 0] << 16) | (q[..., 1] << 8) | q[..., 2]; vals, counts = np.unique(key, return_counts=True); bgk = vals[counts.argmax()]
    bg = np.array([(bgk >> 16) & 255, (bgk >> 8) & 255, bgk & 255]); m = np.abs(q - bg).max(-1) > 6
    rgb = decode(px[..., :3]); face = np.zeros((h, w), bool); face[int(.33 * h):int(.67 * h), int(.78 * w):int(.95 * w)] = True   # the front of the face
    lum = rgb @ np.array([.2126, .7152, .0722]); sel = m & face; sel &= lum > .85 * np.median(lum[sel])
    g = rgb * (srgb(target) / np.median(rgb[sel], 0)); k = .82
    rgb = np.where(g < k, g, k + (1 - k) * (1 - np.exp(-(g - k) / (1 - k))))   # roll highlights off instead of clipping them flat
    if scalp:
        # Round the face, the atlas shades in scalp stubble; where the hairline leaves it showing it reads as a mottled
        # band. Outside the front of the face, darker-than-skin pixels take the face's tone, keeping their fine grain.
        lum = rgb @ np.array([.2126, .7152, .0722]); ref = float(lum[sel].mean())
        fr = np.zeros((h, w)); fr[int(.33 * h):int(.67 * h), int(.78 * w):int(.95 * w)] = 1; fr = soft(fr, 30)
        isle = np.zeros((h, w)); isle[:, int(.64 * w):] = 1
        wgt = np.clip((.9 * ref - lum) / (.25 * ref), 0, 1) * (1 - fr) * isle
        detail = rgb / np.maximum(soft(rgb, 3, 2), 1e-4); even = srgb(target) * np.clip(detail, .85, 1.15)
        rgb = rgb * (1 - wgt[..., None]) + even * wgt[..., None]
    print('SKIN', body.name, 'skin pixels', round(float(m.mean()), 3), 'target', target)
    if flush: rgb = paint(body, rgb, *flush)
    if shade: rgb = paint(body, rgb, *shade)
    node.image = image(body.name + '-skin', np.clip(rgb, 0, 1), px[..., 3]); pure(nt)
    p = nt.nodes['Principled BSDF']
    for k, v in (('Subsurface Weight', .25), ('Subsurface Scale', .012), ('Roughness', .5)):
        if k in p.inputs: p.inputs[k].default_value = v
    if 'Subsurface Radius' in p.inputs: p.inputs['Subsurface Radius'].default_value = (1., .4, .25)
def paint(body, rgb, centres, sigma, tint):
    """Tints the skin texture round 3-D points (cheeks, nose), or by a per-vertex weight function of position,
    rasterising a soft weight through the body's UVs."""
    masks = [md for md in body.modifiers if md.type == 'MASK']
    for md in masks: md.show_viewport = False
    bpy.context.view_layer.update(); deps = bpy.context.evaluated_depsgraph_get(); ev = body.evaluated_get(deps); em = ev.to_mesh()
    pos = np.array([tuple(body.matrix_world @ v.co) for v in em.vertices]); ev.to_mesh_clear()
    for md in masks: md.show_viewport = True
    bpy.context.view_layer.update()
    me = body.data; assert len(pos) == len(me.vertices); wv = np.zeros(len(pos))
    if callable(centres): wv = centres(pos)
    else:
        for c in centres: wv = np.maximum(wv, np.exp(-np.sum((pos - np.array(c)) ** 2, 1) / (2 * sigma ** 2)))
    h, w, _ = rgb.shape; uv = me.uv_layers.active.data; acc = np.zeros((h, w))
    for poly in me.polygons:
        vs = list(poly.vertices)
        if wv[vs].max() < .02: continue
        li = list(poly.loop_indices); uvs = np.array([tuple(uv[l].uv) for l in li]) * [w, h]; ws = wv[vs]
        for k in range(1, len(li) - 1):
            tri = uvs[[0, k, k + 1]]; tw = ws[[0, k, k + 1]]
            x0, y0 = np.floor(tri.min(0)).astype(int); x1, y1 = np.ceil(tri.max(0)).astype(int)
            ys, xs = np.mgrid[max(y0, 0):min(y1, h - 1) + 1, max(x0, 0):min(x1, w - 1) + 1]
            (ax, ay), (bx, by), (cx, cy) = tri; den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9: continue
            l1 = ((by - cy) * (xs + .5 - cx) + (cx - bx) * (ys + .5 - cy)) / den; l2 = ((cy - ay) * (xs + .5 - cx) + (ax - cx) * (ys + .5 - cy)) / den; l3 = 1 - l1 - l2
            inside = (l1 >= -.01) & (l2 >= -.01) & (l3 >= -.01)
            acc[ys[inside], xs[inside]] = np.maximum(acc[ys[inside], xs[inside]], (l1 * tw[0] + l2 * tw[1] + l3 * tw[2])[inside])
    return rgb * (1 - acc[..., None] * (1 - np.array(tint)))
def face_points(body, rig):
    a = body_coords(body); head = bone(rig, 'head'); near = a[(a[:, 2] > head.z - .02) & (a[:, 2] < head.z + .09) & (np.abs(a[:, 0] - head.x) < .05)]
    nose = near[np.argmin(near[:, 1])]; pts = [tuple(nose)]
    for s in (1, -1):
        q = np.array([nose[0] + s * .045, nose[1] + .03, nose[2] + .012]); pts.append(tuple(a[np.argmin(np.sum((a - q) ** 2, 1))]))
    return pts
def eyes(o, mix):
    """Blends MakeHuman iris textures; the alpha (the clear cornea) is kept from the first."""
    E = f'{D}/eyes/materials'; out = None; alpha = None
    for name, k, gain in mix:
        src = bpy.data.images.load(f'{E}/{name}_eye.png'); w, h = src.size; px = np.array(src.pixels[:]).reshape(h, w, src.channels)
        lin = decode(px[..., :3]) * gain; out = lin * k if out is None else out + lin * k
        if alpha is None and src.channels == 4: alpha = px[..., 3]
    retexture(o, image(o.name + '-iris', np.clip(out, 0, 1), alpha))
beard_tree = bvh(find(him_rig, 'beard'))
def stubble(pos):
    d = np.array([beard_tree.find_nearest(Vector(p))[3] if beard_tree.find_nearest(Vector(p))[0] is not None else 1. for p in pos])
    return np.clip(1 - (d - .004) / .012, 0, 1) * .85
skin_tone(him_body, '#d8ab97', (face_points(him_body, him_rig), .026, (1., .9, .9)), (stubble, 0, (.62, .55, .5)))
skin_tone(her_body, '#b39675', (face_points(her_body, her_rig)[1:], .028, (1., .94, .93)), scalp=True)
eyes(find(him_rig, 'high-poly'), (('grey', .55, 1.), ('green', .27, 1.), ('brownlight', .18, 1.)))
eyes(find(her_rig, 'high-poly'), (('brown', 1., .5),))

# ---------- generated pieces, skinned to the rig ------------------------------------------------------------------
def new_object(name, verts, faces, mat, uvs=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    if uvs is not None:
        uv = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices: uv.data[li].uv = uvs[me.loops[li].vertex_index]
    me.materials.append(mat); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob
def skin(ob, src, rig, solidify=0.):
    """Parents a world-space piece to the rig and copies weights from the nearest vertices of the garment it sits on."""
    sv = world_mesh(src)[0]; kd = KDTree(len(sv))
    for i, p in enumerate(sv): kd.insert(p, i)
    kd.balance(); names = {g.index: g.name for g in src.vertex_groups}; me = src.data
    ob.data.transform(rig.matrix_world.inverted()); ob.parent = rig; ob.matrix_parent_inverse.identity(); ob.location = (0, 0, 0)
    groups = {}
    for v in ob.data.vertices:
        acc = {}
        for co, i, dist in kd.find_n(rig.matrix_world @ v.co, 4):
            k = 1 / max(dist, 1e-4)
            for g in me.vertices[i].groups: acc[names[g.group]] = acc.get(names[g.group], 0) + g.weight * k
        total = sum(acc.values()) or 1
        for gname, w in acc.items():
            if w / total > .01: groups.setdefault(gname, []).append((v.index, w / total))
    for gname, items in groups.items():
        vg = ob.vertex_groups.new(name=gname)
        for i, w in items: vg.add([i], w, 'REPLACE')
    ob.modifiers.new('Armature', 'ARMATURE').object = rig
    if solidify: s = ob.modifiers.new('Solidify', 'SOLIDIFY'); s.thickness = solidify; s.offset = 0
    return ob
def surface_path(tree, keys, axis, step=.008):
    """Densifies key points and lays them on the garment surface; returns points and outward normals."""
    pts = []
    for a, b in zip(keys, keys[1:]):
        k = max(2, int((b - a).length / step)); pts += [a.lerp(b, i / k) for i in range(k)]
    pts.append(keys[-1])
    for it in range(5):
        pts = [tree.find_nearest(p)[0] for p in pts]
        if it < 4: pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
    nrm = []
    for p in pts:
        n = tree.find_nearest(p)[1]; cx, cy = axis(p.z); ctr = Vector((cx, cy, min(p.z, axis.top - .12)))
        nrm.append(n if n.dot(p - ctr) > 0 else -n)
    nrm = [sum(nrm[max(0, i - 3):i + 4], Vector()).normalized() for i in range(len(nrm))]
    return pts, nrm
def ribbon(name, pts, nrm, width, off, mat, src, rig):
    verts, uvs, faces, L = [], [], [], 0.
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized(); s = t.cross(nrm[i]).normalized(); cc = p + nrm[i] * off
        if i: L += (p - pts[i - 1]).length
        verts += [cc - s * width / 2, cc + s * width / 2]; uvs += [(0, L / width / 4), (1, L / width / 4)]
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(pts) - 1)]
    return skin(new_object(name, verts, faces, mat, uvs), src, rig, solidify=.003)
def patch(name, tree, xs, zs, y0, off, mat, src, rig, back=False):
    """A panel laid on the garment from the front (or back): rows of ray hits, lifted along the surface normal."""
    verts, uvs = [], []
    for j, z in enumerate(zs):
        for i, x in enumerate(xs):
            o = Vector((x, y0 + (1 if back else -1), z)); loc, n, idx, dist = tree.ray_cast(o, Vector((0, -1 if back else 1, 0)))
            if n.y > 0 and not back or n.y < 0 and back: n = -n
            verts.append(loc + n * off); uvs.append((i / (len(xs) - 1), j / (len(zs) - 1)))
    w = len(xs); faces = [(j * w + i, j * w + i + 1, (j + 1) * w + i + 1, (j + 1) * w + i) for j in range(len(zs) - 1) for i in range(w - 1)]
    return skin(new_object(name, verts, faces, mat, uvs), src, rig, solidify=.003)
def button(name, at, normal, radius, mat, src, rig):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=radius, radius2=radius * .85, depth=.004)
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges], offset=.0008, segments=2, affect='EDGES')
    rot = Vector((0, 0, 1)).rotation_difference(normal).to_matrix().to_4x4(); bmesh.ops.transform(bm, matrix=Matrix.Translation(at + normal * .006) @ rot, verts=bm.verts)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return skin(ob, src, rig)
def tube(name, pts, radius, mat, cyclic=True):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    sp.use_cyclic_u = cyclic; cu.bevel_depth = radius; cu.bevel_resolution = 2
    tmp = bpy.data.objects.new(name + '-curve', cu); bpy.context.scene.collection.objects.link(tmp); bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp); bpy.data.curves.remove(cu)
    me.materials.clear(); me.materials.append(mat); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob

def strap_texture():
    rgb = leather(256, '#5b3d27', '#2f1e12'); rgb = stitched(rgb, 26, dash=12, width=3, ends=False); return rgb
def bar_texture():
    rgb = leather(512, '#5b3d27', '#2f1e12')[:160]; rgb = stitched(rgb, 12, dash=9, width=2); rgb = tendrils(rgb, 80, 30)
    rgb = edelweiss(rgb, 256, 80, 46); rgb = edelweiss(rgb, 110, 80, 26, 7); rgb = edelweiss(rgb, 402, 80, 26, 7); return rgb
def flap_texture():
    rgb = leather(512, '#6a4a30', '#3a2617')[:400]; rgb = stitched(rgb, 14, dash=10, width=3); rgb = stitched(rgb, 30, dash=10, width=2, colour='#7f9a62')
    rgb = tendrils(rgb, 300, 40); rgb = edelweiss(rgb, 256, 170, 60); return rgb
gen = {
    'strap': material('brace-leather', image('strap', strap_texture()), rough=.55, sheen=.2),
    'bar': material('brace-bar', image('bar', bar_texture()), rough=.55, sheen=.25),
    'flap': material('trouser-flap', image('flap', flap_texture()), rough=.6, sheen=.2),
    'horn': material('staghorn', image('horn', solid('#d8c8a8', grain=.25, scale=8, period=9)), rough=.4),
    'cord-green': material('hat-cord-green', colour='#3f5b3a', rough=.7, sheen=.6),
    'cord-cream': material('hat-cord-cream', colour='#ddd3bb', rough=.7, sheen=.6),
    'pewter': material('pewter', colour='#a39f96', rough=.35, metal=1.),
    'tuft': material('chamois-tuft', attribute='tuft', rough=.55, sheen=.6),
}

# Braces: two straps from the waistband over the shoulders, an embroidered bar across the chest, crossed at the back.
px = him_rig.location.x; torso = bvh(shirt_o, trousers_o)
tr = coords(trousers_o); front = tr[(np.abs(tr[:, 0] - px) < .09) & (tr[:, 1] < 0)]; z_w = float(front[:, 2].max())
shoulder = bone(him_rig, 'clavicle_l', tail=True); z_top = shoulder.z; sw = shoulder.x - px; sx = .6 * sw; y_sh = shoulder.y
him_axis.top = z_top
def front_at(x, z, back=False):
    loc = torso.ray_cast(Vector((x, (1.0 if back else -1.0), z)), Vector((0, -1 if back else 1, 0)))[0]; return loc
def top_at(x, y): return torso.ray_cast(Vector((x, y, z_top + .5)), Vector((0, 0, -1)))[0]
z_bar = z_top - .135; z_cross = z_top - .2; z_end = z_w - .03
print('BRACES waist', round(z_w, 3), 'shoulder', round(z_top, 3), 'half-width', round(sw, 3))
straps = []
for sgn, lift in ((1, 0.), (-1, .0025)):
    keys = [front_at(px + sgn * .08, z_end), front_at(px + sgn * .085, z_bar), front_at(px + sgn * .95 * sx, z_top - .06), top_at(px + sgn * sx, y_sh),
            front_at(px + sgn * .95 * sx, z_top - .07, True), front_at(px, z_cross, True), front_at(px - sgn * .08, z_end, True)]
    pts, nrm = surface_path(torso, keys, him_axis); straps.append((pts, nrm))
    ribbon('brace-' + ('left' if sgn > 0 else 'right'), pts, nrm, .034, .0045 + lift, gen['strap'], shirt_o, him_rig)
    for end, idx in (('front', 0), ('back', -1)):
        button(f'brace-button-{end}-{sgn}', pts[idx], nrm[idx], .0085, gen['horn'], trousers_o, him_rig)
xl = min(straps[0][0], key=lambda p: abs(p.z - z_bar) + (10 if p.y > him_axis(p.z)[1] else 0)).x
xr = min(straps[1][0], key=lambda p: abs(p.z - z_bar) + (10 if p.y > him_axis(p.z)[1] else 0)).x
patch('brace-chest-bar', torso, np.linspace(xr - .022, xl + .022, 24), np.linspace(z_bar - .03, z_bar + .03, 7), 0, .0085, gen['bar'], shirt_o, him_rig)
# The flap (Hosentürl) buttons to the waistband over the fly.
pants = bvh(trousers_o)
patch('trouser-flap', pants, np.linspace(px - .095, px + .095, 22), np.linspace(z_w - .19, z_w - .045, 16), 0, .004, gen['flap'], trousers_o, him_rig)
for sgn in (1, -1):
    p = front_at(px + sgn * .085, z_w - .055); n = pants.find_nearest(p)[1]; n = n if n.y < 0 else -n
    button(f'flap-button-{sgn}', p, n, .007, gen['horn'], trousers_o, him_rig)

# Hat: a twisted green-and-cream cord round the crown, and a chamois tuft in a pewter holder at the back left.
hat_tree = bvh(hat_o); band_z = rim_z + .02; ring = []
for k in range(96):
    # Outward from the crown's centre: the last hit within the crown is its outer felt, whatever the brim does further out.
    a = 2 * math.pi * k / 96; d = Vector((math.cos(a), math.sin(a), 0)); o = Vector((hc[0], hc[1], band_z)); start = 0.; best = None
    for _ in range(6):
        loc, n, i, dist = hat_tree.ray_cast(o + d * start, d)
        if loc is None or start + dist > crown_r * 1.3: break
        start += dist + 1e-4; best = loc
    ring.append(best + d * .0025 if best else None)
ring = [p for p in ring if p]
for strand, (mat, phase) in enumerate(((gen['cord-green'], 0.), (gen['cord-cream'], math.pi))):
    pts = []; L = 0.
    for i in range(len(ring) * 6):
        f = i / 6; a0 = ring[int(f) % len(ring)]; a1 = ring[(int(f) + 1) % len(ring)]; p = a0.lerp(a1, f - int(f))
        L = i / (len(ring) * 6) * 2 * math.pi * crown_r; out = Vector((p.x - hc[0], p.y - hc[1], 0)).normalized(); ph = L / .011 * 2 * math.pi + phase
        pts.append(p + (out * math.cos(ph) + Vector((0, 0, 1)) * math.sin(ph)) * .0018)
    skin(tube(f'hat-cord-{strand}', pts, .0019, mat), hat_o, him_rig)
a = math.radians(55); side = Vector((math.cos(a), math.sin(a), 0)); base = min(ring, key=lambda p: (Vector((p.x - hc[0], p.y - hc[1], 0)).normalized() - side).length)
axis_dir = (side * .35 + Vector((0, 1, 0)) * .35 + Vector((0, 0, 1)) * .87).normalized()
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=.0075, radius2=.0105, depth=.03)
bmesh.ops.transform(bm, matrix=Matrix.Translation(base + side * .006 + axis_dir * .015) @ Vector((0, 0, 1)).rotation_difference(axis_dir).to_matrix().to_4x4(), verts=bm.verts)
me = bpy.data.meshes.new('tuft-holder'); bm.to_mesh(me); bm.free(); me.materials.append(gen['pewter']); holder = bpy.data.objects.new('tuft-holder', me); bpy.context.scene.collection.objects.link(holder)
for p in me.polygons: p.use_smooth = True
skin(holder, hat_o, him_rig)
root = base + side * .006 + axis_dir * .028; verts, faces, cols = [], [], []
u = axis_dir.orthogonal().normalized(); w = axis_dir.cross(u)
for k in range(900):
    r0 = math.sqrt(rng.random()) * .009; th = rng.random() * 2 * math.pi; start = root + (u * math.cos(th) + w * math.sin(th)) * r0
    spread = .15 + .55 * r0 / .009; d = (axis_dir + (u * math.cos(th) + w * math.sin(th)) * spread + Vector(rng.normal(0, .08, 3))).normalized()
    length = .09 + .08 * rng.random(); side_v = d.cross(Vector(rng.normal(0, 1, 3))).normalized(); base_i = len(verts)
    for s in range(6):
        t = s / 5; p = start + d * length * t + Vector((0, 0, -.02)) * t * t * spread; half = (.0007 * (1 - t) + .00015)
        verts += [p - side_v * half, p + side_v * half]
        col = (srgb('#22170f') * (1 - t ** 3) + srgb('#d8d0be') * t ** 3) if t > .55 else srgb('#22170f'); cols += [col, col]
        if s: faces.append((base_i + 2 * s - 2, base_i + 2 * s, base_i + 2 * s + 1, base_i + 2 * s - 1))
tuft = new_object('chamois-tuft', verts, faces, gen['tuft']); attr = tuft.data.color_attributes.new('tuft', 'FLOAT_COLOR', 'POINT')
for i, col in enumerate(cols): attr.data[i].color = (*col, 1)
skin(tuft, hat_o, him_rig)

# The dirndl apron: a gathered panel over the front of the skirt, its waistband, and a bow at her right hip.
sk_tree = bvh(skirt_o); top_tree = bvh(dress_o, skirt_o); hem = float(coords(skirt_o)[:, 2].min())
z_top, z_bot = her_waist + .004, hem + .055; phis = np.radians(np.linspace(-50, 50, 81)); zs = np.linspace(z_top, z_bot, 48)
def outer(tree, z, phi):
    cx, cy = her_axis(z); o = Vector((cx, cy, z)); d = Vector((math.sin(phi), -math.cos(phi), 0)); start = 0.; far = None
    for _ in range(12):
        loc, n, i, dist = tree.ray_cast(o + d * start, d)
        if loc is None: break
        start += dist + 1e-4; far = start
    return far
R = np.zeros((len(zs), len(phis)))
for j, z in enumerate(zs):
    for i, phi in enumerate(phis): R[j, i] = outer(top_tree if z > her_waist - .03 else sk_tree, z, phi) or np.nan
    row = R[j]; good = ~np.isnan(row); row[~good] = np.interp(np.flatnonzero(~good), np.flatnonzero(good), row[good]) if good.any() else .15
    env = np.array([row[max(0, i - 3):i + 4].max() for i in range(len(row))])          # over the pleats, not into them
    R[j] = np.convolve(np.pad(env, 4, mode='edge'), np.ones(9) / 9, mode='valid')
for j in range(1, len(zs)): R[j] = np.maximum(R[j], R[j - 1] - .004)                       # an apron hangs; it never tucks in
verts, uvs = [], []
for j, z in enumerate(zs):
    t = j / (len(zs) - 1); cx, cy = her_axis(z)
    for i, phi in enumerate(phis):
        fold = (.0035 * (1 - .7 * t)) * (math.sin(phi * 19 + .7) * .7 + math.sin(phi * 43 + 2.1) * .3) + .0015 * math.sin(phi * 7 + t * 2)
        r = R[j, i] + .005 + abs(fold); verts.append(Vector((cx + math.sin(phi) * r, cy - math.cos(phi) * r, z))); uvs.append((i / (len(phis) - 1), 1 - t))
w = len(phis); faces = [(j * w + i, (j + 1) * w + i, (j + 1) * w + i + 1, j * w + i + 1) for j in range(len(zs) - 1) for i in range(w - 1)]
apron_o = skin(new_object('dirndl-apron', verts, faces, mats['apron'], uvs), skirt_o, her_rig, solidify=.0015)
band = []; zb = np.linspace(her_waist - .016, her_waist + .016, 4); ring = np.radians(np.linspace(0, 360, 145))
for z in zb:
    cx, cy = her_axis(z)
    for phi in ring:
        r = (outer(top_tree, z, phi) or .14) + .011; band.append(Vector((cx + math.sin(phi) * r, cy - math.cos(phi) * r, z)))
w = len(ring); faces = [(j * w + i, (j + 1) * w + i, (j + 1) * w + i + 1, j * w + i + 1) for j in range(len(zb) - 1) for i in range(w - 1)]
skin(new_object('apron-waistband', band, faces, mats['apron'], [(i / (w - 1), j / 3) for j in range(4) for i in range(w)]), skirt_o, her_rig, solidify=.002)
# The bow: two loops and two tails from a knot on the band, on the wearer's right.
phi = math.radians(-48); cx, cy = her_axis(her_waist); r = (outer(top_tree, her_waist, phi) or .14) + .02
out = Vector((math.sin(phi), -math.cos(phi), 0)); along = Vector((math.cos(phi), math.sin(phi), 0)); up = Vector((0, 0, 1)); knot = Vector((cx, cy, her_waist)) + out * r
def bow_part(name, pts2d, lift, stand):
    pts = [knot + along * u + up * v + out * (lift + bulge) for u, v, bulge in pts2d]
    nrm = []
    for i in range(len(pts)):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized(); nrm.append(t.cross(out).normalized() if stand else out)
    return ribbon(name, pts, nrm, .032, 0., mats['apron'], skirt_o, her_rig)
for sgn in (1, -1):
    bow_part(f'bow-loop-{sgn}', [(sgn * (.042 - .042 * math.cos(a)), .024 * math.sin(a) + .012 * (1 - math.cos(a)) / 2, .012 * math.sin(a / 2)) for a in np.linspace(0, 2 * math.pi, 40)], .004, True)
    bow_part(f'bow-tail-{sgn}', [(sgn * (.008 + .022 * s), -.01 - (.24 if sgn > 0 else .2) * s, .002 * s) for s in np.linspace(0, 1, 30)], .0, False)
bmk = bmesh.new(); bmesh.ops.create_cube(bmk, size=1); bmesh.ops.scale(bmk, vec=(.024, .016, .03), verts=bmk.verts)
rot = Matrix((along, out, up)).transposed().to_4x4(); bmesh.ops.transform(bmk, matrix=Matrix.Translation(knot + out * .006) @ rot, verts=bmk.verts)
bmesh.ops.bevel(bmk, geom=list(bmk.edges), offset=.004, segments=3, affect='EDGES')
me = bpy.data.meshes.new('bow-knot'); bmk.to_mesh(me); bmk.free(); me.materials.append(mats['apron']); kn = bpy.data.objects.new('bow-knot', me); bpy.context.scene.collection.objects.link(kn)
for p in me.polygons: p.use_smooth = True
skin(kn, skirt_o, her_rig)

# Skirt and apron sway between the legs instead of following one thigh.
for o in (skirt_o, apron_o):
    groups = {g.index: g.name for g in o.vertex_groups}; pel = o.vertex_groups.get('pelvis') or o.vertex_groups.new(name='pelvis'); mw = o.matrix_world
    for v in o.data.vertices:
        if (mw @ v.co).z > her_waist - .06: continue
        legs = [(g, groups[g.group]) for g in v.groups if groups[g.group].startswith(('thigh', 'calf'))]; moved = 0.
        for g, name in legs: moved += g.weight * .65; g.weight *= .35
        if moved: pel.add([v.index], next((g.weight for g in v.groups if g.group == pel.index), 0) + moved, 'REPLACE')

# ---------- poses -----------------------------------------------------------------------------------------------
def aim(rig, name, direction):
    pb = rig.pose.bones[name]; bpy.context.view_layer.update(); m = pb.matrix.copy(); head = m.translation
    cur = (m.to_3x3() @ Vector((0, 1, 0))).normalized(); q = cur.rotation_difference(Vector(direction).normalized())
    pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ m; bpy.context.view_layer.update()
def rest(rig):
    for pb in rig.pose.bones: pb.matrix_basis = Matrix()
    rig.location.z = 0; bpy.context.view_layer.update()
def ground(rig):
    feet = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig and 'shoes' in o.name]
    rig.location.z -= float(coords(*feet)[:, 2].min()); bpy.context.view_layer.update()
def relaxed(rig, out=.16):
    """Arms hanging, elbows a little bent; `out` opens them enough to clear a full skirt."""
    rest(rig)
    for s in (1, -1):
        side = 'l' if s > 0 else 'r'
        aim(rig, f'upperarm_{side}', (s * out, .03, -1)); aim(rig, f'lowerarm_{side}', (s * (out * .7), -.3, -1)); aim(rig, f'hand_{side}', (s * .06, -.2, -1))
    ground(rig)
def walking(rig, lead=1):
    """Mid-stride: the lead leg reaching for heel strike, the other pushing off; arms swing against the legs."""
    rest(rig); front_s = 'l' if lead > 0 else 'r'; back_s = 'r' if lead > 0 else 'l'
    aim(rig, f'thigh_{front_s}', (0, -.42, -.91)); aim(rig, f'calf_{front_s}', (0, -.3, -.95)); aim(rig, f'foot_{front_s}', (0, -1, .05))
    aim(rig, f'thigh_{back_s}', (0, .3, -.95)); aim(rig, f'calf_{back_s}', (0, .62, -.78)); aim(rig, f'foot_{back_s}', (0, -.55, -.84))
    for side, swing in ((front_s, .28), (back_s, -.3)):
        s = 1 if side == 'l' else -1
        aim(rig, f'upperarm_{side}', (s * .12, swing, -1)); aim(rig, f'lowerarm_{side}', (s * .08, swing * 1.6 - .25, -1)); aim(rig, f'hand_{side}', (s * .05, swing - .2, -1))
    ground(rig)

if RENDER:
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = int(os.environ.get('SAMPLES', '48')); scene.cycles.use_denoising = True
    scene.view_settings.view_transform = 'Standard'; scene.view_settings.exposure = -1.
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True; nt = world.node_tree; bg = nt.nodes['Background']; sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sun_elevation = math.radians(38); sky.sun_rotation = math.radians(210); sky.sun_disc = False; nt.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = .18
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3; sun.color = (1, .93, .84); sun.angle = math.radians(3); so = bpy.data.objects.new('sun', sun); so.rotation_euler = (math.radians(52), 0, math.radians(-35)); scene.collection.objects.link(so)
    g = bpy.data.meshes.new('g'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=20); bm.to_mesh(g); go = bpy.data.objects.new('ground', g); scene.collection.objects.link(go)
    gm = bpy.data.materials.new('grass'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb('#8f8a80'), 1); g.materials.append(gm)   # neutral paving, so no green cast on skin
    cam = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
    def shot(name, loc, target, lens, w, h):
        co.location = loc; cam.lens = lens; co.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.resolution_x = w; scene.render.resolution_y = h; scene.render.filepath = f'{OUT}/{name}.png'; bpy.ops.render.render(write_still=True)
    relaxed(him_rig); relaxed(her_rig, .27)
    for who, rig in (('her', her_rig), ('him', him_rig)):
        hp = bone(rig, 'head') + Vector((0, 0, .07)); shot(f'face-{who}', hp + Vector((.18, -.95, .02)), hp, 85, 800, 900)
    shot('full', (0, -5.6, 1.0), (0, 0, .9), 50, 900, 1000)
    shot('three-quarter', (-3.2, -4.2, 1.3), (0, 0, .95), 50, 900, 1000)
    shot('back', (1.4, 5.2, 1.3), (0, 0, .95), 50, 900, 1000)
    for who, rig in (('him', him_rig), ('her', her_rig)):
        ch = bone(rig, 'spine_03'); shot(f'torso-{who}', ch + Vector((.25, -1.6, .05)), ch + Vector((0, 0, -.12)), 70, 800, 900)
    fx = him_rig.location.x; shot('feet-him', (fx + .55, -1.15, .38), (fx, 0, .1), 50, 900, 600)
    walking(him_rig, 1); walking(her_rig, -1); him_rig.location.y = .25; her_rig.location.y = -.25; bpy.context.view_layer.update()
    shot('walk', (-4.4, -2.6, 1.15), (0, 0, .9), 50, 1100, 900)
# ---------- animation and export --------------------------------------------------------------------------------------
# A walk cycle (two steps, in place: the viewer moves the figure) from typical gait curves, and an idle loop. Joint angles
# in degrees through the cycle, heel strike at 0; the right leg runs half a cycle behind the left.
HIP = [(0, 25), (.1, 22), (.3, 6), (.5, -10), (.6, -6), (.7, 8), (.85, 24), (1, 25)]
KNEE = [(0, 4), (.12, 16), (.4, 4), (.6, 32), (.72, 58), (.88, 22), (1, 4)]
ANKLE = [(0, 0), (.08, -6), (.4, 9), (.6, -18), (.7, -8), (.9, 0), (1, 0)]
FPS, WALK_SECONDS, IDLE_SECONDS, WORK_SECONDS, SIT_SECONDS = 30, 1.1, 4., 3., 6.
def curve(keys, p): return math.radians(float(np.interp(p % 1, [k[0] for k in keys], [k[1] for k in keys])))
def rest_dir(rig, name): b = rig.data.bones[name]; return (b.tail_local - b.head_local).normalized()
def Rx(a): return Matrix.Rotation(a, 3, 'X')
def turn(rig, name, axis, angle):
    pb = rig.pose.bones[name]; bpy.context.view_layer.update(); m = pb.matrix.copy(); head = m.translation
    pb.matrix = Matrix.Translation(head) @ Matrix.Rotation(angle, 4, axis) @ Matrix.Translation(-head) @ m; bpy.context.view_layer.update()
def arms(rig, out, swing=(0., 0.), bend=(0., 0.)):
    for s, w, e in ((1, swing[0], bend[0]), (-1, swing[1], bend[1])):
        side = 'l' if s > 0 else 'r'
        aim(rig, f'upperarm_{side}', Rx(-w) @ Vector((s * out, .03, -1)).normalized())
        aim(rig, f'lowerarm_{side}', Rx(-(w + e)) @ Vector((s * out * .7, -.3, -1)).normalized())
        aim(rig, f'hand_{side}', Rx(-(w + e)) @ Vector((s * .06, -.2, -1)).normalized())
def plant(rig):
    """Lowers or raises the whole figure (Root) so the lower sole touches the ground."""
    feet = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig and 'shoes' in o.name]
    dz = -float(coords(*feet)[:, 2].min()) / rig.matrix_world.to_scale().z; root = rig.pose.bones['Root']
    root.matrix = Matrix.Translation((0, 0, dz)) @ root.matrix; bpy.context.view_layer.update()
def gait(rig, phase, out):
    rest(rig)
    for side, lag in (('l', 0.), ('r', .5)):
        p = phase + lag; h, k, a = curve(HIP, p), curve(KNEE, p), curve(ANKLE, p)
        aim(rig, f'thigh_{side}', Rx(-h) @ rest_dir(rig, f'thigh_{side}')); aim(rig, f'calf_{side}', Rx(-(h - k)) @ rest_dir(rig, f'calf_{side}'))
        aim(rig, f'foot_{side}', Rx(-(h - k + a)) @ rest_dir(rig, f'foot_{side}'))
    # Each arm swings against its own leg, the elbow bending a little more as it comes forward.
    wl, wr = -.55 * curve(HIP, phase), -.55 * curve(HIP, phase + .5)
    arms(rig, out, (wl, wr), (math.radians(8) + max(0, wl) * .6, math.radians(8) + max(0, wr) * .6))
    turn(rig, 'spine_03', Vector((0, 0, 1)), .06 * math.sin(2 * math.pi * phase)); plant(rig)
def idle(rig, t, out):
    rest(rig); w = math.radians(2) * math.sin(2 * math.pi * t); arms(rig, out, (w, -w), (math.radians(6), math.radians(6)))
    turn(rig, 'spine_03', Vector((1, 0, 0)), -math.radians(1.2) * math.sin(4 * math.pi * t))         # breathing, twice a loop
    turn(rig, 'head', Vector((0, 0, 1)), math.radians(14) * math.sin(2 * math.pi * t)); plant(rig)    # a slow look around
def work(rig, t, out):
    """Standing at a counter, a bed or a border: hands together in front at about hip height, working in small strokes,
    leaning in a little and looking down at the work."""
    rest(rig); a = math.sin(2 * math.pi * t); b = math.sin(4 * math.pi * t + 1)
    for s, w in ((1, a), (-1, b)):
        side = 'l' if s > 0 else 'r'
        aim(rig, f'upperarm_{side}', (s * .14, -.38 - .04 * w, -.92)); aim(rig, f'lowerarm_{side}', (-s * .42, -.88, -.22 + .08 * w))
        aim(rig, f'hand_{side}', (-s * .3, -.9, -.35))
    turn(rig, 'spine_02', Vector((1, 0, 0)), math.radians(7)); turn(rig, 'head', Vector((1, 0, 0)), math.radians(16) + math.radians(3) * a); plant(rig)
def sit(rig, t, out):
    """Seated: thighs level, shins upright, hands resting on the thighs; breathing and a slow look around."""
    rest(rig)
    for side in ('l', 'r'):
        h, k = math.radians(88), math.radians(90)
        aim(rig, f'thigh_{side}', Rx(-h) @ rest_dir(rig, f'thigh_{side}')); aim(rig, f'calf_{side}', Rx(-(h - k)) @ rest_dir(rig, f'calf_{side}'))
        aim(rig, f'foot_{side}', Rx(-(h - k)) @ rest_dir(rig, f'foot_{side}'))
    for s in (1, -1):
        side = 'l' if s > 0 else 'r'
        aim(rig, f'upperarm_{side}', (s * max(.12, out * .6), -.22, -.97)); aim(rig, f'lowerarm_{side}', (s * .05, -.93, -.36)); aim(rig, f'hand_{side}', (s * .03, -.85, -.53))
    turn(rig, 'spine_03', Vector((1, 0, 0)), -math.radians(1.2) * math.sin(4 * math.pi * t))
    turn(rig, 'head', Vector((0, 0, 1)), math.radians(10) * math.sin(2 * math.pi * t)); plant(rig)
def bake(rig, name, seconds, pose, step=1):
    frames = round(seconds * FPS); rig.animation_data_create(); act = bpy.data.actions.new(name); rig.animation_data.action = act
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    for f in list(range(0, frames, step)) + [frames]:
        pose(f / frames)
        for pb in rig.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=f + 1)
            if pb.name == 'Root': pb.keyframe_insert('location', frame=f + 1)
    rig.animation_data.action = None; track = rig.animation_data.nla_tracks.new(); track.name = name; track.strips.new(name, 1, act)
    return act

if RENDER:
    # The working and seated poses, from the front three-quarter; the seats are 0.45 m blocks.
    for who, rig, out in (('him', him_rig, .16), ('her', her_rig, .27)): work(rig, .25, out)
    him_rig.location.y = her_rig.location.y = 0; bpy.context.view_layer.update(); shot('work', (-3.4, -4.0, 1.4), (0, 0, .85), 50, 1100, 800)
    for who, rig, out in (('him', him_rig, .16), ('her', her_rig, .27)):
        sit(rig, .25, out); seat = bpy.data.objects.new(f'seat-{who}', bpy.data.meshes.new(f'seat-{who}')); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bm.to_mesh(seat.data); bm.free()
        seat.scale = (.55, .5, .45); seat.location = (rig.location.x, .2, .225); bpy.context.scene.collection.objects.link(seat)
    bpy.context.view_layer.update(); shot('sit', (-3.4, -4.0, 1.3), (0, 0, .65), 50, 1100, 800)
    for o in [o for o in bpy.data.objects if o.name.startswith('seat-')]: bpy.data.objects.remove(o)

if EXPORT:
    import subprocess
    bpy.context.scene.render.fps = FPS
    # The hat covers the crown, so the skin under it stays: the figure keeps its whole height.
    for md in [md for md in him_body.modifiers if md.type == 'MASK' and 'trilby' in md.name]: him_body.modifiers.remove(md)
    for who, rig, out in (('him', him_rig, .16), ('her', her_rig, .27)):
        rig.location = (0, 0, 0); rest(rig)
        bake(rig, 'walk', WALK_SECONDS, lambda p, r=rig, o=out: gait(r, p, o))
        bake(rig, 'idle', IDLE_SECONDS, lambda t, r=rig, o=out: idle(r, t, o), step=4)
        bake(rig, 'work', WORK_SECONDS, lambda t, r=rig, o=out: work(r, t, o), step=3)
        bake(rig, 'sit', SIT_SECONDS, lambda t, r=rig, o=out: sit(r, t, o), step=6)
        rest(rig)
        bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
        for c in rig.children: c.select_set(True)
        bpy.context.view_layer.objects.active = rig; raw = f'{OUT}/{who}-raw.glb'
        bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_apply=True, export_animations=True,
                                  export_animation_mode='NLA_TRACKS', export_skins=True, export_morph=False, export_yup=True, export_vertex_color='MATERIAL')
        # Compressed as the car models are: meshopt geometry, WebP textures at up to 1,024 px; no simplification.
        subprocess.run(['npx', '--yes', '@gltf-transform/cli@4.5.1', 'optimize', raw, f'{OUT}/sims-{who}.glb', '--compress', 'meshopt',
                        '--texture-compress', 'webp', '--texture-size', '1024', '--simplify', 'false', '--flatten', 'false', '--join', 'false', '--palette', 'false'], check=True)
        print('EXPORTED', who, os.path.getsize(f'{OUT}/sims-{who}.glb'), flush=True)
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/people.blend'); print('DONE', flush=True); os._exit(0)
