"""
Convert an Insaniquarium Deluxe install folder into web assets.

    python3 tools/convert.py <game folder> [out folder]

Writes, under out/ (default: assets/):
  img/<name>.webp      every image with its alpha mask joined in (lossless)
  img2x/<name>.webp    the same, remastered at 2x (xBR upscale, denoised)
  font/<name>.json     PopCap bitmap fonts: glyph rects, widths, kerning
  font/<name>.webp     the font images
  sfx/<name>.ogg       every sound (.au converted)
  music/<name>.ogg     the tracker music, rendered
  cursor/<name>.png    the mouse cursors
  text.json            the game's own text, read from Insaniquarium.exe
  manifest.json        sizes of everything
Needs Pillow, NumPy and ffmpeg (with libopenmpt for the music).
--text-only redoes just text.json; --skip-sound keeps the converted sounds.
"""
import hashlib, json, os, re, subprocess, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else os.path.join(os.path.dirname(__file__), '..', 'assets')
IMG = os.path.join(SRC, 'images')


def find(folder, name):
    low = name.lower()
    for f in os.listdir(folder):
        if f.lower() == low:
            return os.path.join(folder, f)
    return None


def pick(folder, base, exts=('.gif', '.jpg', '.png')):
    for e in exts:
        p = find(folder, base + e)
        if p:
            return p
    return None


def load(folder, base, alpha=None):
    """Colour image plus its mask: alphaimage, else _base or base_."""
    colour = pick(folder, base)
    names = [alpha] if alpha else ['_' + base, base + '_']
    mask = None
    for n in names:
        mask = pick(folder, n)
        if mask:
            break
    if colour is None and mask is not None:
        # Alpha-only image (fonts): white, shaped by the mask.
        m = Image.open(mask).convert('L')
        im = Image.new('RGBA', m.size, (255, 255, 255, 255))
        im.putalpha(m)
        return im
    if colour is None:
        return None
    raw = Image.open(colour)
    im = raw.convert('RGBA')
    if mask is not None:
        m = Image.open(mask).convert('L')
        if m.size != im.size:
            m = m.resize(im.size)
        im.putalpha(m)
    return im


