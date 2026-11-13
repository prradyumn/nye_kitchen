# Headless Blender: kitchen props with bevels + subdivision + PBR materials, exported as one GLB.
import bpy, bmesh, math
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene

def mat(name, col, rough=.5, metal=0., clear=0., emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if clear: b.inputs['Coat Weight'].default_value = clear; b.inputs['Coat Roughness'].default_value = .08
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = 2
    return m
def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)

M = {
  'enamel_red': mat('enamel_red', srgb('#D8432F'), .28, 0, .6),
  'brass': mat('brass', srgb('#E0A93A'), .3, 1.0),
  'copper': mat('copper', srgb('#C8703F'), .32, 1.0),
  'iron': mat('iron', srgb('#2A2C3A'), .55, .8),
  'steel': mat('steel', srgb('#C9CEDC'), .25, 1.0),
  'wood': mat('wood', srgb('#C48A55'), .62),
  'wood_dark': mat('wood_dark', srgb('#7A4A2A'), .6),
  'tomato': mat('tomato', srgb('#E33B2A'), .25, 0, .5),
  'leaf': mat('leaf', srgb('#3E9A3A'), .45),
  'cucumber': mat('cucumber', srgb('#2F7D35'), .35, 0, .3),
  'cuc_in': mat('cuc_in', srgb('#CDEBB0'), .5),
  'onion': mat('onion', srgb('#B9548F'), .3, 0, .4),
  'black_plastic': mat('black_plastic', srgb('#1E2030'), .45),
  'scooter_red': mat('scooter_red', srgb('#E2483A'), .22, 0, .8),
  'scooter_cream': mat('scooter_cream', srgb('#FFF1DA'), .35, 0, .4),
  'tyre': mat('tyre', srgb('#1A1B24'), .85),
  'chrome': mat('chrome', srgb('#DDE2EE'), .12, 1.0),
  'lamp_teal': mat('lamp_teal', srgb('#1FA898'), .35, 0, .5),
  'bulb': mat('bulb', srgb('#FFF3D0'), .2, 0, 0, emit=srgb('#FFD27A')),
  'jar_glass': mat('jar_glass', srgb('#E8F0F8'), .08, 0, .8),
  'spice_saffron': mat('spice_saffron', srgb('#F4A51C'), .7),
  'spice_red': mat('spice_red', srgb('#C2321F'), .7),
  'spice_green': mat('spice_green', srgb('#6EA640'), .7),
  'terracotta': mat('terracotta', srgb('#B9603A'), .7),
  'cream_ceramic': mat('cream_ceramic', srgb('#FFF4E2'), .2, 0, .6),
  'rice': mat('rice', srgb('#F6D58A'), .7),
}

def finish(o, bevel=.02, segs=3, sub=0, smooth=True, wn=True):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    if bevel:
        m = o.modifiers.new('bv', 'BEVEL'); m.width = bevel; m.segments = segs; m.limit_method = 'ANGLE'
    if sub:
        m = o.modifiers.new('ss', 'SUBSURF'); m.levels = sub; m.render_levels = sub
    if smooth: bpy.ops.object.shade_smooth()
    if wn:
        m = o.modifiers.new('wn', 'WEIGHTED_NORMAL'); m.keep_sharp = True
    o.select_set(False); return o

def lathe(name, prof, m, segs=48, parent=None):
    bm = bmesh.new(); verts = [bm.verts.new((r, 0, z)) for r, z in prof]
    for a, b in zip(verts, verts[1:]): bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=segs, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); S.collection.objects.link(o); o.data.materials.append(m)
    if parent: o.parent = parent
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shade_smooth(); o.select_set(False)
    return o

def prim(kind, name, m, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), parent=None, **kw):
    getattr(bpy.ops.mesh, 'primitive_' + kind + '_add')(location=loc, rotation=rot, **kw)
    o = bpy.context.active_object; o.name = name; o.scale = scale; o.data.materials.append(m)
    bpy.ops.object.transform_apply(scale=True)
    if parent: o.parent = parent
    return o

def empty(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); S.collection.objects.link(e); e.location = loc; return e

# ---------- biryani handi (pot) ----------
pot = empty('pot')
lathe('pot_body', [(0, 0), (.30, 0), (.40, .04), (.46, .16), (.47, .30), (.44, .42), (.40, .48), (.42, .52), (.44, .54), (.42, .56), (.38, .53), (.36, .50), (0, .50)], M['enamel_red'], 56, pot)
lathe('pot_band', [(.465, .26), (.475, .28), (.475, .33), (.465, .35)], M['brass'], 56, pot)
for sx in (-1, 1):
    h = prim('torus', 'pot_handle', M['brass'], loc=(sx * .5, 0, .44), rot=(math.pi / 2, 0, 0), major_radius=.075, minor_radius=.018, major_segments=24, minor_segments=10, parent=pot); bpy.ops.object.shade_smooth()
