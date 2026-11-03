#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
"""Build dist/index.html (one self-contained file) from src/, content/ and assets/.

Usage: python3 tools/build.py [--check]

Order of assembly (see DESIGN.md s6):
  src/head.html            doctype, <head>, <style> = src/shell.css + src/game.css + src/impak.css
  src/body.html            the seven-area skeleton
  <script> __AVATARS       assets/tutor/*.webp inlined as data URIs (author's mark; see its LICENSE)
  <script id="engine-src"> src/engine.js   (also copied verbatim to apps-script/engine.gs)
  <script>                 src/strategies.js, src/game.js, src/uikit.js, src/i18n.js, content/texts.js, src/config.js, src/live.js, src/app.js

--check runs `node --check` on every JS part before assembling.
"""
import base64
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, CONTENT, ASSETS, DIST = ROOT / "src", ROOT / "content", ROOT / "assets", ROOT / "dist"

JS_PARTS = [SRC / "engine.js", SRC / "strategies.js", SRC / "game.js", SRC / "uikit.js", SRC / "i18n.js", CONTENT / "texts.js", SRC / "config.js", SRC / "live.js", SRC / "app.js"]
POSES = ["idle", "point", "think", "thumbs", "note", "explain", "thanks", "ok", "wave", "cheer"]


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def avatars_js() -> str:
    parts = []
    for name in POSES:
        f = ASSETS / "tutor" / f"{name}.webp"
        if not f.exists():
            continue
        b64 = base64.b64encode(f.read_bytes()).decode("ascii")
        parts.append(f'"{name}":"data:image/webp;base64,{b64}"')
    return "window.__AVATARS={" + ",".join(parts) + "};"


def check_js():
    ok = True
    for p in JS_PARTS:
        r = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
        if r.returncode != 0:
            ok = False
            print(f"node --check failed: {p}\n{r.stderr}")
    return ok


def main():
    if "--check" in sys.argv and not check_js():
        sys.exit(1)
    head = read(SRC / "head.html")
    css = read(SRC / "shell.css") + "\n" + read(SRC / "game.css") + "\n" + read(SRC / "impak.css")
    head = head.replace("/*__CSS__*/", css)
    body = read(SRC / "body.html")
    engine = read(SRC / "engine.js")
    scripts = [
        "<script>\n" + avatars_js() + "\n</script>",
        '<script id="engine-src">\n' + engine + "\n</script>",
    ]
    for p in JS_PARTS[1:]:
        scripts.append("<script>\n" + read(p) + "\n</script>")
    version = re.search(r"VERSION\s*=\s*['\"]([^'\"]+)", engine)
    html = head + body + "\n".join(scripts) + "\n</body>\n</html>\n"
    DIST.mkdir(exist_ok=True)
    out = DIST / "index.html"
    out.write_text(html, encoding="utf-8")
    gs = ROOT / "apps-script" / "engine.gs"
    gs.parent.mkdir(exist_ok=True)
    gs.write_text(engine, encoding="utf-8")
    print(f"dist/index.html  {out.stat().st_size/1024:,.0f} KB   engine {version.group(1) if version else '?'}")
    print(f"apps-script/engine.gs  {gs.stat().st_size/1024:,.0f} KB (verbatim copy of src/engine.js)")


if __name__ == "__main__":
    main()