def ff(arr, vf):
    """Run an ffmpeg video filter over one RGB image (numpy HxWx3 uint8)."""
    h, w, _ = arr.shape
    out = subprocess.run(
        ['ffmpeg', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-i', '-', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        input=arr.tobytes(), capture_output=True, check=True).stdout
    k = int((len(out) // 3 / (w * h)) ** 0.5 + 0.5)
    return np.frombuffer(out, np.uint8).reshape(h * k, w * k, 3)


def fill_transparent(rgb, a):
    """Spread edge colours into transparent pixels so upscaling leaves no dark fringe."""
    rgb = rgb.astype(np.float32)
    w = (a > 8).astype(np.float32)
    acc = rgb * w[..., None]
    wt = w.copy()
    for _ in range(6):
        # Grow by averaging neighbours, keeping known pixels.
        pa = np.pad(acc, ((1, 1), (1, 1), (0, 0)), mode='edge')
        pw = np.pad(wt, ((1, 1), (1, 1)), mode='edge')
        sa = sum(pa[1 + dy:pa.shape[0] - 1 + dy, 1 + dx:pa.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        sw = sum(pw[1 + dy:pw.shape[0] - 1 + dy, 1 + dx:pw.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        known = wt > 0
        acc = np.where(known[..., None], acc, sa)
        wt = np.where(known, wt, sw)
    out = np.where(wt[..., None] > 0, acc / np.maximum(wt, 1e-6)[..., None], rgb)
    return np.clip(out, 0, 255).astype(np.uint8)


def enhance(im, photo=False):
    """
    2x remaster: xBR at 4x (crisp, clean outlines), then a smooth Lanczos
    step down to 2x. Painted backgrounds get JPEG noise removed first.
    Transparency is scaled the same way, separately.
    """
    w, h = im.size
    arr = np.asarray(im.convert('RGBA'))
    rgb, a = arr[..., :3], arr[..., 3]
    opaque = a.min() == 255
    if photo:
        rgb = ff(np.ascontiguousarray(rgb), 'nlmeans=s=2.5:p=5:r=11')
    if not opaque:
        rgb = fill_transparent(rgb, a)
    big = Image.fromarray(ff(np.ascontiguousarray(rgb), 'xbr=4')).resize((w * 2, h * 2), Image.LANCZOS)
    big = big.filter(ImageFilter.UnsharpMask(radius=1.0, percent=40, threshold=1))
    if opaque:
        return big.convert('RGBA')
    a3 = np.ascontiguousarray(np.dstack([a, a, a]))
    ba = Image.fromarray(ff(a3, 'xbr=4')[..., 0]).resize((w * 2, h * 2), Image.LANCZOS)
    big.putalpha(ba)
    return big


def save(im, path, lossless=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    opaque = im.getextrema()[3][0] == 255
    if opaque:
        im.convert('RGB').save(path, 'WEBP', quality=92, method=4)
    else:
        im.save(path, 'WEBP', lossless=lossless, quality=60 if lossless else 92, method=2 if lossless else 4)


def images(manifest):
    xml = open(os.path.join(SRC, 'properties', 'resources.xml'), encoding='latin-1').read()
    explicit = {}
    for m in re.finditer(r'<Image\s+id="([^"]+)"([^/]*)/>', xml):
        attrs = dict(re.findall(r'(\w+)="?([^"\s>]+)"?', m.group(2)))
        explicit[attrs['path'].lower()] = attrs.get('alphaimage') or attrs.get('alphagrid')
    seen = set()
    jobs = []
    for f in sorted(os.listdir(IMG)):
        base, ext = os.path.splitext(f)
        if ext.lower() not in ('.gif', '.jpg', '.png'):
            continue
        b = base.lower()
        if b.startswith('_') or b.endswith('_'):
            core = b.strip('_')
            if pick(IMG, core):
                continue  # a mask, used with its colour image
            b = core  # alpha-only image
        if b in seen:
            continue
        seen.add(b)
        jobs.append((b, explicit.get(b)))
    with Pool(4) as pool:
        for b, size in pool.imap_unordered(one_image, jobs):
            if size:
                manifest['img'][b] = size
                print('img', b, size, flush=True)


def one_image(job):
    b, alpha = job
    im = load(IMG, b, alpha)
    if im is None:
        return b, None
    save(im, os.path.join(OUT, 'img', b + '.webp'))
    photo = im.size[0] >= 600 and im.getextrema()[3][0] == 255
    save(enhance(im, photo), os.path.join(OUT, 'img2x', b + '.webp'), lossless=False)
    return b, list(im.size)


def tokens(text):
    i = 0
    out = []
    while i < len(text):
        c = text[i]
        if c.isspace() or c == ',':
            i += 1
        elif c in '();':
            out.append(c)
            i += 1
        elif c in "'\"":
            j = text.index(c, i + 1)
            out.append(('s', text[i + 1:j]))
            i = j + 1
        else:
            j = i
            while j < len(text) and not text[j].isspace() and text[j] not in '(),;':
                j += 1
            w = text[i:j]
            out.append(int(w) if re.fullmatch(r'-?\d+', w) else w)
            i = j
    return out


def parse_list(tk, i):
    assert tk[i] == '('
    i += 1
    items = []
    while tk[i] != ')':
        if tk[i] == '(':
            sub, i = parse_list(tk, i)
            items.append(sub)
        else:
            v = tk[i]
            items.append(v[1] if isinstance(v, tuple) else v)
            i += 1
    return items, i + 1


def font(path, manifest):
    text = open(path, encoding='latin-1').read()
    tk = tokens(text)
    defs, cmds = {}, []
    i = 0
    while i < len(tk):
        t = tk[i]
        if t == 'Define':
            name = tk[i + 1]
            val, i = parse_list(tk, i + 2) if tk[i + 2] == '(' else (tk[i + 2], i + 3)
            defs[name] = val
        elif isinstance(t, str) and t not in (';',):
            args = []
            i += 1
            while tk[i] != ';':
                if tk[i] == '(':
                    v, i = parse_list(tk, i)
                    args.append(v)
                else:
                    v = tk[i]
                    args.append(v[1] if isinstance(v, tuple) else v)
                    i += 1
            cmds.append((t, args))
        i += 1
    ref = lambda a: defs.get(a, a) if isinstance(a, str) else a
    layers = {}
    for cmd, args in cmds:
        if cmd == 'CreateLayer':
            layers[args[0]] = {'chars': {}, 'kern': {}}
            continue
        if not cmd.startswith('Layer'):
            continue
        L = layers[args[0]]
        if cmd == 'LayerSetImage':
            L['image'] = args[1]
        elif cmd == 'LayerSetCharWidths':
            for ch, w in zip(ref(args[1]), ref(args[2])):
                L['chars'].setdefault(ch, {})['w'] = w
        elif cmd == 'LayerSetImageMap':
            for ch, r in zip(ref(args[1]), ref(args[2])):
                L['chars'].setdefault(ch, {})['r'] = r
        elif cmd == 'LayerSetCharOffsets':
            for ch, o in zip(ref(args[1]), ref(args[2])):
                L['chars'].setdefault(ch, {})['o'] = o
        elif cmd == 'LayerSetKerningPairs':
            for p, v in zip(ref(args[1]), ref(args[2])):
                L['kern'][p] = v
        else:
            L[cmd[len('LayerSet'):].lower()] = args[1] if len(args) == 2 else args[1:]
    name = os.path.splitext(os.path.basename(path))[0].lower()
    for L in layers.values():
        if 'image' in L:
            img_base = L['image'].lower()
            im = load(os.path.dirname(path), img_base)
            if im is not None:
                # Fonts are stored at 2x (sharper when the game is scaled up).
                save(enhance(im), os.path.join(OUT, 'font', img_base + '.webp'), lossless=True)
                L['image'] = img_base
                L['scale'] = 2
    os.makedirs(os.path.join(OUT, 'font'), exist_ok=True)
    json.dump({'layers': layers}, open(os.path.join(OUT, 'font', name + '.json'), 'w'), ensure_ascii=False)
    manifest['font'].append(name)
    print('font', name, flush=True)


def ffmpeg(src, dst, extra=()):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, *extra, '-c:a', 'libvorbis', '-q:a', '5', dst], check=True)


def sounds(manifest):
    folder = os.path.join(SRC, 'sounds')
    for f in sorted(os.listdir(folder)):
        base, ext = os.path.splitext(f)
        if ext.lower() not in ('.ogg', '.au', '.wav'):
            continue
        dst = os.path.join(OUT, 'sfx', base.lower() + '.ogg')
        if ext.lower() == '.ogg':
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            open(dst, 'wb').write(open(os.path.join(folder, f), 'rb').read())
        else:
            ffmpeg(os.path.join(folder, f), dst, ['-ar', '22050'])
        manifest['sfx'].append(base.lower())
    folder = os.path.join(SRC, 'music')
    for f in sorted(os.listdir(folder)):
        base, ext = os.path.splitext(f)
        ffmpeg(os.path.join(folder, f), os.path.join(OUT, 'music', base.lower() + '.ogg'))
        manifest['music'].append(base.lower())
        print('music', base, flush=True)


def cursors(manifest):
    """The game's own cursors as PNGs with their click point, for CSS cursors."""
    out = {}
    for name in ('cursor_pointer', 'cursor_hand', 'cursor_dragging'):
        im = load(IMG, name)
        if im is None:
            continue
        a = np.asarray(im)[..., 3]
        ys, xs = np.nonzero(a > 128)
        if name == 'cursor_pointer':
            k = np.argmin(xs + ys)  # the arrow tip: top-left-most pixel
        else:
            k = np.argmin(ys * 1000 + xs)  # the fingertip: topmost pixel
        os.makedirs(os.path.join(OUT, 'cursor'), exist_ok=True)
        im.save(os.path.join(OUT, 'cursor', name + '.png'))
        out[name] = [int(xs[k]), int(ys[k])]
    manifest['cursor'] = out


def text():
    """The game's own words (help, hints, pet descriptions), read out of the
    program at the places listed in tools/strings.json."""
    spec = json.load(open(os.path.join(os.path.dirname(__file__), 'strings.json')))
    exe = open(find(SRC, 'Insaniquarium.exe'), 'rb').read()
    if len(exe) != spec['exe']['size'] or hashlib.sha1(exe).hexdigest() != spec['exe']['sha1']:
        print('warning: this Insaniquarium.exe is not the v1.1 the text was mapped from', flush=True)
    out = {}
    for key, pieces in spec['text'].items():
        words = [exe[o:o + n].decode('latin-1') for o, n in pieces]
        out[key] = re.sub(r' *\n *', ' ', ' '.join(words))
    json.dump(out, open(os.path.join(OUT, 'text.json'), 'w'), indent=1)
    print('text', len(out), flush=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    text()
    if '--text-only' in sys.argv:
        return
    manifest = {'img': {}, 'font': [], 'sfx': [], 'music': []}
    cursors(manifest)
    if '--skip-sound' not in sys.argv:
        sounds(manifest)
    else:
        manifest['sfx'] = sorted(os.path.splitext(f)[0] for f in os.listdir(os.path.join(OUT, 'sfx')))
        manifest['music'] = sorted(os.path.splitext(f)[0] for f in os.listdir(os.path.join(OUT, 'music')))
    for f in sorted(os.listdir(os.path.join(SRC, 'data'))):
        if f.lower().endswith('.txt'):
            font(os.path.join(SRC, 'data', f), manifest)
    images(manifest)
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
