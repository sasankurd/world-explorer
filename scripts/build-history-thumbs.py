"""A small picture for every history snapshot: NASA Blue Marble (three-globe, MIT) darkened, with that era's countries and peoples coloured on top.
Usage: python3 scripts/build-history-thumbs.py package/example/img   -> public/img/history/<snapshot>.jpg"""
import sys, json, colorsys, os
import numpy as np
from PIL import Image, ImageDraw
src = sys.argv[1] if len(sys.argv) > 1 else 'package/example/img'
W, H, SS = 220, 110, 3
LON0, LON1, LAT0, LAT1 = -170, 190, -58, 82          # a little wider than Europe-Africa-Asia-Americas, no Antarctica
out = 'public/img/history/'; os.makedirs(out, exist_ok=True)
base = Image.open(f'{src}/earth-blue-marble.jpg').convert('RGB')
def crop(img):
    # the picture wraps around the date line: shift so lon -170..190 is contiguous
    w, h = img.size; x0 = int((LON0 + 180) / 360 * w)
    wide = Image.new('RGB', (w * 2, h)); wide.paste(img, (0, 0)); wide.paste(img, (w, 0))
    return wide.crop((x0, int((90 - LAT1) / 180 * h), x0 + int((LON1 - LON0) / 360 * w), int((90 - LAT0) / 180 * h))).resize((W * SS, H * SS), Image.LANCZOS)
back = (np.asarray(crop(base)).astype(float) * 0.42 + np.array([6, 12, 24]) * 0.58)
back = Image.fromarray(back.astype(np.uint8)).convert('RGBA')
px = lambda lon, lat: ((lon - LON0 if lon >= LON0 else lon + 360 - LON0) / (LON1 - LON0) * W * SS, (LAT1 - lat) / (LAT1 - LAT0) * H * SS)
idx = json.load(open('public/data/history/index.json'))
for s in idx:
    d = json.load(open('public/data/history/' + s['file']))
    fill = Image.new('RGBA', back.size, (0, 0, 0, 0)); g = ImageDraw.Draw(fill)
    for f in d['features']:
        p = f['properties']; h = p.get('h', -1)
        if h < 0: continue
        r, gg, b = colorsys.hls_to_rgb(h / 360, 0.52 + 0.1 * (p.get('v', 0) - 0.5), 0.6)
        polys = f['geometry']['coordinates'] if f['geometry']['type'] == 'MultiPolygon' else [f['geometry']['coordinates']]
        for poly in polys:
            for k, ring in enumerate(poly):
                pts = [px(x, y) for x, y in ring]
                if k == 0: g.polygon(pts, fill=(int(r * 255), int(gg * 255), int(b * 255), 170), outline=(235, 244, 255, 200))
    im = Image.alpha_composite(back, fill).convert('RGB').resize((W, H), Image.LANCZOS)
    im.save(out + s['file'].replace('.json', '.jpg'), quality=80)
print('wrote', len(idx), 'pictures')
