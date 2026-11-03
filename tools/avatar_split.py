# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
"""Split the two tutor pose sheets into individual WebP/PNG files.

Usage: python3 -I tools/avatar_split.py <sheet1.png> <sheet2.png> <outdir>

The sheets carry an alpha channel already. Each figure is one connected
component of opaque pixels; figures whose hands overlap horizontally are
still separate components, so each crop is masked by its own component
and nothing of a neighbour leaks in. Output height is fixed (HEIGHT px).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HEIGHT = 360          # px, output height
PAD = 6               # px of transparent padding around each figure
MIN_AREA = 20_000     # opaque pixels; smaller components are stray specks

# Pose names in sheet order (left to right). Keep in step with src/tutor.js.
NAMES = [
    ["idle", "point", "think", "thumbs", "note"],       # sheet 1
    ["explain", "thanks", "ok", "wave", "cheer"],       # sheet 2
]


def figures(alpha: np.ndarray, want=5):
    """Return [(mask, bbox)] for the figures, left to right.

    Where two figures touch (fingertips on a neighbour's shoulder), the
    bridge is thin: erode the mask until the figures separate, label the
    eroded cores, then give every opaque pixel the label of its nearest
    core. The cut then follows the bridge instead of a straight column.
    """
    mask = alpha > 0
    # drop stray specks first, so they are not glued to the nearest figure
    lab0, n0 = ndimage.label(mask, structure=np.ones((3, 3)))
    sizes0 = ndimage.sum(mask, lab0, range(1, n0 + 1))
    mask &= np.isin(lab0, [i + 1 for i, s in enumerate(sizes0) if s >= MIN_AREA])
    for it in range(0, 40, 2):
        core = ndimage.binary_erosion(mask, iterations=it) if it else mask
        lab, n = ndimage.label(core, structure=np.ones((3, 3)))
        sizes = ndimage.sum(core, lab, range(1, n + 1))
        big = [i + 1 for i, s in enumerate(sizes) if s >= MIN_AREA]
        if len(big) >= want:
            break
    keep = np.isin(lab, big)
    lab = np.where(keep, lab, 0)
    _, (iy, ix) = ndimage.distance_transform_edt(lab == 0, return_indices=True)
    full = np.where(mask, lab[iy, ix], 0)
    found = []
    for i in big:
        m = full == i
        ys, xs = np.where(m)
        found.append((xs.mean(), m, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    found.sort(key=lambda t: t[0])
    return [(m, bb) for _, m, bb in found]


def main(paths, outdir):
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for sheet_idx, p in enumerate(paths):
        im = Image.open(p).convert("RGBA")
        arr = np.asarray(im).copy()
        figs = figures(arr[..., 3])
        if len(figs) != 5:
            raise SystemExit(f"{p}: expected 5 figures, found {len(figs)}")
        for k, (mask, (x0, y0, x1, y1)) in enumerate(figs):
            part = arr[y0:y1, x0:x1].copy()
            part[..., 3] = np.where(mask[y0:y1, x0:x1], part[..., 3], 0)
            crop = Image.fromarray(part, "RGBA")
            w, h = crop.size
            scale = HEIGHT / h
            crop = crop.resize((round(w * scale), HEIGHT), Image.LANCZOS)
            canvas = Image.new("RGBA", (crop.width + 2 * PAD, HEIGHT + 2 * PAD), (0, 0, 0, 0))
            canvas.alpha_composite(crop, (PAD, PAD))
            name = NAMES[sheet_idx][k]
            canvas.save(outdir / f"{name}.webp", "WEBP", quality=88, method=6)
            canvas.save(outdir / f"{name}.png", "PNG", optimize=True)
            manifest.append((name, canvas.width, canvas.height,
                             (outdir / f"{name}.webp").stat().st_size))
    total = sum(m[3] for m in manifest)
    for m in manifest:
        print(f"{m[0]:8s} {m[1]:4d}x{m[2]:<4d} {m[3]/1024:6.1f} KB")
    print(f"total webp {total/1024:.1f} KB")


if __name__ == "__main__":
    main(sys.argv[1:3], sys.argv[3])
