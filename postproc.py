#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Combustor post-process aracı v3 (yalnızca Python standart kütüphanesi).
Geliştiren: Muhammed Emin URAL

  py postproc.py                      -> arayüzü açar (http://127.0.0.1:8765). Her şey arayüzden yapılır.
  py postproc.py --root D:\\analizler  -> analizlerin bulunduğu klasörü ver (bir kez yeter, hatırlanır)
  py postproc.py build                -> root içine tek dosyalık dashboard.html üretir (paylaşmak için)
  py postproc.py diag [analiz-1]      -> dosya yapısını sayılar maskelenmiş olarak yazar (dışarıya yapıştırılabilir)

Dosya adlarına bağımlı değildir: analiz klasörlerindeki tüm metin dosyalarını içeriğine göre tanır
(Fluent yüzey raporları, XY/circ-avg dosyaları, report-definition .out dosyaları, sütunlu tablolar).
Hangi değerin ne olduğu (Pt giriş, swirler debisi, RTDF profili ...) arayüzde seçilir ve
<root>/postproc_eslesme.json dosyasına kaydedilir.
"""
import sys, os, re, json, math, argparse, time, hashlib, webbrowser, mimetypes, threading
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = Path(__file__).resolve().parent
VERSION = '3.1'
AUTHOR = 'Muhammed Emin URAL'
SCAN_VER = 3                       # ayrıştırıcı değişirse önbelleği geçersiz kılmak için artır
LOCAL = HERE / 'postproc_local.json'   # makineye özel (root, port); repoda yok
MAP_NAME = 'postproc_eslesme.json'
DEFAULT_MAP = HERE / 'postproc_eslesme_varsayilan.json'   # son kaydedilen eşleme: yeni klasörlerde başlangıç
CACHE_DIR = '.postproc_cache'
SHARE_DIR = '_paylasim'              # paylaşım HTML'leri ("_" ile başladığı için analiz sayılmaz)
UI_FILES = ['core.js', 'charts.js', 'views.js', 'gallery.js', 'mapping.js', 'notes.js', 'export.js', 'main.js']
BACKUP_KEEP = 30                   # eşleme dosyasının saklanan eski kopyası (ek özellik; 0 = kapalı)
MAX_TEXT = 30 * 1024 * 1024        # bundan büyük metin dosyaları atlanır
MAX_PTS = 600                      # gömülen seri başına nokta
IMG_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.bmp', '.webp'}
SKIP_EXT = {'.cas', '.dat', '.h5', '.cdat', '.msh', '.zip', '.gz', '.7z', '.rar', '.tar', '.pdf', '.exe', '.dll',
            '.avi', '.mp4', '.mpg', '.mov', '.tif', '.tiff', '.pyc', '.xlsx', '.xls', '.docx', '.pptx', '.ip',
            '.cxa', '.sdat', '.cff', '.bin', '.lic', '.jou_bak', '.trn'}

# ----------------------------------------------------------------------------
# Yardımcılar
# ----------------------------------------------------------------------------
DASH = re.compile(r'^\s*-{4,}[\s-]*$')
NUM = r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?'
ROW = re.compile(r'^\s*(.+?)\s+(' + NUM + r')\s*$')
UNIT = re.compile(r'\(([^)]*)\)\s*$')
KIND_WORDS = ('average', 'integral', 'maximum', 'minimum', 'sum', 'flux', 'flow rate', 'weighted')


def natural_key(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]


def norm(s):
    return re.sub(r'\s+', ' ', str(s or '').strip().lower())


def decode(raw):
    for enc in ('utf-8-sig', 'cp1254', 'latin-1'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return ''


def read_json(p, default=None):
    try:
        return json.loads(decode(Path(p).read_bytes()))
    except (OSError, ValueError):
        return default


def write_json(p, obj):
    p = Path(p)
    tmp = p.with_suffix(p.suffix + '.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding='utf-8')
    os.replace(tmp, p)


def finite(v):
    return v is not None and not (isinstance(v, float) and (math.isnan(v) or math.isinf(v)))


def downsample(x, y, maxn=MAX_PTS):
    if len(x) <= maxn:
        return x, y
    step = len(x) / maxn
    idx = sorted({int(i * step) for i in range(maxn)} | {len(x) - 1})
    return [x[i] for i in idx], [y[i] for i in idx]


# ----------------------------------------------------------------------------
# Ayrıştırıcılar (içerik tabanlı; dosya adına bakmaz)
# ----------------------------------------------------------------------------
def norm_kind(text):
    t = text.lower()
    if 'mass-weighted' in t or 'mass weighted' in t:
        return 'mwa'
    if 'area-weighted' in t or 'area weighted' in t:
        return 'awa'
    if 'mass flow' in t:
        return 'mfr'
    if 'maximum' in t:
        return 'max'
    if 'minimum' in t:
        return 'min'
    return re.sub(r'[^a-z0-9]+', '_', t).strip('_')[:40] or 'other'


def parse_report(text):
    """Fluent yüzey raporu blokları (Surface Integrals / Report > ...). Alt alta eklenmiş birden çok blok olabilir."""
    lines = text.splitlines()
    n = len(lines)
    blocks, titles, i = [], [], 0
    while i < n:
        ln = lines[i]
        if not ln.strip():
            i += 1
            continue
        if DASH.match(ln):
            rows, j = {}, i + 1
            while j < n and lines[j].strip() and not DASH.match(lines[j]):
                m = ROW.match(lines[j])
                if not m:
                    break
                rows[m.group(1).strip()] = float(m.group(2))
                j += 1
            if j < n and DASH.match(lines[j]):
                k = j + 1
                while k < n and not lines[k].strip():
                    k += 1
                if k < n and ROW.match(lines[k]):
                    k += 1
                j = k
            if titles and rows:
                last = titles[-1]
                prev = titles[-2] if len(titles) > 1 else ''
                if prev and any(w in prev.lower() for w in KIND_WORDS):
                    kind_text, var_text = prev, last
                else:
                    kind_text, var_text = last, last
                um = UNIT.search(var_text)
                blocks.append({'kind': norm_kind(kind_text + ' ' + var_text), 'kt': kind_text.strip(),
                               'var': UNIT.sub('', var_text).strip(), 'unit': um.group(1).strip() if um else '',
                               'rows': rows})
            titles = []
            i = max(j, i + 1)
            continue
        if ROW.match(ln):
            titles = []
            i += 1
            continue
        titles.append(ln.strip())
        titles = titles[-3:]
        i += 1
    return blocks


def parse_out(text):
    """Fluent report-definition dosyası (.out): tırnaklı başlık + iterasyon satırları. Son satır = son değer."""
    header, rows = None, []
    for ln in text.splitlines():
        s = ln.strip()
        if not s:
            continue
        if header is None:
            q = re.findall(r'"([^"]*)"', s)
            if len(q) >= 2 and re.search(r'iteration|time ?step|flow-time|^time$', q[0], re.I):
                header = q
            continue
        if s.startswith('('):
            continue
        toks = s.split()
        if len(toks) != len(header):
            continue
        try:
            rows.append([float(t) for t in toks])
        except ValueError:
            continue
    if not header or not rows:
        return None
    return header, rows


def parse_xy(text):
    """Fluent XY dosyası ((xy/key/label ...)) veya başlıklı/başlıksız sütunlu tablo."""
    series, cur, header, labels = [], None, None, None
    for ln in text.splitlines():
        s = ln.strip()
        if not s:
            continue
        m = re.match(r'\(+\s*xy/key/label\s+"([^"]*)"', s)
        if m:
            cur = {'name': m.group(1), 'x': [], 'y': []}
            series.append(cur)
            continue
        m = re.match(r'\(\s*labels\s+(.*)\)\s*$', s)
        if m:
            labels = re.findall(r'"([^"]*)"', m.group(1))
            continue
        m = re.match(r'\(\s*title\s+"([^"]*)"', s)
        if m:
            continue
        if s[0] in '()':
            continue
        toks = [t for t in re.split(r'[,\s;]+', s) if t]
        try:
            nums = [float(t) for t in toks]
        except ValueError:
            if not series and header is None:
                header = [h.strip().strip('"') for h in re.split(r'\s{2,}|\t|,|;', s) if h.strip()]
            continue
        if len(nums) < 2:
            continue
        if cur is None:
            cur = {'name': '', 'cols': []}
            series.append(cur)
        if 'cols' in cur:
            cur['cols'].append(nums)
        else:
            cur['x'].append(nums[0]); cur['y'].append(nums[1])
    out = []
    for s in series:
        if 'cols' in s:
            cols = s['cols']
            if len(cols) < 3:
                continue
            width = min(len(r) for r in cols)
            for c in range(1, width):
                nm = ''
                if header and len(header) == width:
                    nm = header[c]
                elif header and len(header) == width - 1:
                    nm = header[c - 1]
                out.append({'name': nm or f'kolon{c}', 'x': [r[0] for r in cols], 'y': [r[c] for r in cols],
                            'xl': (header[0] if header and len(header) == width else ''), 'yl': nm})
        elif len(s['x']) >= 2:
            out.append({'name': s['name'], 'x': s['x'], 'y': s['y'],
                        'xl': labels[0] if labels else '', 'yl': labels[1] if labels and len(labels) > 1 else ''})
    return out


def series_entry(s, kind, sort_x):
    pts = [(a, b) for a, b in zip(s['x'], s['y']) if finite(a) and finite(b)]
    if len(pts) < 2:
        return None
    if sort_x:
        pts.sort()
    x, y = [p[0] for p in pts], [p[1] for p in pts]
    imax = max(range(len(y)), key=lambda i: y[i])
    imin = min(range(len(y)), key=lambda i: y[i])
    st = {'ymax': y[imax], 'xmax': x[imax], 'ymin': y[imin], 'xmin': x[imin], 'mean': sum(y) / len(y),
          'last': y[-1], 'n': len(y)}
    if sort_x and x[-1] > x[0]:  # x'e göre integral ortalaması (span ortalaması)
        area = sum((x[i + 1] - x[i]) * (y[i + 1] + y[i]) / 2 for i in range(len(x) - 1))
        st['imean'] = area / (x[-1] - x[0])
    xs, ys = downsample(x, y)
    return {'t': kind, 'nm': s['name'], 'xl': s.get('xl', ''), 'yl': s.get('yl', ''), 'x': xs, 'y': ys, 'st': st}


def parse_file(text):
    """Dönüş: (scalars, series, tür)"""
    scal, ser = [], []
    if '(xy/key/label' in text or re.search(r'^\s*\(labels\s', text, re.M):
        for s in parse_xy(text):
            e = series_entry(s, 'xy', True)
            if e:
                ser.append(e)
        return scal, ser, 'xy'
    out = parse_out(text)
    if out:
        header, rows = out
        for c in range(1, len(header)):
            scal.append({'kind': 'rdef', 'kt': 'Report definition', 'var': header[c], 'unit': '', 'surf': '',
                         'v': rows[-1][c]})
            e = series_entry({'name': header[c], 'x': [r[0] for r in rows], 'y': [r[c] for r in rows],
                              'xl': header[0], 'yl': header[c]}, 'hist', False)
            if e:
                ser.append(e)
        return scal, ser, 'out'
    blocks = parse_report(text)
    if blocks:
        for b in blocks:
            for surf, v in b['rows'].items():
                if surf.lower() == 'net':
                    continue
                scal.append({'kind': b['kind'], 'kt': b['kt'], 'var': b['var'], 'unit': b['unit'], 'surf': surf,
                             'v': v})
        return scal, ser, 'report'
    for s in parse_xy(text):
        e = series_entry(s, 'xy', True)
        if e:
            ser.append(e)
    return scal, ser, 'table' if ser else ''


# ----------------------------------------------------------------------------
# Tarama (önbellekli)
# ----------------------------------------------------------------------------
def list_analyses(root):
    root = Path(root)
    if not root.is_dir():
        return []
    dirs = [d for d in root.iterdir() if d.is_dir() and not d.name.startswith(('.', '_'))]
    return sorted(dirs, key=lambda d: natural_key(d.name))


def file_list(adir):
    out = []
    for p in adir.rglob('*'):
        try:
            if p.is_file():
                st = p.stat()
                out.append((p.relative_to(adir).as_posix(), st.st_size, st.st_mtime))
        except OSError:
            continue
    return out


def scan_analysis(adir, root, log=print):
    files = file_list(adir)
    sig = hashlib.md5(('%d|' % SCAN_VER + '\n'.join(f'{r}|{s}|{m:.0f}' for r, s, m in sorted(files)))
                      .encode('utf-8', 'replace')).hexdigest()
    cache = Path(root) / CACHE_DIR / (adir.name + '.json')
    c = read_json(cache)
    if c and c.get('sig') == sig:
        return c['data']
    log(f'  taranıyor: {adir.name} ({len(files)} dosya)')
    sc, sr, imgs, skipped, errors, parsed = {}, {}, [], [], [], []
    stem_drop = re.compile(re.escape(adir.name.lower()) + r'[-_ ]?')
    for rel, size, mt in sorted(files, key=lambda f: (f[2], f[0])):   # eski -> yeni: aynı anahtarda yeni kazanır
        ext = Path(rel).suffix.lower()
        if ext in IMG_EXT:
            imgs.append(rel)
            continue
        if ext in SKIP_EXT or size == 0:
            continue
        if size > MAX_TEXT:
            skipped.append(f'{rel} (çok büyük: {size / 1e6:.0f} MB)')
            continue
        try:
            raw = (adir / rel).read_bytes()
            if b'\0' in raw[:8192]:
                continue
            scal, ser, kind = parse_file(decode(raw))
        except Exception as e:  # tek bozuk dosya taramayı durdurmasın
            errors.append(f'{rel}: {type(e).__name__}: {e}')
            continue
        if not kind:
            continue
        parsed.append({'f': rel, 'kind': kind, 'nsc': len(scal), 'nsr': len(ser)})
        for s in scal:
            s['f'] = rel
            s['k'] = f"{s['kind']}|{norm(s['var'])}|{norm(s['surf'])}"
            sc[s['k']] = s
        base = stem_drop.sub('', Path(rel).stem.lower())
        for s in ser:
            s['f'] = rel
            s['k'] = f"{s['t']}|{base}#{norm(s['nm'])}"
            sr[s['k']] = s
    mt = max((m for _, _, m in files), default=adir.stat().st_mtime)
    data = {'name': adir.name, 'mtime': time.strftime('%Y-%m-%d %H:%M', time.localtime(mt)),
            'nfiles': len(files), 'sc': list(sc.values()), 'sr': list(sr.values()),
            'img': sorted(imgs, key=natural_key), 'parsed': parsed, 'skipped': skipped, 'errors': errors}
    try:
        cache.parent.mkdir(exist_ok=True)
        write_json(cache, {'sig': sig, 'data': data})
    except OSError:
        pass
    return data


def collect(root, mode, log=print):
    root = Path(root) if root else None
    ok = bool(root and root.is_dir())
    analyses = []
    if ok:
        for d in list_analyses(root):
            try:
                analyses.append(scan_analysis(d, root, log))
            except Exception as e:
                analyses.append({'name': d.name, 'mtime': '', 'nfiles': 0, 'sc': [], 'sr': [], 'img': [],
                                 'parsed': [], 'skipped': [], 'errors': [f'TARANAMADI: {type(e).__name__}: {e}']})
    return {'version': VERSION, 'author': AUTHOR, 'mode': mode, 'generated': time.strftime('%Y-%m-%d %H:%M'),
            'root': str(root or ''), 'root_ok': ok, 'base': 'files/' if mode == 'serve' else '',
            'analyses': analyses, 'mapping': (read_json(root / MAP_NAME) if ok else None),
            'default_mapping': read_json(DEFAULT_MAP)}


def render_html(data):
    tpl = HERE / 'dashboard_template.html'
    missing = [f for f in UI_FILES if not (HERE / 'ui' / f).is_file()]
    if not tpl.is_file() or missing:
        sys.exit('HATA: dashboard_template.html ve ui/ klasörü postproc.py ile aynı yerde olmalı. Eksik: '
                 + ', '.join(missing or ['dashboard_template.html']))
    js = '\n'.join(decode((HERE / 'ui' / f).read_bytes()) for f in UI_FILES).replace('</script', '<\\/script')
    data_js = json.dumps(data, ensure_ascii=False, allow_nan=False).replace('</', '<\\/')
    html = decode(tpl.read_bytes()).replace('__SCRIPTS__', js, 1)
    return html.replace('__DATA__', data_js, 1)


def build_static(root, log=print):
    data = collect(root, 'static', log)
    if not data['root_ok']:
        raise RuntimeError(f'root klasörü yok: {root}')
    out = Path(root) / 'dashboard.html'
    out.write_text(render_html(data), encoding='utf-8')
    return out, len(data['analyses'])


# ----------------------------------------------------------------------------
# Yerel sunucu
# ----------------------------------------------------------------------------
def backup_mapping(root):
    """Eşleme dosyasının eski hâlini en fazla 10 dakikada bir .postproc_cache/yedek altına kopyalar."""
    src = root / MAP_NAME
    if BACKUP_KEEP <= 0 or not src.is_file():
        return
    bdir = root / CACHE_DIR / 'yedek'
    try:
        bdir.mkdir(parents=True, exist_ok=True)
        olds = sorted(bdir.glob('postproc_eslesme_*.json'))
        if olds and time.time() - olds[-1].stat().st_mtime < 600:
            return
        (bdir / time.strftime('postproc_eslesme_%Y%m%d_%H%M%S.json')).write_bytes(src.read_bytes())
        for o in olds[:max(0, len(olds) + 1 - BACKUP_KEEP)]:
            o.unlink()
    except OSError:
        pass


def build_share(root, body):
    """Seçili analizler + tarayıcının gönderdiği (yeniden sıkıştırılmış) görseller -> tek dosyalık HTML."""
    data = collect(root, 'static', log=lambda *a: None)
    keep = set(body.get('sel') or [])
    if keep:
        data['analyses'] = [a for a in data['analyses'] if a['name'] in keep]
    for a in data['analyses']:
        a['parsed'] = a['parsed'][:200]
    data['mapping'] = body.get('mapping') or data['mapping']
    data['default_mapping'] = None
    data['embed'] = body.get('embed') or {}
    data['root'] = Path(root).name           # alıcıya şirket içi tam yol gitmesin
    name = re.sub(r'[^\w\-. ]+', '_', str(body.get('name') or '').strip())[:60] or 'paylasim'
    out_dir = Path(root) / SHARE_DIR
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{time.strftime('%Y%m%d_%H%M')}_{name}.html"
    out.write_text(render_html(data), encoding='utf-8')
    return out, out.stat().st_size


class State:
    root = ''
    lock = threading.Lock()


def save_local(**kw):
    d = read_json(LOCAL, {}) or {}
    d.update(kw)
    try:
        write_json(LOCAL, d)
    except OSError:
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype='text/plain; charset=utf-8'):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def jsend(self, obj, code=200):
        self.send(code, json.dumps(obj, ensure_ascii=False), 'application/json; charset=utf-8')

    def do_GET(self):
        u = urlparse(self.path)
        path = unquote(u.path)
        try:
            if path in ('/', '/index.html'):
                with State.lock:
                    data = collect(State.root, 'serve')
                return self.send(200, render_html(data), 'text/html; charset=utf-8')
            if path.startswith('/files/'):
                root = Path(State.root).resolve()
                p = (root / path[len('/files/'):]).resolve()
                if root not in p.parents or not p.is_file():
                    return self.send(404, 'yok')
                ctype = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
                return self.send(200, p.read_bytes(), ctype)
            if path == '/api/ping':
                return self.jsend({'ok': True})
            return self.send(404, 'yok')
        except (ConnectionError, BrokenPipeError):
            pass
        except Exception as e:
            self.send(500, f'{type(e).__name__}: {e}')

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            n = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(n).decode('utf-8') or '{}')
            if path == '/api/mapping':
                if not Path(State.root).is_dir():
                    return self.jsend({'ok': False, 'err': 'root yok'}, 400)
                backup_mapping(Path(State.root))
                write_json(Path(State.root) / MAP_NAME, body)
                try:
                    write_json(DEFAULT_MAP, body)
                except OSError:
                    pass
                return self.jsend({'ok': True})
            if path == '/api/root':
                r = str(body.get('root', '')).strip().strip('"')
                if not Path(r).is_dir():
                    return self.jsend({'ok': False, 'err': f'klasör bulunamadı: {r}'}, 400)
                State.root = str(Path(r))
                save_local(root=State.root)
                return self.jsend({'ok': True})
            if path == '/api/build':
                with State.lock:
                    out, n = build_static(State.root, log=lambda *a: None)
                return self.jsend({'ok': True, 'path': str(out), 'n': n})
            if path == '/api/share':
                with State.lock:
                    out, size = build_share(State.root, body)
                return self.jsend({'ok': True, 'path': str(out), 'size': size})
            if path == '/api/open':  # klasörü Windows Gezgini'nde aç
                p = (Path(State.root) / body.get('rel', '')).resolve()
                if Path(State.root).resolve() in [p, *p.parents] and p.exists() and hasattr(os, 'startfile'):
                    os.startfile(str(p if p.is_dir() else p.parent))
                return self.jsend({'ok': True})
            return self.send(404, 'yok')
        except Exception as e:
            self.jsend({'ok': False, 'err': f'{type(e).__name__}: {e}'}, 500)


def serve(root, port, open_browser=True):
    State.root = root or ''
    srv = None
    for p in range(port, port + 20):
        try:
            srv = ThreadingHTTPServer(('127.0.0.1', p), Handler)
            break
        except OSError:
            continue
    if not srv:
        sys.exit('HATA: boş port bulunamadı.')
    url = f'http://127.0.0.1:{srv.server_address[1]}/'
    print(f'Combustor post-process v{VERSION}  ·  geliştiren: {AUTHOR}')
    print(f'  analiz klasörü : {State.root or "(seçilmedi - arayüzden gir)"}')
    print(f'  arayüz         : {url}')
    print('  Kapatmak için bu pencerede Ctrl+C.')
    if State.root and Path(State.root).is_dir():
        collect(State.root, 'serve')   # ilk taramayı burada yap, ilerleme konsolda görünsün
    if open_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nkapatıldı.')


# ----------------------------------------------------------------------------
# diag
# ----------------------------------------------------------------------------
def cmd_diag(root, name):
    dirs = list_analyses(root)
    if not dirs:
        sys.exit(f'Analiz klasörü yok: {root}')
    adir = next((d for d in dirs if d.name == name), None) if name else dirs[0]
    if adir is None:
        sys.exit(f'Analiz klasörü bulunamadı: {name}')
    data = scan_analysis(adir, root, log=lambda *a: None)
    print(f'### postproc {VERSION} ({AUTHOR}) · {adir.name} · {data["nfiles"]} dosya, {len(data["img"])} görsel')
    print('\n### Tanınan dosyalar (tür, skaler sayısı, seri sayısı)')
    for p in data['parsed']:
        print(f"   {p['kind']:<7} {p['nsc']:>4} {p['nsr']:>4}  {p['f']}")
    print('\n### Bulunan skalerler (değerler gizli)')
    for s in data['sc'][:300]:
        print(f"   {s['kind']:<5} | {s['var']} [{s['unit']}] | {s['surf']}")
    print('\n### Bulunan seriler')
    for s in data['sr'][:150]:
        print(f"   {s['t']:<5} | {s['f']} | {s['nm']} | {s['xl']} / {s['yl']} | {s['st']['n']} nokta")
    for s in data['skipped'] + data['errors']:
        print('   !', s)
    shown = 0
    for p in data['parsed']:
        if shown >= 6:
            break
        shown += 1
        print(f"\n### {p['f']}  (sayılar maskeli, ilk 40 metin satırı)")
        k = 0
        for ln in decode((adir / p['f']).read_bytes()).splitlines():
            toks = [t for t in re.split(r'[,\s;]+', ln.strip()) if t]
            try:
                [float(t) for t in toks]
                continue
            except ValueError:
                pass
            if ln.strip() and k < 40:
                print(re.sub(r'(?<![A-Za-z_-])' + NUM + r'(?![A-Za-z_])', '#', ln.rstrip()))
                k += 1


# ----------------------------------------------------------------------------
def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    ap = argparse.ArgumentParser(description=f'Combustor post-process aracı v{VERSION}')
    ap.add_argument('cmd', nargs='?', default='serve', choices=['serve', 'build', 'diag'])
    ap.add_argument('analysis', nargs='?', help='diag için analiz klasörü adı')
    ap.add_argument('--root', help='analiz klasörlerinin bulunduğu klasör (hatırlanır)')
    ap.add_argument('--port', type=int, default=None)
    ap.add_argument('--no-open', action='store_true', help='tarayıcıyı otomatik açma')
    a = ap.parse_args()
    local = read_json(LOCAL, {}) or {}
    root = a.root or local.get('root') or (read_json(HERE / 'config.json', {}) or {}).get('root', '')
    if a.root:
        save_local(root=str(Path(a.root)))
    if a.cmd == 'serve':
        serve(root, a.port or local.get('port', 8765), not a.no_open)
    elif a.cmd == 'build':
        if not root or not Path(root).is_dir():
            sys.exit(f'HATA: analiz klasörü yok: {root!r}. --root ile ver.')
        out, n = build_static(root)
        print(f'Tamam: {n} analiz -> {out}')
        if not a.no_open:
            webbrowser.open(out.resolve().as_uri())
    else:
        cmd_diag(root, a.analysis)


if __name__ == '__main__':
    main()
