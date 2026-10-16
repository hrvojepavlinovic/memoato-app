# Public font and share-image assets

The site serves two WOFF2 subsets locally, with `font-display: swap` and matching
preloads. They cover Latin, Latin Extended-A (including Croatian), combining
marks, punctuation, euro and arrows; other scripts use the declared fallbacks.
DM Sans retains weights 400–700; Newsreader 400–500. Both retain optical sizing.
The original OFL licenses are shipped beside the fonts. No Google font request
is made by the public pages.

Sources (Google Fonts repository, retrieved 17 October 2026):

- DM Sans: https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/DMSans%5Bopsz,wght%5D.ttf
- Newsreader: https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/Newsreader%5Bopsz,wght%5D.ttf

Save them as `dm-sans-variable.ttf` and `newsreader-variable.ttf` in a temporary
directory. `build_fonts.py` verifies their SHA-256 before subsetting; inspect any
upstream change rather than silently changing the pinned input.

To regenerate intentionally, use a disposable Python environment with
`fonttools`, `brotli` and `Pillow` installed:

```sh
python scripts/build_fonts.py /path/to/original-ttfs
python scripts/build_social_images.py
```

These are asset-authoring tools, not dependencies of the Astro or CI build.
The social generator uses the committed fonts and logo, and reads only article
titles from frontmatter. It emits 1200×630 PNGs for the brand, journal, and each
article. The legacy `/og.png` mirrors the new brand image; new metadata uses
versioned `/social/*-v2.png` URLs to avoid reusing the old share-preview URL.
Increment asset filenames when changing deployed assets in future.
