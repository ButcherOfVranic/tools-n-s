#!/usr/bin/env python3
"""Sahte (sentetik) test verisi üretir: Fluent rapor/XY formatını taklit eder. Gerçek veri İÇERMEZ."""
import sys, math, random, struct, zlib
from pathlib import Path

def block(kind, var, unit, rows, net=None):
    out = []
    if kind:
        out.append(f'                   {kind}')
    out.append(f'                {var:<32}({unit})')
    out.append('-------------------------------- --------------------')
    for s, v in rows.items():
        out.append(f'{s:>32} {v:>20.8g}')
    out.append('                ---------------- --------------------')
    out.append(f'{"Net":>32} {(net if net is not None else sum(rows.values())):>20.8g}')
    return '\n'.join(out) + '\n\n'

def png(path, w, h, hot, seed):
    """Saf Python ile sahte kontur görseli (renk haritası + sıcak bölge)."""
    rnd = random.Random(seed)
    cx, cy, rr = hot
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            v = 0.35 * x / w + 0.65 * math.exp(-(((x - cx) / rr) ** 2 + ((y - cy) / (rr * .6)) ** 2)) + rnd.random() * .02
            v = max(0.0, min(1.0, v))
            r = int(255 * min(1, max(0, 1.6 * v - .3)))
            g = int(255 * min(1, max(0, 1.6 - abs(v - .5) * 3.2)))
            b = int(255 * min(1, max(0, 1.1 - 1.8 * v)))
            row += bytes((r, g, b))
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)

    def ch(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', raw) + ch(b'IEND', b''))


def make(root, n=4, op=0.0):
    root = Path(root)
    random.seed(1)
    for k in range(1, n + 1):
        a = root / f'analiz-{k}' / ('summary' if k != 3 else 'post/ozet/txt')
        outn = 'outlet' if k != 3 else 'outlet-plane'
        a.mkdir(parents=True, exist_ok=True)
        pt_in = 2.0e6 - op
        loss = 0.04 + 0.005 * k
        pt_diff = pt_in - 0.012 * 2.0e6
        pt_out = 2.0e6 * (1 - loss) - op
        T3, T4 = 800.0, 1600.0 + 20 * k
        surf = ['inlet', 'diffuser-outlet', outn]
        txt = ''
        txt += block('Mass-Weighted Average', 'Total Pressure', 'pascal',
                     dict(zip(surf, [pt_in, pt_diff, pt_out])))
        txt += block('Mass-Weighted Average', 'Total Temperature', 'k', dict(zip(surf, [T3, 900.0, T4])))
        txt += block('Area-Weighted Average', 'Static Pressure', 'pascal',
                     dict(zip(surf, [pt_in - 9e4, pt_diff - 3e4, pt_out - 2e4])))
        txt += block('', 'Mass Flow Rate', 'kg/s', {'inlet': 10.0, 'diffuser-outlet': 10.0, outn: -10.0 - 0.25,
                                                  'swirler': 1.2, 'outer-ann': 3.1 + 0.1 * k, 'inner-ann': 2.9,
                                                  'dilution-1': 0.8, 'dilution-2': 0.75, 'cooling': 1.2})
        (a / ('report.txt' if k != 3 else f'yuzey_raporu_{k}.rxt')).write_text(txt, encoding='utf-8')
        # T maks ayrı dosyada (birden çok report dosyası senaryosu)
        (a / 'report-max.txt').write_text(
            block('Facet Maximum', 'Total Temperature', 'k', {outn: T4 + 260 - 15 * k}), encoding='utf-8')
        # circ avg profiller: SIRASIZ noktalar (Fluent XY formatı)
        def xy(name, f, radius=False):
            r0, r1 = 0.25, 0.33          # analiz-3: x = yarıçap [m]
            pts = [((r0 + (r1 - r0) * i / 40) if radius else i / 40, f(i / 40)) for i in range(41)]
            random.shuffle(pts)
            body = '\n'.join(f'{x:.5f}\t{y:.6f}' for x, y in pts)
            return f'(title "{name}")\n(labels "{'Radius' if radius else 'Span'}" "{name}")\n\n((xy/key/label "{name}")\n{body}\n)\n'
        (a / ('outlet-circ-temp.txt' if k != 3 else 'cikis_circ_T.xy')).write_text(
            xy('outlet circ T', lambda s: T4 + (120 - 10 * k) * math.sin(math.pi * (s ** (0.8 + 0.1 * k))) ** 2 - 40,
               radius=(k == 3)), encoding='utf-8')
        # görseller: aynı içerik, farklı ad sonekleri (ATP_cp_..., TT_out_...)
        sfx = {1: ['analiz-1_iso', 'analiz-1', 'plane'], 2: ['v2_final', 'run2', 'plane'],
               3: ['analiz-3', 'son', 'plane_new'], 4: ['iter4_2026', 'analiz-4_b', 'plane']}[(k - 1) % 4 + 1]
        png(a / f'ATP_cp_{sfx[0]}.png', 240, 150, (80 + 22 * k, 75, 40), k)
        png(a / f'TT_out_{sfx[1]}.png', 240, 150, (150 - 15 * k, 70 + 6 * k, 35 + 3 * k), 10 + k)
        png(a / f'Mach_mid_{sfx[2]}.png', 240, 150, (120, 75, 60 - 5 * k), 20 + k)
        hist = ''.join(f'{i} {pt_in * (1 + 0.01 / i):.3f} {T4 + 300 - i:.3f}\n' for i in range(1, 50))
        (a.parent / 'monitor.out').write_text(
            '"pt-in-rfile"\n"Iteration" "pt-in" "tmax-out"\n("Iteration" "pt-in" "tmax-out")\n' + hist,
            encoding='utf-8')
        (a / 'inlet-circ-pres.txt').write_text(xy('inlet circ Pt', lambda s: pt_in + 3e4 * math.sin(math.pi * s)), encoding='utf-8')
    print('örnek veri:', root)

if __name__ == '__main__':
    make(sys.argv[1] if len(sys.argv) > 1 else 'sample', op=float(sys.argv[2]) if len(sys.argv) > 2 else 0.0)
