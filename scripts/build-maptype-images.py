"""Small pictures for the Map type picker (Map, Terrain, Satellite, 3D Earth) from NASA textures (three-globe, MIT) and the site's own borders.
Usage: python3 scripts/build-maptype-images.py package/example/img public/data/borders.geojson"""
import sys, json, math
import numpy as np
from PIL import Image, ImageDraw
src = sys.argv[1] if len(sys.argv) > 1 else 'package/example/img'; borders = sys.argv[2] if len(sys.argv) > 2 else 'public/data/borders.geojson'
W, H = 240, 160; out = 'public/img/maptype/'
day = Image.open(f'{src}/earth-blue-marble.jpg').convert('RGB'); topo = Image.open(f'{src}/earth-topology.png').convert('L').resize(day.size)
def box(img, lon0, lon1, lat0, lat1):
    x0, y0 = (lon0 + 180) / 360 * img.width, (90 - lat1) / 180 * img.height; x1, y1 = (lon1 + 180) / 360 * img.width, (90 - lat0) / 180 * img.height
    return img.crop((int(x0), int(y0), int(x1), int(y1))).resize((W, H), Image.LANCZOS)
B = (-25, 75, 5, 65)  # lon0, lon1, lat0, lat1 : Europe, Africa, Middle East
# Satellite
box(day, *B).save(out + 'satellite.jpg', quality=82)
# Terrain: colours by height over a calm blue sea
h = np.asarray(box(topo, *B)).astype(np.float32) / 255; sat = np.asarray(box(day, *B)).astype(np.float32); sea = sat[..., 2] > sat[..., 1] + 25
stops = [(0, (96, 150, 90)), (0.12, (150, 172, 96)), (0.3, (205, 190, 120)), (0.55, (170, 130, 90)), (0.8, (225, 215, 205)), (1, (255, 255, 255))]
def ramp(v):
    r = np.zeros(v.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        m = (v >= a) & (v <= b); t = ((v - a) / (b - a))[..., None]; r = np.where(m[..., None], np.array(ca) * (1 - t) + np.array(cb) * t, r)
    return r
gy, gx = np.gradient(h); shade = np.clip(1 + (gx - gy) * 60, 0.7, 1.3)[..., None]
terr = np.where(sea[..., None], np.array([150, 195, 225], np.float32), ramp(np.clip(h * 1.8, 0, 1)) * shade)
Image.fromarray(np.clip(terr, 0, 255).astype(np.uint8)).save(out + 'terrain.jpg', quality=82)
# Map: the site's own dark political look
im = Image.new('RGB', (W, H), (3, 6, 10)); d = ImageDraw.Draw(im)
def P(lon, lat): return ((lon - B[0]) / (B[1] - B[0]) * W, (B[3] - lat) / (B[3] - B[2]) * H)
cols = [(30, 110, 70), (160, 70, 60), (60, 90, 170), (170, 140, 50), (120, 70, 150), (50, 140, 150)]
for i, f in enumerate(json.load(open(borders))['features']):
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    c = cols[sum(map(ord, f['properties'].get('id', 'x'))) % len(cols)]
    for poly in polys:
        pts = [P(*p) for p in poly[0]]
        if max(x for x, _ in pts) < -20 or min(x for x, _ in pts) > W + 20 or max(y for _, y in pts) < -20 or min(y for _, y in pts) > H + 20: continue
        d.polygon(pts, fill=c, outline=(235, 240, 245))
im.save(out + 'map.jpg', quality=82)
# 3D Earth: a lit globe on a dark sky
bg = np.zeros((H, W, 3), np.float32) + np.array([2, 5, 12], np.float32); rng = np.random.RandomState(5)
for _ in range(90): bg[rng.randint(H), rng.randint(W)] = rng.randint(120, 255)
R = 70; cx, cy = W / 2, H / 2; ys, xs = np.mgrid[0:H, 0:W]; X = (xs - cx) / R; Y = (cy - ys) / R; r2 = X * X + Y * Y; m = r2 <= 1; Z = np.sqrt(np.clip(1 - r2, 0, 1))
lat0 = math.radians(20); lon0 = math.radians(35); y1 = Y * math.cos(lat0) + Z * math.sin(lat0); z1 = -Y * math.sin(lat0) + Z * math.cos(lat0)
lat = np.arcsin(np.clip(y1, -1, 1)); lon = lon0 + np.arctan2(X, z1)
u = (((np.degrees(lon) + 180) % 360) / 360 * day.width).astype(int); v = ((90 - np.degrees(lat)) / 180 * day.height).astype(int)
tex = np.asarray(day).astype(np.float32)[np.clip(v, 0, day.height - 1), np.clip(u, 0, day.width - 1)]
light = np.clip(0.45 + 0.7 * (X * -0.4 + Y * 0.3 + Z * 0.85), 0.25, 1.15)[..., None]; rim = (np.clip(1 - Z, 0, 1) ** 2.5)[..., None] * np.array([40, 110, 220])
bg[m] = np.clip(tex[m] * light[m] + rim[m], 0, 255)
Image.fromarray(bg.astype(np.uint8)).save(out + 'globe.jpg', quality=82)
print('done')
