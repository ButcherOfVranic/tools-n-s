#!/usr/bin/env python3
"""Sahte (sentetik) test verisi üretir: Fluent rapor/XY formatını taklit eder. Gerçek veri İÇERMEZ."""
import sys, math, random
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

def make(root, n=3, op=0.0):
    root = Path(root)
    random.seed(1)
    for k in range(1, n + 1):
        a = root / f'analiz-{k}' / ('summary' if k < 3 else 'post/ozet/txt')
        outn = 'outlet' if k < 3 else 'outlet-plane'
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
        (a / ('report.txt' if k < 3 else f'yuzey_raporu_{k}.rxt')).write_text(txt, encoding='utf-8')
        # T maks ayrı dosyada (birden çok report dosyası senaryosu)
        (a / 'report-max.txt').write_text(
            block('Facet Maximum', 'Total Temperature', 'k', {outn: T4 + 260 - 15 * k}), encoding='utf-8')
        # circ avg profiller: SIRASIZ noktalar (Fluent XY formatı)
        def xy(name, f):
            pts = [(i / 40, f(i / 40)) for i in range(41)]
            random.shuffle(pts)
            body = '\n'.join(f'{x:.5f}\t{y:.6f}' for x, y in pts)
            return f'(title "{name}")\n(labels "Span" "{name}")\n\n((xy/key/label "{name}")\n{body}\n)\n'
        (a / ('outlet-circ-temp.txt' if k < 3 else 'cikis_circ_T.xy')).write_text(
            xy('outlet circ T', lambda s: T4 + (120 - 10 * k) * math.sin(math.pi * s) ** 2 - 40), encoding='utf-8')
        hist = ''.join(f'{i} {pt_in * (1 + 0.01 / i):.3f} {T4 + 300 - i:.3f}\n' for i in range(1, 50))
        (a.parent / 'monitor.out').write_text(
            '"pt-in-rfile"\n"Iteration" "pt-in" "tmax-out"\n("Iteration" "pt-in" "tmax-out")\n' + hist,
            encoding='utf-8')
        (a / 'inlet-circ-pres.txt').write_text(xy('inlet circ Pt', lambda s: pt_in + 3e4 * math.sin(math.pi * s)), encoding='utf-8')
    print('örnek veri:', root)

if __name__ == '__main__':
    make(sys.argv[1] if len(sys.argv) > 1 else 'sample', op=float(sys.argv[2]) if len(sys.argv) > 2 else 0.0)
