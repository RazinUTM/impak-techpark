# Third-party components

Target for v0.6: no third-party JavaScript. Charts and the map are hand-written SVG.

| Component | Version | Licence (SPDX) | How used | Obligation / notice | Source |
| --- | --- | --- | --- | --- | --- |
| Atkinson Hyperlegible (font) | current Google Fonts | OFL-1.1 — verify at release | loaded from fonts.googleapis.com (not bundled) | none for a hosted font; keep OFL notice if ever bundled | fonts.google.com/specimen/Atkinson+Hyperlegible |
| Tutor avatar images | — | not third-party; author's own likeness, generated with an AI image generator | bundled in assets/tutor | generator name, version, date and its terms of use to be recorded here by the author | — |

Build-time tools (not distributed): Python 3 + Pillow (HPND), NumPy (BSD-3-Clause), SciPy (BSD-3-Clause), Node.js (MIT) for validation, Playwright (Apache-2.0) for screenshots.