lid = lathe('pot_lid', [(0, .72), (.05, .71), (.06, .66), (.1, .64), (.25, .6), (.38, .555), (.44, .545), (.44, .53), (0, .53)], M['brass'], 48, pot)
lathe('pot_knob', [(0, .80), (.05, .79), (.065, .75), (.04, .72), (0, .72)], M['brass'], 24, pot)

# ---------- karahi (wok) ----------
kar = empty('karahi')
lathe('karahi_body', [(0, 0), (.18, .005), (.36, .06), (.48, .16), (.5, .2), (.49, .205), (.46, .17), (.34, .08), (.17, .03), (0, .025)], M['iron'], 48, kar)
for sx in (-1, 1):
    prim('torus', 'karahi_handle', M['iron'], loc=(sx * .53, 0, .2), rot=(0, 0, 0), major_radius=.07, minor_radius=.016, major_segments=20, minor_segments=8, parent=kar); bpy.ops.object.shade_smooth()
# paneer cubes in karahi
for i, (x, y) in enumerate([(-.12, -.08), (.1, -.1), (-.02, .1), (.16, .08), (-.18, .12)]):
    c = prim('cube', 'paneer', mat('paneer%d' % i, srgb('#F2B45A'), .55), loc=(x, y, .1), scale=(.06, .06, .05), rot=(0, 0, i)); finish(c, .015, 2, 0, wn=False); c.parent = kar

# ---------- stove (steel body + cast-iron grates) ----------
stove = empty('stove')
b = prim('cube', 'stove_body', M['steel'], loc=(0, 0, .08), scale=(1.8, .82, .08), parent=stove); finish(b, .03, 3)
top = prim('cube', 'stove_top', M['black_plastic'], loc=(0, 0, .165), scale=(1.76, .78, .008), parent=stove); finish(top, .006, 2)
for i, x in enumerate((-1.15, 0, 1.15)):
    lathe('burner_cap', [(0, .21), (.16, .2), (.2, .18), (.22, .17), (0, .17)], M['iron'], 32, stove).location.x = x
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        arm = prim('cube', 'grate', M['iron'], loc=(x + math.cos(ang) * .3, math.sin(ang) * .3, .24), scale=(.2, .025, .025), rot=(0, 0, ang), parent=stove); finish(arm, .01, 2, wn=False)
    ring = prim('torus', 'grate_ring', M['iron'], loc=(x, 0, .25), major_radius=.48, minor_radius=.022, major_segments=36, minor_segments=8, parent=stove); bpy.ops.object.shade_smooth()
for i in range(3):
    k = prim('cylinder', 'knob', M['chrome'], loc=(-1.15 + i * 1.15, -.82, .08), rot=(math.pi / 2, 0, 0), radius=.06, depth=.06, vertices=24, parent=stove); finish(k, .01, 2)

# ---------- cutting board + veg + knife ----------
cb = empty('board')
bd = prim('cube', 'board_slab', M['wood'], loc=(0, 0, .04), scale=(1.25, .72, .04), parent=cb); finish(bd, .03, 4)
hole = prim('cylinder', 'board_hole', M['wood_dark'], loc=(1.08, 0, .081), radius=.08, depth=.005, vertices=24, parent=cb)
def tomato(loc, r=.22):
    t = prim('uv_sphere', 'tomato', M['tomato'], loc=loc, scale=(r, r, r * .82), segments=32, ring_count=16, parent=cb); bpy.ops.object.shade_smooth()
    for a in range(5):
        l = prim('cone', 'calyx', M['leaf'], loc=(loc[0] + math.cos(a * 1.26) * .06, loc[1] + math.sin(a * 1.26) * .06, loc[2] + r * .8), rot=(math.pi / 2 - .3, 0, a * 1.26 + math.pi / 2), radius1=.03, depth=.12, vertices=6, parent=cb)
tomato((-.75, .12, .25)); tomato((-.38, .36, .22), .18)
cu = prim('cylinder', 'cucumber', M['cucumber'], loc=(.35, .2, .2), rot=(0, math.pi / 2, .35), radius=.11, depth=.9, vertices=24, parent=cb); finish(cu, .05, 4)
for i in range(4):
    s = prim('cylinder', 'cuc_slice', M['cuc_in'], loc=(.05 + i * .17, -.32, .1), rot=(.25, 0, 0), radius=.1, depth=.03, vertices=24, parent=cb); finish(s, .008, 2)
