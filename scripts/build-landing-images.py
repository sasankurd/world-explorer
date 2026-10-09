"""Makes the photos on the front page cards from NASA Earth textures (public domain: Blue Marble and Black Marble).
The textures come from the npm package `three-globe` (MIT) in example/img.  Usage:
  npm pack three-globe && tar xzf three-globe-*.tgz package/example/img   (then)   python3 scripts/build-landing-images.py package/example/img
"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
src = sys.argv[1] if len(sys.argv) > 1 else 'package/example/img'
out = 'public/img/landing/'
W, H = 720, 300
day = Image.open(f'{src}/earth-blue-marble.jpg').convert('RGB')
bright = Image.open(f'{src}/earth-day.jpg').convert('RGB').resize(day.size, Image.LANCZOS)
night = Image.open(f'{src}/earth-night.jpg').convert('RGB')
topo = Image.open(f'{src}/earth-topology.png').convert('L').resize(day.size, Image.LANCZOS)
rnd = random.Random(7)

def lift(im, gain=3.2, gamma=0.7):
    a = np.asarray(im).astype(np.float32) / 255
    a = np.clip((a ** gamma) * gain, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8))

def stars(w, h, n=420):
    im = Image.new('RGB', (w, h), (2, 5, 12)); d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = rnd.randrange(w), rnd.randrange(h); v = rnd.randint(90, 255); d.point((x, y), (v, v, min(255, v + 20)))
    return im

def ll2px(img, lon, lat):
    return ((lon + 180) / 360 * img.width, (90 - lat) / 180 * img.height)

def crop(img, lon0, lon1, lat1, lat0):
    x0, y0 = ll2px(img, lon0, lat0 if lat0 > lat1 else lat1); x1, y1 = ll2px(img, lon1, lat1 if lat0 > lat1 else lat0)
    return img.crop((int(x0), int(y0), int(x1), int(y1))).resize((W, H), Image.LANCZOS)

def globe(tex_day, tex_night, clon, clat, R, cx, cy, sun=(-0.55, 0.25), bg=None):
    """an orthographic picture of the Earth, lit from one side"""
    bg = bg or stars(W, H); out_im = np.asarray(bg).astype(np.float32).copy()
    ys, xs = np.mgrid[0:H, 0:W]; X = (xs - cx) / R; Y = (cy - ys) / R; r2 = X * X + Y * Y; m = r2 <= 1
    Z = np.sqrt(np.clip(1 - r2, 0, 1))
    lat0, lon0 = math.radians(clat), math.radians(clon)
    # rotate the view
    y1 = Y * math.cos(lat0) + Z * math.sin(lat0); z1 = -Y * math.sin(lat0) + Z * math.cos(lat0)
    lat = np.arcsin(np.clip(y1, -1, 1)); lon = lon0 + np.arctan2(X, z1)
    u = ((np.degrees(lon) + 180) % 360) / 360 * tex_day.width; v = (90 - np.degrees(lat)) / 180 * tex_day.height
    ui, vi = np.clip(u.astype(int), 0, tex_day.width - 1), np.clip(v.astype(int), 0, tex_day.height - 1)
    d = np.asarray(tex_day).astype(np.float32)[vi, ui]; n = np.asarray(tex_night).astype(np.float32)[vi, ui]
    sx, sy = sun; sz = math.sqrt(max(0, 1 - sx * sx - sy * sy)); light = X * sx + Y * sy + Z * sz
    t = np.clip((light + 0.12) / 0.3, 0, 1)[..., None]
    col = d * (0.35 + 0.75 * np.clip(light, 0, 1)[..., None]) * t + n * (1 - t)
    rim = np.clip(1 - Z, 0, 1)[..., None] ** 2.2; col = col + rim * np.array([40, 110, 220], np.float32) * 0.9
    out_im[m] = np.clip(col[m], 0, 255)
    im = Image.fromarray(out_im.astype(np.uint8))
    glow = Image.new('RGB', (W, H), (0, 0, 0)); gd = ImageDraw.Draw(glow)
    gd.ellipse((cx - R * 1.03, cy - R * 1.03, cx + R * 1.03, cy + R * 1.03), outline=(70, 150, 255), width=6)
    glow = glow.filter(ImageFilter.GaussianBlur(10)); a = np.asarray(im).astype(np.int32) + np.asarray(glow).astype(np.int32)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def save(im, name):
    im.convert('RGB').save(out + name, quality=80, optimize=True, progressive=True)

nl = lift(night, 4.0, 0.65)
# 1. Live Earth: the Earth half in day, half in night
save(globe(bright, nl, 25, -12, 430, 380, 500, sun=(0.72, 0.12)), 'earth.jpg')

# 2. Country Data: a real picture of Europe, Africa and Asia with a colour layer like a data map
d = crop(bright, -20, 100, 62, 0)
t = np.asarray(crop(topo, -20, 100, 62, 0)).astype(np.float32) / 255
ramp = np.stack([np.clip(t * 2.4, 0, 1) * 255, np.clip(1.2 - abs(t * 2.4 - 0.55) * 2.2, 0, 1) * 200 + 30, np.clip(1 - t * 2.4, 0, 1) * 255], -1)
a = np.asarray(d).astype(np.float32); land = (a[..., 2] < a[..., 1] + 40)[..., None]
mix = np.where(land, a * 0.45 + ramp * 0.55, a * 0.85)
save(Image.fromarray(np.clip(mix, 0, 255).astype(np.uint8)), 'data.jpg')

# 3. Flight Tracker: city lights and a few flight paths
nr = np.asarray(crop(night, -80, 70, 65, 0)).astype(np.float32) / 255
lum = nr.mean(-1, keepdims=True); lights = np.clip((lum - 0.16) * 7, 0, 1)
base = np.array([4, 10, 22], np.float32) + nr * 60
n = Image.fromarray(np.clip(base + lights * np.array([255, 190, 110], np.float32), 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
l = Image.new('RGB', (W, H), (0, 0, 0)); dr = ImageDraw.Draw(l)
def px(lon, lat): return ((lon + 80) / 150 * W, (65 - lat) / 65 * H)
routes = [((-74, 40.7), (-0.1, 51.5)), ((-0.1, 51.5), (55.3, 25.2)), ((29, 41), (44.4, 33.3)), ((-3.7, 40.4), (31.2, 30)), ((-74, 40.7), (2.3, 48.9)), ((12.5, 41.9), (55.3, 25.2))]
for (a_, b_) in routes:
    (x0, y0), (x1, y1) = px(*a_), px(*b_); cxm, cym = (x0 + x1) / 2, (y0 + y1) / 2 - abs(x1 - x0) * 0.22
    pts = [((1 - s) ** 2 * x0 + 2 * (1 - s) * s * cxm + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * cym + s * s * y1) for s in [i / 60 for i in range(61)]]
    dr.line(pts, fill=(80, 190, 255), width=2)
    for p in (pts[0], pts[-1]): dr.ellipse((p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4), fill=(200, 240, 255))
    q = pts[34]; dr.ellipse((q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5), fill=(255, 255, 255))
lg = l.filter(ImageFilter.GaussianBlur(5)); res = np.clip(np.asarray(n).astype(np.int32) + np.asarray(lg).astype(np.int32) * 2 + np.asarray(l).astype(np.int32), 0, 255)
save(Image.fromarray(res.astype(np.uint8)), 'flights.jpg')

# 4. Historical Maps: an old map look (sepia paper, grid, dark edges)
g = np.asarray(crop(bright, -30, 70, 62, 10).convert('L')).astype(np.float32) / 255
paper = np.array([226, 200, 150], np.float32); ink = np.array([92, 62, 30], np.float32)
land = (np.asarray(crop(bright, -30, 70, 62, 10)).astype(np.float32)); isl = (land[..., 2] < land[..., 1] + 25)
edge = np.asarray(Image.fromarray((isl * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255
tone = np.where(isl[..., None], paper * (0.62 + 0.25 * g[..., None]), paper * 1.04) - edge[..., None] * 70
grain = np.random.RandomState(3).normal(0, 4, (H, W, 1)); tone = tone + grain
im = Image.fromarray(np.clip(tone, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
for i in range(0, W, 60): dr.line((i, 0, i, H), fill=(150, 112, 70), width=1)
for j in range(0, H, 60): dr.line((0, j, W, j), fill=(150, 112, 70), width=1)
yy, xx = np.mgrid[0:H, 0:W]; vig = 1 - 0.55 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.4
save(Image.fromarray(np.clip(np.asarray(im).astype(np.float32) * vig[..., None], 0, 255).astype(np.uint8)), 'history.jpg')

# 5. Play: a bright Earth turned towards the Americas, with a purple glow
p = globe(day, nl, -60, -15, 400, 360, 520, sun=(0.45, 0.35))
pa = np.asarray(p).astype(np.float32); grad = np.linspace(0, 1, W)[None, :, None]
pa = pa + grad * np.array([60, 10, 120], np.float32) * (np.linspace(1, 0.2, H)[:, None, None])
save(Image.fromarray(np.clip(pa, 0, 255).astype(np.uint8)), 'play.jpg')

# 6. Distance & measure: the real Middle East with a route between two pins
m_ = crop(bright, 24, 64, 42, 24).resize((W, H), Image.LANCZOS); dm = ImageDraw.Draw(m_)
def p2(lon, lat): return ((lon - 24) / 40 * W, (42 - lat) / 18 * H)
A, B = p2(35.2, 31.8), p2(55.3, 25.2)
for k in range(0, 100, 2):
    s0, s1 = k / 100, (k + 1) / 100; dm.line(((A[0] + (B[0] - A[0]) * s0, A[1] + (B[1] - A[1]) * s0 - math.sin(s0 * math.pi) * 40), (A[0] + (B[0] - A[0]) * s1, A[1] + (B[1] - A[1]) * s1 - math.sin(s1 * math.pi) * 40)), fill=(255, 255, 255), width=4)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception: f = ImageFont.load_default()
for (pt, ch) in ((A, 'A'), (B, 'B')):
    y = pt[1] - (0 if ch == 'A' else 0)
    dm.ellipse((pt[0] - 17, y - 17, pt[0] + 17, y + 17), fill=(82, 214, 255), outline=(255, 255, 255), width=3); dm.text((pt[0] - 7, y - 14), ch, fill=(2, 18, 28), font=f)
mm = np.asarray(m_).astype(np.float32) * np.array([0.8, 0.95, 1.0]); save(Image.fromarray(np.clip(mm, 0, 255).astype(np.uint8)), 'measure.jpg')
print('done')
