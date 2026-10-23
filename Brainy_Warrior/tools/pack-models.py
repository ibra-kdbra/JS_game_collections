#!/usr/bin/env python3
"""Pack the Quaternius characters into small, single-draw-call GLB files.

Run once by hand when the models change (needs Python 3 with numpy and Pillow,
and gltfpack from meshoptimizer, https://github.com/zeux/meshoptimizer, built
with `make gltfpack`):

    GLTFPACK=/path/to/gltfpack python3 Brainy_Warrior/tools/pack-models.py \
        <RPG Characters glTF dir> <Ultimate Monsters Big glTF dir>

The sources are Quaternius' CC0 packs "RPG Characters - Nov 2020" and "Ultimate
Monsters" (glTF exports). The output goes to Brainy_Warrior/models/. For every
character it:

  * merges all of its meshes into one skinned mesh with one material. Props
    that the source attaches to a bone (face, shoulder pads, sword, staff) are
    turned into skinned vertices bound 100% to that bone, and their textures
    are packed into one atlas, so a character costs one draw call;
  * drops the scene nodes that are not bones;
  * keeps only the animation clips the game plays, removes keyframes that
    linear interpolation already reproduces, and stores rotations as
    normalised 16-bit integers (allowed by core glTF 2.0);
  * stores normals as 8-bit, UVs as 16-bit, joints as 8-bit and weights as
    8-bit integers (KHR_mesh_quantization, supported by three.js GLTFLoader);
  * downsizes textures (JPEG for painted textures, PNG for flat palettes);
  * then runs gltfpack to simplify the mesh (fewer triangles where the
    character is small on screen), quantise it (KHR_mesh_quantization) and
    compress geometry and animation (EXT_meshopt_compression; the game decodes
    it with vendor/meshoptimizer/meshopt_decoder.mjs). Without GLTFPACK set,
    it writes the uncompressed, unsimplified files with its own quantisation.
"""
import base64
import io
import json
import os
import struct
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'models')

NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
DTYPE = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
CTYPE = {np.dtype(v): k for k, v in DTYPE.items()}


class Src:
    def __init__(self, path):
        self.g = json.load(open(path))
        self.dir = os.path.dirname(path)
        self.bufs = []
        for b in self.g['buffers']:
            uri = b['uri']
            if uri.startswith('data:'):
                self.bufs.append(base64.b64decode(uri.split(',', 1)[1]))
            else:
                self.bufs.append(open(os.path.join(self.dir, uri), 'rb').read())

    def view(self, i):
        bv = self.g['bufferViews'][i]
        o = bv.get('byteOffset', 0)
        return self.bufs[bv['buffer']][o:o + bv['byteLength']], bv.get('byteStride')

    def acc(self, i):
        a = self.g['accessors'][i]
        n = NCOMP[a['type']]
        dt = np.dtype(DTYPE[a['componentType']])
        data, stride = self.view(a['bufferView'])
        off = a.get('byteOffset', 0)
        if stride and stride != n * dt.itemsize:
            rows = [np.frombuffer(data, dt, n, off + k * stride) for k in range(a['count'])]
            arr = np.array(rows)
        else:
            arr = np.frombuffer(data, dt, a['count'] * n, off).reshape(a['count'], n)
        arr = arr.astype(np.float64) if dt == np.float32 else arr.copy()
        if a.get('normalized'):
            arr = arr / float(np.iinfo(dt).max)
        return arr

    def image(self, i):
        im = self.g['images'][i]
        if 'bufferView' in im:
            data, _ = self.view(im['bufferView'])
        elif im['uri'].startswith('data:'):
            data = base64.b64decode(im['uri'].split(',', 1)[1])
        else:
            data = open(os.path.join(self.dir, im['uri']), 'rb').read()
        return Image.open(io.BytesIO(data)).convert('RGB')


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def local_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    m = np.eye(4)
    s = np.array(n.get('scale', [1, 1, 1]))
    m[:3, :3] = quat_to_mat(n.get('rotation', [0, 0, 0, 1])) * s
    m[:3, 3] = n.get('translation', [0, 0, 0])
    return m


