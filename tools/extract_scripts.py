# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
# Helper used while porting: extracts the document body from a spilled artifact read (see ref/).
import re, sys, os
src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
html = open(src, encoding='utf-8').read()
# find all <script ...> ... </script>, report line numbers; only inline (no src=) get written
n = 0
for m in re.finditer(r'<script\b([^>]*)>(.*?)</script>', html, re.S | re.I):
    attrs, body = m.group(1), m.group(2)
    start_line = html.count('\n', 0, m.start()) + 1
    end_line = html.count('\n', 0, m.end()) + 1
    kind = 'external' if re.search(r'\bsrc\s*=', attrs) else 'inline'
    typ = re.search(r'type\s*=\s*["\']([^"\']+)', attrs)
    print(f'{kind:8s} lines {start_line}-{end_line} attrs={attrs.strip()!r} type={typ.group(1) if typ else "(js)"} chars={len(body)}')
    if kind == 'inline':
        n += 1
        # pad with blank lines so node's reported line numbers match the HTML file
        pad = '\n' * (start_line - 1 + body[:1].count('\n') * 0)
        p = os.path.join(outdir, f'script{n:02d}_L{start_line}-{end_line}.js')
        open(p, 'w', encoding='utf-8').write('\n' * (start_line - 1) + body)
        print('   ->', p)
