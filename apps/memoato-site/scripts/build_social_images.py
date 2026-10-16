"""Generate committed share images. Requires Pillow, fonttools and brotli.
Run from any directory: python scripts/build_social_images.py
No browser, network, or application data is used.
"""
from io import BytesIO
import json
from pathlib import Path
import re
import shutil
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
SCALE = 2

def font(family, size, weight=400):
    source = TTFont(PUBLIC / 'fonts' / f'{family}-latin-v1.woff2')
    source.flavor = None
    data = BytesIO()
    source.save(data)
    data.seek(0)
    face = ImageFont.truetype(data, size * SCALE)
    axes = face.get_variation_axes()
    face.set_variation_by_axes([
        min(a['maximum'], max(a['minimum'], weight if b'Weight' in a['name'] else 72))
        for a in axes
    ])
    return face

def render(name, title=None):
    paper = '#e9e2d5' if title else '#f4f0e7'
    image = Image.new('RGB', (1200*SCALE, 630*SCALE), paper)
    draw = ImageDraw.Draw(image)
    def text(x, y, value, face, color='#1d201b', anchor='lt'):
        draw.text((x*SCALE, y*SCALE), value, font=face, fill=color, anchor=anchor)
    logo = Image.open(PUBLIC / 'logo.png').convert('RGBA')
    logo.thumbnail((56*SCALE, 56*SCALE), Image.Resampling.LANCZOS)
    image.paste(logo, (80*SCALE, 60*SCALE), logo)
    text(152, 64, 'memoato', font('newsreader', 44, 500))
    text(1120, 78, 'memoato.com', font('dm-sans', 22), '#5f6259', 'rt')
    if title:
        for size in range(86, 47, -2):
            face = font('newsreader', size)
            lines = []
            for word in title.split():
                if not lines or draw.textlength(lines[-1]+' '+word, font=face) > 1040*SCALE:
                    lines.append(word)
                else:
                    lines[-1] += ' '+word
            if len(lines) * size * 1.14 <= 260:
                break
        assert len(lines) * size * 1.14 <= 260, title
        for i, line in enumerate(lines):
            text(80, 208+i*size*1.14, line, face, '#26372f')
        footer = 'The Memoato journal'
    else:
        text(80, 205, 'Memory for life.', font('newsreader', 100))
        text(80, 318, 'Context for AI.', font('newsreader', 100), '#26372f')
        footer = 'Personal memory + source-backed project context'
    draw.line((80*SCALE, 506*SCALE, 1120*SCALE, 506*SCALE), fill='#87937b', width=SCALE)
    text(80, 542, footer, font('dm-sans', 25), '#5f6259')
    target = PUBLIC / 'social' / f'{name}-v2.png'
    image.resize((1200, 630), Image.Resampling.LANCZOS).save(target, optimize=True)
    print(target.relative_to(ROOT))

render('memoato')
shutil.copyfile(PUBLIC / 'social/memoato-v2.png', PUBLIC / 'og.png')
render('journal', 'Notes on building useful memory.')
for post in sorted((ROOT / 'src/pages/blog').glob('*.md')):
    raw = re.search(r'^title:\s*(.+)$', post.read_text(), re.M).group(1)
    render(post.stem, json.loads(raw))