on = prim('uv_sphere', 'onion', M['onion'], loc=(.85, -.15, .24), scale=(.2, .2, .19), segments=24, ring_count=12, parent=cb); bpy.ops.object.shade_smooth()
knife = empty('knife'); knife.parent = cb; knife.location = (-.2, -.45, .1); knife.rotation_euler = (0, 0, -.25)
bl = prim('cube', 'blade', M['chrome'], loc=(.32, 0, 0), scale=(.42, .08, .006), parent=knife); finish(bl, .004, 2)
hd = prim('cube', 'handle', M['black_plastic'], loc=(-.28, 0, 0), scale=(.22, .06, .035), parent=knife); finish(hd, .02, 3)

# ---------- scooter ----------
sc = empty('scooter')
for x in (-.48, .5):
    prim('torus', 'tyre', M['tyre'], loc=(x, 0, .24), rot=(math.pi / 2, 0, 0), major_radius=.17, minor_radius=.075, major_segments=32, minor_segments=12, parent=sc); bpy.ops.object.shade_smooth()
    prim('cylinder', 'hub', M['chrome'], loc=(x, 0, .24), rot=(math.pi / 2, 0, 0), radius=.12, depth=.12, vertices=24, parent=sc)
body = prim('cube', 'body', M['scooter_red'], loc=(-.25, 0, .48), scale=(.42, .2, .16), parent=sc); finish(body, .0, 0, sub=2)
floor_ = prim('cube', 'floorboard', M['black_plastic'], loc=(.12, 0, .34), scale=(.26, .17, .03), parent=sc); finish(floor_, .02, 2)
shield = prim('cube', 'shield', M['scooter_red'], loc=(.42, 0, .62), scale=(.07, .19, .3), rot=(0, -.25, 0), parent=sc); finish(shield, .0, 0, sub=2)
fender = prim('uv_sphere', 'fender', M['scooter_red'], loc=(.5, 0, .36), scale=(.22, .12, .12), parent=sc); bpy.ops.object.shade_smooth()
stem = prim('cylinder', 'stem', M['chrome'], loc=(.5, 0, .8), rot=(0, -.25, 0), radius=.03, depth=.35, vertices=16, parent=sc)
bar = prim('cylinder', 'bar', M['black_plastic'], loc=(.54, 0, .97), rot=(math.pi / 2, 0, 0), radius=.025, depth=.6, vertices=16, parent=sc)
hl = prim('uv_sphere', 'headlight', M['bulb'], loc=(.58, 0, .92), scale=(.06, .08, .06), parent=sc); bpy.ops.object.shade_smooth()
seat = prim('cube', 'seat', M['black_plastic'], loc=(-.25, 0, .68), scale=(.3, .15, .05), parent=sc); finish(seat, .0, 0, sub=2)
crate = prim('cube', 'crate', M['scooter_cream'], loc=(-.55, 0, .9), scale=(.22, .22, .2), parent=sc); finish(crate, .04, 3)
lidc = prim('cube', 'crate_lid', M['scooter_red'], loc=(-.55, 0, 1.11), scale=(.23, .23, .02), parent=sc); finish(lidc, .015, 2)

# ---------- pendant lamp ----------
lp = empty('lamp')
lathe('lamp_shade', [(.06, .0), (.1, -.03), (.32, -.22), (.52, -.42), (.54, -.44), (.52, -.45), (.5, -.43), (.3, -.24), (.09, -.05), (.05, -.02)], M['lamp_teal'], 48, lp)
lathe('lamp_inner', [(.08, -.04), (.3, -.235), (.5, -.425)], M['brass'], 48, lp)
lathe('lamp_cap', [(0, .06), (.07, .05), (.08, 0), (0, -.01)], M['brass'], 24, lp)
b_ = prim('uv_sphere', 'lamp_bulb', M['bulb'], loc=(0, 0, -.24), scale=(.13, .13, .15), segments=24, ring_count=12, parent=lp); bpy.ops.object.shade_smooth()

# ---------- shelf set: jars + brass lota + terracotta pot ----------
sh = empty('shelfset')
for i, (x, mm) in enumerate([(-1.3, 'spice_saffron'), (-.8, 'spice_red'), (-.3, 'spice_green')]):
    j = lathe('jar', [(0, 0), (.16, 0), (.18, .02), (.18, .34), (.14, .38), (.14, .42), (0, .42)], M['jar_glass'], 32, sh); j.location.x = x
    f = lathe('jar_fill', [(0, .02), (.165, .02), (.165, .24), (0, .24)], M[mm], 32, sh); f.location.x = x
    c = lathe('jar_cap', [(0, .42), (.15, .42), (.15, .48), (0, .5)], M['wood'], 24, sh); c.location.x = x