def reduce_keys(times, values, eps, is_quat=False):
    """Drop keys that linear interpolation between their neighbours reproduces."""
    keep = [0]
    for k in range(1, len(times) - 1):
        a = keep[-1]
        b = k + 1
        t = (times[k] - times[a]) / max(1e-9, times[b] - times[a])
        guess = values[a] * (1 - t) + values[b] * t
        if is_quat:
            if np.dot(values[a], values[b]) < 0:
                guess = values[a] * (1 - t) - values[b] * t
            guess /= max(1e-9, np.linalg.norm(guess))
            err = 1 - abs(np.dot(guess, values[k]))
            if err > eps * 0.01:
                keep.append(k)
        elif np.max(np.abs(guess - values[k])) > eps:
            keep.append(k)
    keep.append(len(times) - 1)
    if len(times) > 1 and all(np.allclose(values[i], values[0], atol=1e-5) for i in range(len(times))):
        keep = [0, len(times) - 1]
    return times[keep], values[keep]


class Out:
    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []
        # Animation data shares one buffer view, and identical arrays (most
        # channels of a clip share their key times) share one accessor.
        self.shared = bytearray()
        self.shared_view = None
        self.seen = {}

    def shared_accessor(self, arr, typ, normalized=False, minmax=False):
        flat = np.ascontiguousarray(arr).reshape(-1, NCOMP[typ])
        data = flat.tobytes()
        key = (data, typ, str(flat.dtype), normalized)
        if key in self.seen:
            return self.seen[key]
        if self.shared_view is None:
            self.views.append(None)
            self.shared_view = len(self.views) - 1
        while len(self.shared) % 4:
            self.shared.append(0)
        a = {'bufferView': self.shared_view, 'byteOffset': len(self.shared), 'componentType': CTYPE[flat.dtype],
             'count': len(flat), 'type': typ}
        self.shared += data
        if normalized:
            a['normalized'] = True
        if minmax:
            a['min'] = [round(float(v), 5) for v in flat.min(0)]
            a['max'] = [round(float(v), 5) for v in flat.max(0)]
        self.accessors.append(a)
        self.seen[key] = len(self.accessors) - 1
        return self.seen[key]

    def finish(self):
        if self.shared_view is not None:
            while len(self.bin) % 4:
                self.bin.append(0)
            self.views[self.shared_view] = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(self.shared)}
            self.bin += self.shared

    def blob(self, data, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target:
            v['target'] = target
        self.bin += data
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, arr, typ, normalized=False, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        n = NCOMP[typ]
        flat = arr.reshape(-1, n)
        data = flat.tobytes()
        # Vertex attributes must have 4-byte aligned elements: pad each row.
        el = flat.dtype.itemsize * n
        stride = None
        if target == 34962 and el % 4:
            pad = 4 - el % 4
            rows = np.zeros((len(flat), el + pad), np.uint8)
            rows[:, :el] = flat.view(np.uint8).reshape(len(flat), el)
            data = rows.tobytes()
            stride = el + pad
        bv = self.blob(data, target)
        if stride:
            self.views[bv]['byteStride'] = stride
        a = {'bufferView': bv, 'componentType': CTYPE[flat.dtype], 'count': len(flat), 'type': typ}
        if normalized:
            a['normalized'] = True
        if minmax:
            a['min'] = [float(v) for v in flat.min(0)]
            a['max'] = [float(v) for v in flat.max(0)]
        self.accessors.append(a)
        return len(self.accessors) - 1


def pack(src_path, out_name, clips, tex_size=512, prop_tex=256, palette=False, eps=0.0015, simplify=1.0):
    gltfpack = os.environ.get('GLTFPACK')
    s = Src(src_path)
    g = s.g
    skin = g['skins'][0]
    joints = skin['joints']
    joint_index = {j: k for k, j in enumerate(joints)}
    ibm = s.acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    parent = {}
    for i, n in enumerate(g['nodes']):
        for c in n.get('children', []):
            parent[c] = i

    # --- textures -> one atlas (each source image becomes one tile in a row)
    mats = g['materials']
    tiles = []
    for m in mats:
        img = s.image(g['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'])
        size = tex_size if not tiles else prop_tex
        img = img.resize((size, size), Image.NEAREST if palette else Image.LANCZOS)
        tiles.append(img)
    W = sum(t.size[0] for t in tiles)
    H = max(t.size[1] for t in tiles)
    atlas = Image.new('RGB', (W, H))
    x0 = []
    x = 0
    for t in tiles:
        atlas.paste(t, (x, 0))
        x0.append(x)
        x += t.size[0]

    # --- merge every mesh into one skinned primitive
    P, N, UV, J, WT, IDX = [], [], [], [], [], []
    base = 0
    for ni, n in enumerate(g['nodes']):
        if 'mesh' not in n:
            continue
        if 'skin' in n:
            xf = None
        else:
            # A prop under a bone: bind it rigidly to the nearest ancestor bone.
            chain = [ni]
            b = parent.get(ni)
            while b is not None and b not in joint_index:
                chain.append(b)
                b = parent.get(b)
            assert b is not None, f'{n.get("name")} is not under a bone'
            L = np.eye(4)
            for c in reversed(chain):
                L = L @ local_matrix(g['nodes'][c])
            xf = np.linalg.inv(ibm[joint_index[b]]) @ L
            bone = joint_index[b]
        for p in g['meshes'][n['mesh']]['primitives']:
            at = p['attributes']
            pos = s.acc(at['POSITION'])
            nor = s.acc(at['NORMAL'])
            uv = s.acc(at['TEXCOORD_0'])
            mi = p.get('material', 0)
            tw = tiles[mi].size[0]
            uv = np.stack([(uv[:, 0].clip(0, 1) * tw + x0[mi]) / W, uv[:, 1].clip(0, 1) * tiles[mi].size[1] / H], 1)
            if xf is None:
                jj = s.acc(at['JOINTS_0']).astype(np.int64)
                ww = s.acc(at['WEIGHTS_0'])
            else:
                pos = (np.c_[pos, np.ones(len(pos))] @ xf.T)[:, :3]
                nm = np.linalg.inv(xf[:3, :3]).T
                nor = nor @ nm.T
                jj = np.zeros((len(pos), 4), np.int64)
                jj[:, 0] = bone
                ww = np.zeros((len(pos), 4))
                ww[:, 0] = 1
            nor /= np.linalg.norm(nor, axis=1, keepdims=True).clip(1e-9)
            idx = s.acc(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(pos))
            P.append(pos)
            N.append(nor)
            UV.append(uv)
            J.append(jj)
            WT.append(ww)
            IDX.append(idx + base)
            base += len(pos)
    P, N, UV, J, WT, IDX = (np.concatenate(a) for a in (P, N, UV, J, WT, IDX))
    # Quantise weights to bytes that still sum to 255.
    WT = WT / WT.sum(1, keepdims=True).clip(1e-9)
    wq = np.floor(WT * 255).astype(np.int64)
    rem = 255 - wq.sum(1)
    wq[np.arange(len(wq)), WT.argmax(1)] += rem
    o = Out()
    if gltfpack:
        # Full precision in, gltfpack quantises after simplifying.
        attrs = {
            'POSITION': o.accessor(P.astype(np.float32), 'VEC3', target=34962, minmax=True),
            'NORMAL': o.accessor(N.astype(np.float32), 'VEC3', target=34962),
            'TEXCOORD_0': o.accessor(UV.astype(np.float32), 'VEC2', target=34962),
            'JOINTS_0': o.accessor(J.astype(np.uint8), 'VEC4', target=34962),
            'WEIGHTS_0': o.accessor((wq / 255).astype(np.float32), 'VEC4', target=34962),
        }
    else:
        attrs = {
            'POSITION': o.accessor(P.astype(np.float32), 'VEC3', target=34962, minmax=True),
            'NORMAL': o.accessor(np.round(N * 127).astype(np.int8), 'VEC3', normalized=True, target=34962),
            'TEXCOORD_0': o.accessor(np.round(UV * 65535).astype(np.uint16), 'VEC2', normalized=True, target=34962),
            'JOINTS_0': o.accessor(J.astype(np.uint8), 'VEC4', target=34962),
            'WEIGHTS_0': o.accessor(wq.astype(np.uint8), 'VEC4', normalized=True, target=34962),
        }
    ind = o.accessor(IDX.astype(np.uint16 if base < 65536 else np.uint32), 'SCALAR', target=34963)

    # --- keep only bones (and their ancestors); reindex
    keep = set()
    for j in joints:
        while j is not None:
            keep.add(j)
            j = parent.get(j)
    roots = [r for r in g['scenes'][0]['nodes'] if r in keep]
    order = sorted(keep)
    remap = {old: k for k, old in enumerate(order)}
    nodes = []
    for old in order:
        n = {k: v for k, v in g['nodes'][old].items() if k in ('name', 'translation', 'rotation', 'scale', 'matrix')}
        ch = [remap[c] for c in g['nodes'][old].get('children', []) if c in keep]
        if ch:
            n['children'] = ch
        nodes.append(n)
    mesh_node = len(nodes)
    nodes.append({'name': out_name, 'mesh': 0, 'skin': 0})
    arm = remap[roots[0]]
    nodes[arm].setdefault('children', []).append(mesh_node)

    skin_out = {
        'joints': [remap[j] for j in joints],
        'inverseBindMatrices': o.accessor(ibm.transpose(0, 2, 1).reshape(-1, 16).astype(np.float32), 'MAT4'),
    }
    if 'skeleton' in skin:
        skin_out['skeleton'] = remap[skin['skeleton']]

    # --- animations
    anims = []
    by_name = {a['name']: a for a in g['animations']}
    # A channel that holds the bone at its rest value in every kept clip never
    # moves anything: drop it everywhere (it can't leave a stale pose behind).
    def rest(node, path):
        n = g['nodes'][node]
        return np.array(n.get(path, {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}[path]))

    moving = set()
    for src_name in clips:
        a = by_name[src_name]
        for ch in a['channels']:
            key = (ch['target']['node'], ch['target']['path'])
            v = s.acc(a['samplers'][ch['sampler']]['output'])
            r = rest(*key)
            if key[1] == 'rotation':
                still = np.all(np.abs(np.abs(v @ r) - 1) < 1e-5)
            else:
                still = np.allclose(v, r, atol=1e-4)
            if not still:
                moving.add(key)
    for src_name, dst_name in clips.items():
        a = by_name[src_name]
        channels, samplers = [], []
        for ch in a['channels']:
            node = ch['target']['node']
            if node not in keep or (node, ch['target']['path']) not in moving:
                continue
            sm = a['samplers'][ch['sampler']]
            path = ch['target']['path']
            t = s.acc(sm['input']).reshape(-1)
            v = s.acc(sm['output'])
            if sm.get('interpolation', 'LINEAR') == 'LINEAR':
                t, v = reduce_keys(t, v, eps, is_quat=(path == 'rotation'))
            ti = o.shared_accessor(t.astype(np.float32), 'SCALAR', minmax=True)
            if path == 'rotation':
                v = v / np.linalg.norm(v, axis=1, keepdims=True).clip(1e-9)
                vi = o.shared_accessor(np.round(v * 32767).astype(np.int16), 'VEC4', normalized=True)
            else:
                vi = o.shared_accessor(v.astype(np.float32), 'VEC3')
            samplers.append({'input': ti, 'output': vi, 'interpolation': sm.get('interpolation', 'LINEAR')})
            channels.append({'sampler': len(samplers) - 1, 'target': {'node': remap[node], 'path': path}})
        anims.append({'name': dst_name, 'channels': channels, 'samplers': samplers})

    # --- image
    bio = io.BytesIO()
    if palette:
        atlas.save(bio, 'PNG', optimize=True)
        mime = 'image/png'
    else:
        atlas.save(bio, 'JPEG', quality=86, optimize=True, progressive=False)
        mime = 'image/jpeg'
    img_view = o.blob(bio.getvalue())
    o.finish()

    gltf = {
        'asset': {'version': '2.0', 'generator': 'Brainy Warrior pack-models.py', 'copyright': 'Quaternius (CC0 1.0)'},
        **({} if gltfpack else {'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization']}),
        'scene': 0,
        'scenes': [{'nodes': [remap[r] for r in roots]}],
        'nodes': nodes,
        'meshes': [{'name': out_name, 'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0}]}],
        'materials': [{
            'name': out_name,
            'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.8},
        }],
        'textures': [{'sampler': 0, 'source': 0}],
        'samplers': [{'magFilter': 9728 if palette else 9729, 'minFilter': 9728 if palette else 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': img_view, 'mimeType': mime}],
        'skins': [skin_out],
        **({'animations': anims} if anims else {}),
        'accessors': o.accessors,
        'bufferViews': o.views,
        'buffers': [{'byteLength': len(o.bin)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    while len(o.bin) % 4:
        o.bin.append(0)
    total = 12 + 8 + len(js) + 8 + len(o.bin)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, out_name + '.glb')
    raw = os.path.join(tempfile.mkdtemp(), out_name + '.glb') if gltfpack else path
    with open(raw, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(o.bin), 0x004E4942) + bytes(o.bin))
    tris = len(IDX) // 3
    if gltfpack:
        # -si: simplify to this share of triangles; -cc: meshopt compression;
        # -kn: keep node names (the clips find bones by name).
        out = subprocess.run([gltfpack, '-i', raw, '-o', path, '-si', str(simplify), '-cc', '-kn', '-v'],
                             check=True, capture_output=True, text=True).stdout
        line = [l for l in out.splitlines() if l.startswith('output: 1 mesh primitives')]
        if line:
            tris = int(line[0].split('(')[1].split()[0])
    print(f'{path}: {os.path.getsize(path) / 1024:.0f} KB, {tris} triangles, {len(joints)} bones, '
          f'texture {W}x{H} {mime}, clips {", ".join(clips.values())}')


def main():
    rpg, monsters = sys.argv[1], sys.argv[2]
    pack(os.path.join(rpg, 'Warrior.gltf'), 'warrior', {
        'Idle_Weapon': 'idle', 'Run_Weapon': 'run', 'Sword_Attack': 'attack', 'Sword_Attack2': 'attack2', 'Death': 'fall',
    }, simplify=0.6)
    pack(os.path.join(rpg, 'Wizard.gltf'), 'wizard', {'Idle': 'idle', 'Idle_Attacking': 'cast'}, simplify=0.6)
    monster_clips = {'Idle': 'idle', 'Death': 'death', 'Wave': 'taunt', 'Yes': 'cheer'}
    # The three monsters share one skeleton, so only orc.glb carries the clips;
    # the game plays them on the other two by bone name.
    for name, out, clips in (('Orc', 'orc', monster_clips), ('Orc_Skull', 'orc-skull', {}), ('Tribal', 'tribal', {})):
        pack(os.path.join(monsters, name + '.gltf'), out, clips, tex_size=128, palette=True, simplify=0.45)


if __name__ == '__main__':
    main()
