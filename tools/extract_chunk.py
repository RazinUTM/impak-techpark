# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
# Helper used while porting: extracts the document body from a spilled artifact read (see ref/).
import json, re, sys
src, dst = sys.argv[1], sys.argv[2]
arr = json.load(open(src, encoding='utf-8'))
txt = None
for item in arr:
    t = item.get('text', '')
    m = re.match(r'^<untrusted-document-([0-9a-f]+)>', t)
    if m:
        tag = m.group(1)
        body = t[m.end():]
        close = '</untrusted-document-' + tag + '>'
        idx = body.rfind(close)
        if idx < 0:
            sys.exit('closing tag not found')
        body = body[:idx]
        txt = body
        break
if txt is None:
    sys.exit('no document block found')
# body ends with the newline that precedes the closing tag; ensure exactly one trailing newline
if not txt.endswith('\n'):
    txt += '\n'
open(dst, 'w', encoding='utf-8', newline='').write(txt)
print(dst, txt.count('\n'), 'lines')