lt = lathe('lota', [(0, 0), (.12, 0), (.2, .1), (.22, .2), (.16, .32), (.09, .38), (.1, .44), (.12, .46), (0, .46)], M['brass'], 40, sh); lt.location.x = .35
tp = lathe('matka', [(0, 0), (.14, 0), (.26, .12), (.29, .25), (.22, .4), (.13, .46), (.15, .5), (0, .5)], M['terracotta'], 40, sh); tp.location.x = 1.0
# plates stacked
for i in range(5):
    p = lathe('plate', [(0, i * .035), (.22, i * .035), (.3, i * .035 + .03), (.29, i * .035 + .035), (0, i * .035 + .01)], M['cream_ceramic'], 36, sh); p.location.x = 1.6


# ---------- utensil rail with ladles + copper pans ----------
rl = empty('rail')
r_ = prim('cylinder', 'rail_bar', M['steel'], loc=(0, 0, 0), rot=(0, math.pi / 2, 0), radius=.03, depth=4.2, vertices=16, parent=rl); finish(r_, 0, 0)
for x in (-2.05, 2.05):
    prim('cylinder', 'rail_mount', M['steel'], loc=(x, .08, 0), rot=(math.pi / 2, 0, 0), radius=.035, depth=.16, vertices=12, parent=rl)
def hook(x):
    h = prim('torus', 'hook', M['steel'], loc=(x, 0, -.06), rot=(math.pi / 2, 0, 0), major_radius=.05, minor_radius=.008, major_segments=16, minor_segments=6, parent=rl)
def ladle(x, bowl=.09, l=.6, m='steel'):
    hook(x); st = prim('cylinder', 'ladle_handle', M[m], loc=(x, 0, -.12 - l / 2), radius=.012, depth=l, vertices=10, parent=rl)
    b = prim('uv_sphere', 'ladle_bowl', M[m], loc=(x, 0, -.12 - l), scale=(bowl, bowl, bowl * .7), segments=20, ring_count=10, parent=rl); bpy.ops.object.shade_smooth()
def spatula(x):
    hook(x); prim('cylinder', 'spat_handle', M['wood_dark'], loc=(x, 0, -.4), radius=.018, depth=.5, vertices=10, parent=rl)
    p = prim('cube', 'spat_head', M['steel'], loc=(x, 0, -.74), scale=(.09, .008, .12), parent=rl); finish(p, .01, 2)
def cpan(x, r=.24):
    hook(x); pp = empty('cpan'); pp.parent = rl; pp.location = (x, 0, -.32)
    h = prim('cylinder', 'cpan_handle', M['brass'], loc=(0, 0, 0), radius=.02, depth=.32, vertices=10, parent=pp)
    body = lathe('cpan_body', [(0, 0), (r, 0), (r + .02, .02), (r + .02, .16), (r + .035, .17), (r, .17), (0, .02)], M['copper'], 40, pp)
    body.rotation_euler = (math.pi / 2, 0, 0); body.location = (0, -.02, -.16 - r)
ladle(-1.6); spatula(-1.25); ladle(-.9, .07, .5); cpan(-.35); cpan(.4, .2); ladle(.95, .1, .65, 'brass'); spatula(1.3); ladle(1.65, .06, .45)

# ---------- ticket rail (order slips) ----------
tr = empty('ticketrail')
ch = prim('cube', 'tr_channel', M['steel'], loc=(0, 0, 0), scale=(1.6, .05, .05), parent=tr); finish(ch, .015, 2)
paper = mat('paper', srgb('#FFF6E6'), .85)
for i in range(6):
    t = prim('cube', 'slip', paper, loc=(-1.3 + i * .5 + (i % 2) * .05, -.03, -.24 - (i % 3) * .03), scale=(.17, .004, .22), rot=(0, (i % 3 - 1) * .05, 0), parent=tr)
    for k in range(3): prim('cube', 'ink', mat('ink%d%d' % (i, k), srgb('#6A7091'), .9), loc=(-1.3 + i * .5 + (i % 2) * .05, -.036, -.14 - k * .07 - (i % 3) * .03), scale=(.12 - k * .025, .001, .008), parent=tr)

# ---------- apply modifiers, export ----------
for o in S.objects:
    if o.type == 'MESH':
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        for m in list(o.modifiers):
            try: bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception as e: print('mod fail', o.name, e)
        o.select_set(False)
# Blender Z-up → glTF Y-up handled by exporter
bpy.ops.export_scene.gltf(filepath='/home/claude/nyeg/game/assets/models/props.glb', export_format='GLB', export_apply=True, export_yup=True)
tris = sum(len(o.data.polygons) for o in S.objects if o.type == 'MESH')
print('EXPORTED faces', tris)
