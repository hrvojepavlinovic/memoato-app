"""Build the committed OFL font subsets. Requires fonttools and brotli.
Pass a directory containing the two original TTFs listed in assets.md.
Source hashes protect against silent upstream changes; no network at build time.
"""
import hashlib
from pathlib import Path
import sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'dm-sans': ((400, 700), '8cd08d97e89c24d0aa92edd2f0f4c8ee6195eee9b7c9f154865a58b02f0c1c0d'),
    'newsreader': ((400, 500), '8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1'),
}
if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/build_fonts.py /path/to/original-ttfs')
for name, (weights, digest) in SOURCES.items():
    source = Path(sys.argv[1]) / f'{name}-variable.ttf'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == digest, f'Unexpected source: {name}'
    face = TTFont(source)
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_legacy = True
    builder = subset.Subsetter(options=options)
    builder.populate(unicodes=subset.parse_unicodes('0020-017F,0300-036F,2000-206F,20AC,2122,2190-21FF,2212,FEFF,FFFD'))
    builder.subset(face)
    instantiateVariableFont(face, {'wght': weights}, inplace=True)
    face.flavor = 'woff2'
    face.save(ROOT / 'public/fonts' / f'{name}-latin-v1.woff2')
