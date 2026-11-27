#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 tabBar 图标（5 组 × 正常/选中 = 10 个 81×81 PNG）。

为什么自己画：项目里一直是个空的 images/ 目录，app.json 的 tabBar 只有文字。
纯文字 tabBar 在微信里能用，但五个灰字排在一起第一印象很素 —— 而这个项目的
卖点之一就是「能坚持」，视觉是有用的。

不依赖任何图形库（这台机器装不上 Pillow）：自己算覆盖度 + 自己写 PNG。
做法是 4× 超采样：在 324×324 的网格上逐子像素判断「在不在形状内」，
再按 4×4 平均降到 81×81，边缘就是抗锯齿的。

用法：
    python3 tools/gen-tabbar-icons.py            # 重新生成全部图标
输出的文件名由 app.json 的 tabBar 引用，改名要两边一起改。
"""
import os
import struct
import zlib

SIZE = 81          # 微信推荐的 tabBar 图标尺寸
SS = 4             # 超采样倍数
N = 24.0           # 逻辑坐标网格（0..24），画图形时按这个算

NORMAL = (0x8A, 0x94, 0xA6)   # 未选中：和 app.json 的 tabBar.color 一致
ACTIVE = (0x4A, 0x6C, 0xF7)   # 选中：和 tabBar.selectedColor 一致

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'images')


# ---------- 几何谓词：都返回 fn(x, y) -> bool，坐标是逻辑网格 0..24 ----------

def rect(x0, y0, x1, y1):
    return lambda x, y: x0 <= x <= x1 and y0 <= y <= y1


def roundrect(x0, y0, x1, y1, r):
    def f(x, y):
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            return False
        cx = min(max(x, x0 + r), x1 - r)
        cy = min(max(y, y0 + r), y1 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    return f


def circle(cx, cy, r):
    return lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def ring(cx, cy, r, w):
    """圆环（描边圆）。"""
    ri = r - w / 2.0
    ro = r + w / 2.0
    return lambda x, y: ri * ri <= (x - cx) ** 2 + (y - cy) ** 2 <= ro * ro


def seg(x0, y0, x1, y1, w):
    """线段（带线宽），用点到线段的距离判断。"""
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy

    def f(x, y):
        if L2 == 0:
            t = 0.0
        else:
            t = ((x - x0) * dx + (y - y0) * dy) / L2
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
        px, py = x0 + t * dx, y0 + t * dy
        return (x - px) ** 2 + (y - py) ** 2 <= (w / 2.0) ** 2
    return f


def poly(points):
    """多边形填充（射线法）。"""
    pts = list(points)

    def f(x, y):
        inside = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y):
                xin = (xj - xi) * (y - yi) / (yj - yi) + xi
                if x < xin:
                    inside = not inside
            j = i
        return inside
    return f


def arc(cx, cy, r, w, a0, a1):
    """圆弧（角度制，0°=右，顺时针为正，y 轴向下）。"""
    import math
    ri = r - w / 2.0
    ro = r + w / 2.0

    def f(x, y):
        d2 = (x - cx) ** 2 + (y - cy) ** 2
        if not (ri * ri <= d2 <= ro * ro):
            return False
        a = math.degrees(math.atan2(y - cy, x - cx)) % 360
        lo, hi = a0 % 360, a1 % 360
        if lo <= hi:
            return lo <= a <= hi
        return a >= lo or a <= hi
    return f


def union(*fns):
    return lambda x, y: any(f(x, y) for f in fns)


def diff(a, b):
    """a 减去 b（挖空）。"""
    return lambda x, y: a(x, y) and not b(x, y)


# ---------- 五个图标（都在 0..24 的网格里画，留 2 单位边距）----------

def icon_home():
    roof = poly([(12.0, 3.0), (21.4, 11.2), (2.6, 11.2)])
    body = roundrect(5.0, 10.0, 19.0, 20.6, 1.6)
    door = roundrect(9.8, 14.6, 14.2, 20.6, 1.2)
    return diff(union(roof, body), door)


def icon_speak():
    capsule = roundrect(9.2, 2.8, 14.8, 13.2, 2.6)
    bowl = arc(12.0, 10.4, 5.9, 2.0, 12, 168)      # 麦克风下方的弧形
    stem = seg(12.0, 16.3, 12.0, 20.0, 2.0)
    base = seg(8.2, 20.6, 15.8, 20.6, 2.0)
    return union(capsule, bowl, stem, base)


def icon_book():
    # 摊开的书：两页中间留一道缝，缝要够宽（1.8 单位 ≈ 6px）否则小尺寸下糊成一块
    left = poly([(11.1, 6.4), (3.6, 5.0), (3.6, 17.8), (11.1, 19.2)])
    right = poly([(12.9, 6.4), (20.4, 5.0), (20.4, 17.8), (12.9, 19.2)])
    return union(left, right)


def icon_quiz():
    ringf = ring(12.0, 12.0, 8.8, 1.9)
    tick = union(seg(7.6, 12.2, 10.6, 15.2, 1.9), seg(10.6, 15.2, 16.6, 8.8, 1.9))
    return union(ringf, tick)


def icon_stats():
    b1 = roundrect(4.4, 13.4, 8.2, 20.6, 0.9)
    b2 = roundrect(10.1, 8.6, 13.9, 20.6, 0.9)
    b3 = roundrect(15.8, 4.0, 19.6, 20.6, 0.9)
    return union(b1, b2, b3)


ICONS = [
    ('tab-home', icon_home()),
    ('tab-speak', icon_speak()),
    ('tab-learn', icon_book()),
    ('tab-quiz', icon_quiz()),
    ('tab-stats', icon_stats()),
]


# ---------- 渲染 + 写 PNG ----------

def render(pred, rgb):
    """4× 超采样 → 81×81 RGBA 像素。"""
    w = SIZE * SS
    step = N / w
    # 预计算覆盖度
    cov = [[0] * SIZE for _ in range(SIZE)]
    for py in range(w):
        y = (py + 0.5) * step
        for px in range(w):
            x = (px + 0.5) * step
            if pred(x, y):
                cov[py // SS][px // SS] += 1
    maxc = float(SS * SS)
    out = bytearray()
    for row in cov:
        out.append(0)                      # filter type 0
        for c in row:
            a = int(round(255 * c / maxc))
            out += bytes((rgb[0], rgb[1], rgb[2], a))
    return bytes(out)


def write_png(path, raw):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0)   # 8bit RGBA
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def main():
    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    total = 0
    for name, pred in ICONS:
        for suffix, rgb in (('', NORMAL), ('-on', ACTIVE)):
            fn = os.path.join(OUT_DIR, name + suffix + '.png')
            write_png(fn, render(pred, rgb))
            sz = os.path.getsize(fn)
            total += sz
            print('  %-22s %5d B' % (os.path.basename(fn), sz))
    print('✅ 共 10 个图标，合计 %.1f KB' % (total / 1024.0))
    if total > 200 * 1024:
        print('⚠️ 合计超过 200KB，tabBar 图标建议控制在 40KB/个以内')


if __name__ == '__main__':
    main()
