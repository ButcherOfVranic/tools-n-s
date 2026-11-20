#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Combustor post-process özet aracı (yalnızca Python standart kütüphanesi gerekir).

Kullanım:
  python postproc.py build              -> dashboard.html + results.csv üretir
  python postproc.py inspect analiz-1   -> bir analizde neyi nasıl bulduğunu gösterir
  python postproc.py diag analiz-1      -> dosyaların SADECE metin satırlarını yazar
                                           (sayısal veri içermez, bana yapıştırabilirsin)

Ayarlar config.json içindedir. Yeni analiz eklemek: klasörü root'a koy, `build`'i tekrar çalıştır.
"""
import sys, os, re, json, csv, base64, math, argparse, time
from pathlib import Path

HERE = Path(__file__).resolve().parent

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


def glob_to_regex(pat):
    """'**/' sıfır veya daha çok klasör, '*' klasör içi joker."""
    pat = pat.replace('\\', '/').lower()
    out, i = '', 0
    while i < len(pat):
        if pat.startswith('**/', i):
            out += '(?:.*/)?'; i += 3
        elif pat.startswith('**', i):
            out += '.*'; i += 2
        elif pat[i] == '*':
            out += '[^/]*'; i += 1
        elif pat[i] == '?':
            out += '[^/]'; i += 1
        else:
            out += re.escape(pat[i]); i += 1
    return re.compile('^' + out + '$')


def find_files(rels, patterns):
    """İlk eşleşen desenin sonuçlarını döndürür (klasör derinliği az olan önce)."""
    for pat in patterns:
        rx = glob_to_regex(pat)
        hits = [r for r in rels if rx.match(r.lower())]
        if hits:
            return sorted(hits, key=lambda r: (r.count('/'), len(r), r))
    return []


def read_text(path):
    for enc in ('utf-8', 'latin-1'):
        try:
            return Path(path).read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
    return ''


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


# ----------------------------------------------------------------------------
# report.txt ayrıştırıcı  (Fluent yüzey raporu blokları, alt alta eklenmiş olabilir)
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
    lines = text.splitlines()
    n = len(lines)
    blocks, titles, i = [], [], 0
    while i < n:
        ln = lines[i]
        if not ln.strip():
            i += 1
            continue
        if DASH.match(ln):
            rows, net, j = {}, None, i + 1
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
                if k < n:
                    m = ROW.match(lines[k])
                    if m:
                        net = float(m.group(2))
                        k += 1
                j = k
            if titles and (rows or net is not None):
                last = titles[-1]
                prev = titles[-2] if len(titles) > 1 else ''
                if prev and any(w in prev.lower() for w in KIND_WORDS):
                    kind_text, var_text = prev, last
                else:
                    kind_text, var_text = last, last
                um = UNIT.search(var_text)
                unit = um.group(1).strip() if um else ''
                var = UNIT.sub('', var_text).strip()
                blocks.append({'kind': norm_kind(kind_text + ' ' + var_text), 'kind_text': kind_text.strip(),
                               'var': var, 'unit': unit, 'rows': rows, 'net': net})
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


def find_val(blocks, kinds, var_sub, surf):
    """Son (en yeni) eşleşen bloktan değer. Önce tam yüzey adı, sonra içeren ad."""
    if isinstance(kinds, str):
        kinds = [kinds]
    for kind in kinds:
        hit = None
        for b in blocks:
            if b['kind'] != kind:
                continue
            if var_sub and var_sub.lower() not in b['var'].lower():
                continue
            exact = [v for s, v in b['rows'].items() if s.lower() == surf.lower()]
            part = [v for s, v in b['rows'].items() if surf.lower() in s.lower()]
            if exact:
                hit = exact[0]
            elif part:
                hit = part[0]
        if hit is not None:
            return hit, kind
    return None, None


# ----------------------------------------------------------------------------
# circ / radial avg ayrıştırıcı (Fluent XY dosyası veya sütunlu metin)
# ----------------------------------------------------------------------------
def parse_xy(text):
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
        if s[0] in '()':
            continue
        toks = [t for t in re.split(r'[,\s;]+', s) if t]
        try:
            nums = [float(t) for t in toks]
        except ValueError:
            if not series and header is None:
                header = [h.strip() for h in re.split(r'\s{2,}|\t|,', s) if h.strip()]
            continue
        if len(nums) < 2:
            continue
        if cur is None:
            cur = {'name': '', 'x': [], 'y': [], 'cols': []}
            series.append(cur)
        if cur.get('cols') is not None and 'cols' in cur:
            cur['cols'].append(nums)
        else:
            cur['x'].append(nums[0]); cur['y'].append(nums[1])
    out = []
    for s in series:
        if 'cols' in s:  # sütunlu tablo: her y sütunu ayrı seri
            cols = s['cols']
            width = min(len(r) for r in cols)
            for c in range(1, width):
                nm = ''
                if header and len(header) == width:
                    nm = header[c]
                elif header and len(header) == width - 1:
                    nm = header[c - 1]
                out.append({'name': nm or f'kolon{c}', 'x': [r[0] for r in cols], 'y': [r[c] for r in cols],
                            'xlabel': (header[0] if header else '')})
        else:
            if s['x']:
                s['xlabel'] = labels[0] if labels else ''
                if labels and len(labels) > 1 and not s['name']:
                    s['name'] = labels[1]
                out.append(s)
    return out


def pick_series(series, pick):
    if not series:
        return None
    if isinstance(pick, int):
        return series[pick] if pick < len(series) else None
    if isinstance(pick, str) and pick:
        for s in series:
            if pick.lower() in s['name'].lower():
                return s
        return None
    return series[0]


def downsample(x, y, maxn=1500):
    if len(x) <= maxn:
        return x, y
    step = len(x) / maxn
    idx = sorted({int(i * step) for i in range(maxn)} | {len(x) - 1})
    return [x[i] for i in idx], [y[i] for i in idx]


# ----------------------------------------------------------------------------
# Analiz işleme
# ----------------------------------------------------------------------------
def load_config(path):
    return json.loads(read_text(path))


def list_analyses(cfg):
    root = Path(cfg['root'])
    rx = glob_to_regex(cfg.get('analysis_glob', '*'))
    skip = {s.lower() for s in cfg.get('exclude', [])}
    if not root.is_dir():
        sys.exit(f"HATA: root klasörü bulunamadı: {root}\nconfig.json içindeki 'root' yolunu düzelt.")
    dirs = [d for d in root.iterdir() if d.is_dir() and rx.match(d.name.lower()) and d.name.lower() not in skip]
    return sorted(dirs, key=lambda d: natural_key(d.name))


def metric_defs(cfg):
    defs = [
        ('mdot_in', 'Giriş debisi', 'kg/s', 4, None, 'Debi'),
        ('mdot_out', 'Çıkış debisi', 'kg/s', 4, None, 'Debi'),
        ('mass_balance', 'Kütle dengesi (çıkış-giriş)/giriş', '%', 3, 'abs_low', 'Debi'),
        ('Pt_in', 'Pt giriş', 'Pa', 1, None, 'Basınç'),
        ('Pt_diff', 'Pt difüzör çıkışı', 'Pa', 1, None, 'Basınç'),
        ('Pt_out', 'Pt çıkış', 'Pa', 1, None, 'Basınç'),
        ('dPP_comb', 'dP/P toplam (giriş→çıkış)', '%', 3, 'low', 'Basınç'),
        ('dPP_diff', 'dP/P difüzör (giriş→dif. çıkışı)', '%', 3, 'low', 'Basınç'),
        ('dPP_liner', 'dP/P liner (dif. çıkışı→çıkış)', '%', 3, 'low', 'Basınç'),
        ('Cp_diff', 'Difüzör Cp', '-', 4, 'high', 'Basınç'),
        ('Tt_in', 'Tt giriş', 'K', 2, None, 'Sıcaklık'),
        ('Tt_out', 'Tt çıkış (kütle ort.)', 'K', 2, None, 'Sıcaklık'),
        ('dT', 'Sıcaklık artışı', 'K', 2, None, 'Sıcaklık'),
        ('Tmax_exit', 'T maks (çıkış düzlemi)', 'K', 2, 'low', 'Sıcaklık'),
        ('OTDF', 'OTDF', '-', 4, 'low', 'Sıcaklık'),
        ('Tmax_circ', 'T maks (circ avg)', 'K', 2, 'low', 'Sıcaklık'),
        ('span_Tmax_circ', 'Circ avg T maks. span konumu', '-', 4, None, 'Sıcaklık'),
        ('RTDF', 'RTDF', '-', 4, 'low', 'Sıcaklık'),
    ]
    out = [{'key': k, 'label': l, 'unit': u, 'digits': d, 'better': b, 'group': g} for k, l, u, d, b, g in defs]
    for i, fs in enumerate(cfg.get('flow_split', [])):
        out.append({'key': f'split_{i}', 'label': fs['label'], 'unit': '%', 'digits': 2, 'better': None,
                    'group': 'Debi dağılımı'})
    out.append({'key': 'split_sum', 'label': 'Debi dağılımı toplamı', 'unit': '%', 'digits': 2, 'better': None,
                'group': 'Debi dağılımı'})
    return out


def process_analysis(adir, cfg, out_dir, notes):
    name = adir.name
    warns = []
    rels = [p.relative_to(adir).as_posix() for p in adir.rglob('*') if p.is_file()]
    res = {'name': name, 'path': str(adir), 'metrics': {}, 'profiles': {}, 'images': [], 'warnings': warns,
           'files': {}}
    try:
        res['mtime'] = time.strftime('%Y-%m-%d %H:%M', time.localtime(adir.stat().st_mtime))
    except OSError:
        res['mtime'] = ''

    # ---- report ----
    rep = find_files(rels, cfg['files']['report'])
    blocks = []
    if not rep:
        warns.append('report dosyası bulunamadı (config.json > files.report desenlerine bak)')
    else:
        if len(rep) > 1:
            warns.append(f'birden çok report dosyası bulundu, ilki kullanıldı: {rep[0]}  (diğerleri: {len(rep) - 1})')
        res['files']['report'] = rep[0]
        blocks = parse_report(read_text(adir / rep[0]))
        if not blocks:
            warns.append('report dosyasında hiç blok ayrıştırılamadı (diag komutuyla biçime bak)')

    S, V, K = cfg['surfaces'], cfg['vars'], cfg.get('kinds', {})

    def g(var_key, surf_key, kinds=None):
        kinds = kinds or [K.get(var_key, 'mwa'), 'mwa', 'awa']
        v, used = find_val(blocks, kinds, V[var_key], S[surf_key])
        if v is None:
            warns.append(f"değer yok: {var_key} @ {surf_key} ('{V[var_key]}' / '{S[surf_key]}')")
        return v

    m = res['metrics']
    m['Pt_in'], m['Pt_diff'], m['Pt_out'] = g('pt', 'inlet'), g('pt', 'diffuser_exit'), g('pt', 'outlet')
    m['Tt_in'], m['Tt_out'] = g('tt', 'inlet'), g('tt', 'outlet')
    ps_in, ps_diff = g('ps', 'inlet'), g('ps', 'diffuser_exit')
    mi = g('mfr', 'inlet', ['mfr'])
    mo = g('mfr', 'outlet', ['mfr'])
    m['mdot_in'] = abs(mi) if mi is not None else None
    m['mdot_out'] = abs(mo) if mo is not None else None

    def pct_loss(a, b):
        return (a - b) / a * 100.0 if a not in (None, 0) and b is not None else None

    m['dPP_comb'] = pct_loss(m['Pt_in'], m['Pt_out'])
    m['dPP_diff'] = pct_loss(m['Pt_in'], m['Pt_diff'])
    m['dPP_liner'] = pct_loss(m['Pt_diff'], m['Pt_out'])
    if m['mdot_in'] and m['mdot_out'] is not None:
        m['mass_balance'] = (m['mdot_out'] - m['mdot_in']) / m['mdot_in'] * 100.0
    if None not in (ps_in, ps_diff, m['Pt_in']) and (m['Pt_in'] - ps_in) != 0:
        m['Cp_diff'] = (ps_diff - ps_in) / (m['Pt_in'] - ps_in)
    dT = None
    if m['Tt_in'] is not None and m['Tt_out'] is not None:
        dT = m['Tt_out'] - m['Tt_in']
        m['dT'] = dT
        if dT <= 0:
            warns.append('Tt çıkış <= Tt giriş: OTDF/RTDF hesaplanamaz')
            dT = None

    # ---- OTDF: çıkış düzlemi T maks ----
    tmax, _ = find_val(blocks, ['max'], cfg.get('otdf_tmax_var', V['tt']), S['outlet'])
    ov = notes.get(name, {}).get('overrides', {})
    if 'Tmax_exit' in ov:
        tmax = ov['Tmax_exit']
    m['Tmax_exit'] = tmax
    if tmax is None:
        warns.append("OTDF için çıkış düzlemi T maks bulunamadı (report'ta 'Maximum' bloğu yok). "
                     "notes.json > overrides > Tmax_exit ile elle girilebilir.")
    if tmax is not None and dT:
        m['OTDF'] = (tmax - m['Tt_out']) / dT

    # ---- Profiller ----
    prof_cfg = cfg.get('profiles', {})
    for key, pc in prof_cfg.items():
        files = find_files(rels, pc['patterns'])
        if not files:
            warns.append(f"profil dosyası yok: {key}")
            continue
        if len(files) > 1:
            warns.append(f"profil '{key}': birden çok dosya, ilki kullanıldı: {files[0]}")
        series = parse_xy(read_text(adir / files[0]))
        s = pick_series(series, pc.get('series', 0))
        if not s:
            warns.append(f"profil '{key}' ayrıştırılamadı: {files[0]}")
            continue
        x, y = list(s['x']), list(s['y'])
        x = [v * pc.get('x_scale', 1) for v in x]
        y = [v * pc.get('y_scale', 1) for v in y]
        entry = {'file': files[0]}
        if y:
            yi = max(range(len(y)), key=lambda i: y[i])
            entry['max'] = {'x': x[yi], 'y': y[yi]}
        x2, y2 = downsample(x, y)
        entry['x'], entry['y'] = x2, y2
        res['profiles'][key] = entry
        res['files'][key] = files[0]

    # ---- RTDF ----
    rp = res['profiles'].get(cfg.get('rtdf_profile', ''))
    if rp:
        m['Tmax_circ'] = rp['max']['y']
        m['span_Tmax_circ'] = rp['max']['x']
        if dT and m['Tt_out'] is not None:
            m['RTDF'] = (rp['max']['y'] - m['Tt_out']) / dT
    elif cfg.get('rtdf_profile'):
        warns.append('RTDF hesaplanamadı: rtdf_profile dosyası yok')

    # ---- Debi dağılımı ----
    split_sum, have = 0.0, False
    for i, fs in enumerate(cfg.get('flow_split', [])):
        v, _ = find_val(blocks, ['mfr'], '', fs['surface'])
        if v is None or not m['mdot_in']:
            warns.append(f"debi dağılımı: '{fs['label']}' ({fs['surface']}) bulunamadı")
            m[f'split_{i}'] = None
            continue
        m[f'split_{i}'] = abs(v) / m['mdot_in'] * 100.0
        if fs.get('in_sum', True):
            split_sum += m[f'split_{i}']
            have = True
    m['split_sum'] = split_sum if have else None

    # ---- Görseller ----
    imgs = []
    for pat in cfg.get('images', ['summary/**/*.png']):
        rx = glob_to_regex(pat)
        imgs += [r for r in rels if rx.match(r.lower()) and r not in imgs]
    for r in sorted(imgs, key=natural_key):
        res['images'].append(os.path.relpath(str(adir / r), out_dir).replace('\\', '/'))

    res['metrics'] = {k: clean(v) for k, v in m.items()}
    return res


def data_uri(path):
    p = Path(path)
    if not p.is_absolute():
        p = Path(cfg_root_for_assets) / p
    if not p.is_file():
        return None
    mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
            '.gif': 'image/gif'}.get(p.suffix.lower(), 'application/octet-stream')
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()


cfg_root_for_assets = HERE


def build(cfg, cfg_path):
    global cfg_root_for_assets
    cfg_root_for_assets = Path(cfg_path).resolve().parent
    out_dir = Path(cfg.get('out_dir') or cfg['root'])
    out_dir.mkdir(parents=True, exist_ok=True)
    notes_path = out_dir / 'notes.json'
    notes = json.loads(read_text(notes_path)) if notes_path.is_file() else {}
    analyses = []
    dirs = list_analyses(cfg)
    if not dirs:
        sys.exit("HATA: root altında analiz klasörü bulunamadı (analysis_glob desenini kontrol et).")
    for d in dirs:
        print(f'  işleniyor: {d.name}')
        a = process_analysis(d, cfg, out_dir, notes)
        a['note'] = notes.get(d.name, {}).get('note', '')
        a['tags'] = notes.get(d.name, {}).get('tags', '')
        analyses.append(a)

    defs = metric_defs(cfg)
    ref = cfg.get('reference') or analyses[0]['name']
    if ref not in [a['name'] for a in analyses]:
        ref = analyses[0]['name']
    data = {
        'generated': time.strftime('%Y-%m-%d %H:%M'),
        'reference': ref,
        'analyses': analyses,
        'metrics': defs,
        'profiles': [{'key': k, 'label': v.get('label', k), 'xlabel': v.get('xlabel', 'Span'),
                      'ylabel': v.get('ylabel', ''), 'swap': v.get('span_vertical', True),
                      'group': v.get('group', '')} for k, v in cfg.get('profiles', {}).items()],
        'split_def': [{'key': f'split_{i}', 'label': fs['label'], 'x': fs.get('x', 0.1 + 0.15 * i),
                       'y': fs.get('y', 0.1)} for i, fs in enumerate(cfg.get('flow_split', []))],
        'section_image': data_uri(cfg['section_image']) if cfg.get('section_image') else None,
    }
    # CSV
    with open(out_dir / 'results.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['analiz'] + [f"{d['label']} [{d['unit']}]" for d in defs])
        for a in analyses:
            w.writerow([a['name']] + [('' if a['metrics'].get(d['key']) is None else a['metrics'][d['key']])
                                      for d in defs])
    tpl = read_text(HERE / 'dashboard_template.html')
    html = tpl.replace('__DATA__', json.dumps(data, ensure_ascii=False, allow_nan=False).replace('</', '<\\/'))
    out = out_dir / 'dashboard.html'
    out.write_text(html, encoding='utf-8')
    nw = sum(len(a['warnings']) for a in analyses)
    print(f'\nTamam: {len(analyses)} analiz, {nw} uyarı.\n  {out}\n  {out_dir / "results.csv"}')


# ----------------------------------------------------------------------------
# inspect / diag
# ----------------------------------------------------------------------------
def resolve_analysis(cfg, name):
    p = Path(name)
    if p.is_dir():
        return p
    p = Path(cfg['root']) / name
    if p.is_dir():
        return p
    sys.exit(f'Analiz klasörü bulunamadı: {name}')


def cmd_inspect(cfg, name):
    adir = resolve_analysis(cfg, name)
    rels = [p.relative_to(adir).as_posix() for p in adir.rglob('*') if p.is_file()]
    print(f'== {adir}  ({len(rels)} dosya)')
    rep = find_files(rels, cfg['files']['report'])
    print('\n[report]', rep or 'BULUNAMADI')
    if rep:
        for b in parse_report(read_text(adir / rep[0])):
            surf = ', '.join(f'{s}={v:.5g}' for s, v in b['rows'].items())
            print(f"  {b['kind']:>6} | {b['var']} ({b['unit']}) | {surf} | net={b['net']}")
    for key, pc in cfg.get('profiles', {}).items():
        files = find_files(rels, pc['patterns'])
        print(f'\n[profil: {key}]', files[:3] or 'BULUNAMADI')
        if files:
            ser = parse_xy(read_text(adir / files[0]))
            print(f'  {len(ser)} seri', [(s['name'], len(s['x'])) for s in ser][:6])
    print('\n[tüm .txt/.rxt/.out/.csv dosyaları]')
    for r in sorted(rels, key=natural_key):
        if r.lower().endswith(('.txt', '.rxt', '.out', '.csv', '.xy', '.dat')):
            print('  ', r)


def cmd_diag(cfg, name):
    """Sadece sayısal olmayan satırları yazar: dosya yapısı paylaşılabilsin, veri sızmasın."""
    adir = resolve_analysis(cfg, name)
    rels = [p.relative_to(adir).as_posix() for p in adir.rglob('*') if p.is_file()]
    print('### Klasör yapısı (ilk 150 dosya)')
    for r in sorted(rels, key=natural_key)[:150]:
        print('  ', r)
    cand = []
    rep = find_files(rels, cfg['files']['report'])
    cand += rep[:1]
    for pc in cfg.get('profiles', {}).values():
        cand += find_files(rels, pc['patterns'])[:1]
    seen = set()
    for r in cand:
        if r in seen:
            continue
        seen.add(r)
        print(f'\n### {r}  (sayısal satırlar atlandı)')
        nrows, shown = 0, 0
        for ln in read_text(adir / r).splitlines():
            toks = [t for t in re.split(r'[,\s;]+', ln.strip()) if t]
            try:
                [float(t) for t in toks]
                is_num = bool(toks)
            except ValueError:
                is_num = False
            if is_num:
                nrows += 1
                continue
            if ln.strip() and shown < 60:
                # sayıları maskele: yüzey adı/başlık yapısı görünür, değerler görünmez
                print(re.sub(r'(?<![A-Za-z_-])' + NUM + r'(?![A-Za-z_])', '#', ln.rstrip())); shown += 1
        print(f'  [... {nrows} sayısal satır atlandı]')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    ap = argparse.ArgumentParser(description='Combustor post-process özet aracı')
    ap.add_argument('cmd', choices=['build', 'inspect', 'diag'])
    ap.add_argument('analysis', nargs='?')
    ap.add_argument('--config', default=str(HERE / 'config.json'))
    a = ap.parse_args()
    cfg = load_config(a.config)
    if a.cmd == 'build':
        build(cfg, a.config)
    else:
        if not a.analysis:
            sys.exit('Analiz klasör adını ver: python postproc.py ' + a.cmd + ' analiz-1')
        (cmd_inspect if a.cmd == 'inspect' else cmd_diag)(cfg, a.analysis)


if __name__ == '__main__':
    main()
