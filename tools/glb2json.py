#!/usr/bin/env python3
"""Convert simple flat-coloured .glb models (no textures) into a compact JSON the game builds meshes from.
Usage: glb2json.py out.json name=file.glb [name=file.glb ...]"""
import base64, json, math, struct, sys

def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]

def node_matrix(n):
    if 'matrix' in n:
        m = n['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    t = n.get('translation', [0, 0, 0]); q = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[i][0] * s[0], r[i][1] * s[1], r[i][2] * s[2], t[i]] for i in range(3)] + [[0, 0, 0, 1]]

def load(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    off, j, binc = 12, None, None
    while off < len(b):
        ln, typ = struct.unpack('<II', b[off:off + 8]); chunk = b[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A: j = json.loads(chunk)
        elif typ == 0x004E4942: binc = chunk
        off += 8 + ln
    return j, binc

def accessor(j, binc, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    comps = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    fmt = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]
    size = struct.calcsize(fmt); stride = bv.get('byteStride', size * comps)
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for k in range(a['count']):
        o = start + k * stride
        out.append(struct.unpack('<' + fmt * comps, binc[o:o + size * comps]))
    return out

def convert(path):
    j, binc = load(path)
    mats = j.get('materials', [])
    parts = {}
    def walk(ni, parent):
        n = j['nodes'][ni]; m = mat_mul(parent, node_matrix(n))
        if 'mesh' in n:
            for p in j['meshes'][n['mesh']]['primitives']:
                pos = accessor(j, binc, p['attributes']['POSITION'])
                nrm = accessor(j, binc, p['attributes']['NORMAL']) if 'NORMAL' in p['attributes'] else [(0, 1, 0)] * len(pos)
                idx = [v[0] for v in accessor(j, binc, p['indices'])] if 'indices' in p else list(range(len(pos)))
                mi = p.get('material', -1); md = mats[mi] if mi >= 0 else {}
                name = md.get('name', 'default'); col = md.get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.8, 0.8, 0.8, 1])[:3]
                part = parts.setdefault(name, {'mat': name, 'color': [round(c, 4) for c in col], 'pos': [], 'nrm': [], 'idx': []})
                base = len(part['pos']) // 3
                for (x, y, z), (a, b2, c) in zip(pos, nrm):
                    part['pos'] += [m[r][0] * x + m[r][1] * y + m[r][2] * z + m[r][3] for r in range(3)]
                    nx, ny, nz = [m[r][0] * a + m[r][1] * b2 + m[r][2] * c for r in range(3)]
                    l = math.sqrt(nx * nx + ny * ny + nz * nz) or 1; part['nrm'] += [nx / l, ny / l, nz / l]
                part['idx'] += [base + i for i in idx]
        for c in n.get('children', []): walk(c, m)
    ident = [[1 if i == k else 0 for k in range(4)] for i in range(4)]
    for root in j['scenes'][j.get('scene', 0)]['nodes']: walk(root, ident)
    out = []
    for p in parts.values():
        out.append({'mat': p['mat'], 'color': p['color'],
                    'pos': base64.b64encode(struct.pack('<%df' % len(p['pos']), *p['pos'])).decode(),
                    'nrm': base64.b64encode(struct.pack('<%db' % len(p['nrm']), *[max(-127, min(127, round(v * 127))) for v in p['nrm']])).decode(),
                    'idx': base64.b64encode(struct.pack('<%dH' % len(p['idx']), *p['idx'])).decode()})
    return out

if __name__ == '__main__':
    res = {}
    for arg in sys.argv[2:]:
        name, path = arg.split('=', 1); res[name] = convert(path)
    open(sys.argv[1], 'w').write(json.dumps(res, separators=(',', ':')))
    print(sys.argv[1], sum(len(json.dumps(v)) for v in res.values()) // 1024, 'KB')
