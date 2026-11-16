/**
 * Кадр заставки — точь-в-точь как прошивка (src/splash_view.cpp и lib/core/splashfx.cpp): те же
 * знаки шрифтов (splashFonts.json выгружен из прошивки, tools/sim/export_splash_fonts.py), те же
 * способы появления и та же целочисленная арифметика. Совпадение с прошивкой проверяет
 * tests/splashRender.test.ts по кадрам симулятора (tools/sim/splash_fixture.py).
 */
import {
  LOGO_H, LOGO_W, logoPixel, splashEase, splashParts, type SplashSettings, splashTextAscii,
} from './setup'

/**
 * Знак: [шаг пера, ширина и сдвиг по U8g2 (для ширины слова), x0, y0 точек от пера и линии букв,
 * ширина, высота, точки base64].
 */
export type GlyphRow = [number, number, number, number, number, number, number, string]
export interface SplashFontSize {
  ascent: number
  descent: number
  glyphs: Record<string, GlyphRow>
}
export interface SplashFonts {
  families: SplashFontSize[][]
}

/** Кадр: точка на байт, 1 — светится. */
export class Frame {
  readonly px: Uint8Array
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8Array(w * h)
  }
  get(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[y * this.w + x] === 1
  }
  set(x: number, y: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = 1
  }
  reset(x: number, y: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = 0
  }
}

const trunc = Math.trunc

// --- lib/core/splashfx.cpp ---

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
]

export function fxHash(v: number): number {
  let x = v >>> 0
  x = (x ^ (x >>> 16)) >>> 0
  x = Math.imul(x, 0x7feb352d) >>> 0
  x = (x ^ (x >>> 15)) >>> 0
  x = Math.imul(x, 0x846ca68b) >>> 0
  x = (x ^ (x >>> 16)) >>> 0
  return x
}

export function fxBounce(q: number): number {
  if (q <= 0) return 0
  if (q >= 1000) return 1000
  const f = (x: number, add: number) => trunc((75625 * x * x) / 10000000) + add
  if (q < 364) return f(q, 0)
  if (q < 727) return f(q - 545, 750)
  if (q < 909) return f(q - 818, 938)
  return f(q - 955, 984)
}

interface Content {
  count: number
  text: boolean
  bx: number
  by: number
  bw: number
  bh: number
  draw: (piece: number, rows: boolean, dx: number, dy: number) => void
  span: (piece: number, rows: boolean) => [number, number]
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

function dither(b: Frame, x0: number, y0: number, x1: number, y1: number, p: number) {
  if (p >= 1000) return
  x0 = clamp(x0, 0, b.w)
  x1 = clamp(x1, 0, b.w)
  y0 = clamp(y0, 0, b.h)
  y1 = clamp(y1, 0, b.h)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (trunc((BAYER[y & 7][x & 7] * 1000) / 64) >= p) b.reset(x, y)
    }
  }
}

function compose(out: Frame, c: Content, effect: number, p: number, t: number): number {
  const W = out.w
  const H = out.h
  const aside = () => {
    const src = new Frame(W, H)
    src.px.set(out.px)
    out.px.fill(0)
    return src
  }
  let glow = 1000
  switch (effect) {
    case 1: { // по буквам
      const n = c.count
      for (let i = 0; i < n; i++) {
        const start = n > 1 ? trunc((i * 600) / (n - 1)) : 0
        let q = trunc(((p - start) * 1000) / 400)
        if (q <= 0) continue
        if (q > 1000) q = 1000
        const saved = aside()
        c.draw(i, false, 0, 0)
        const [a, b] = c.span(i, false)
        dither(out, a - c.bh, 0, b + c.bh, H, q)
        for (let k = 0; k < out.px.length; k++) out.px[k] |= saved.px[k]
      }
      break
    }
    case 2: { // выезд снизу
      c.draw(-1, false, 0, trunc(((1000 - p) * (H - c.by)) / 1000))
      break
    }
    case 3: { // раскрытие от центра
      c.draw(-1, false, 0, 0)
      const half = trunc(((trunc(c.bw / 2) + 2) * p) / 1000)
      const mid = c.bx + trunc(c.bw / 2)
      for (let x = 0; x < W; x++) {
        if (x >= mid - half && x < mid + half) continue
        for (let y = 0; y < H; y++) out.reset(x, y)
      }
      break
    }
    case 4: { // печатная машинка
      const rows = !c.text
      const n = c.count
      const shown = trunc((p * n) / 1000)
      for (let i = 0; i < shown; i++) c.draw(i, rows, 0, 0)
      if (n <= 0) break
      if (c.text) {
        if (p >= 1000 && trunc(t / 300) % 2 !== 0) break
        const x = shown < n ? c.span(shown, false)[0] : c.span(n - 1, false)[1]
        const cw = trunc(c.bh / 12) < 2 ? 2 : trunc(c.bh / 12)
        for (let y = c.by; y < c.by + c.bh; y++) {
          for (let xx = x + 1; xx < x + 1 + cw; xx++) out.set(xx, y)
        }
      } else if (p < 1000) {
        const y = shown > 0 ? c.span(shown - 1, true)[1] : c.by
        for (let x = c.bx; x < c.bx + c.bw; x++) {
          out.set(x, y)
          out.set(x, y + 1)
        }
      }
      break
    }
    case 5: { // неон
      const n = c.text ? c.count : 1
      let lit = 0
      for (let i = 0; i < n; i++) {
        const start = n > 1 ? trunc((i * 300) / (n - 1)) : 0
        const q = trunc(((p - start) * 1000) / 700)
        let on: boolean
        if (q >= 1000) on = true
        else if (q <= 0) on = false
        else on = fxHash((i * 7919 + trunc(t / 70)) >>> 0) % 1000 < q
        if (!on) continue
        lit++
        c.draw(c.text ? i : -1, false, 0, 0)
      }
      if (n > 0 && lit < n) glow = 300 + trunc((700 * lit) / n)
      break
    }
    case 6: { // сборка из точек
      c.draw(-1, false, 0, 0)
      const src = aside()
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!src.get(x, y)) continue
          const h = fxHash(y * W + x)
          const sx = h % W
          const sy = (h >>> 16) % H
          out.set(sx + trunc(((x - sx) * p) / 1000), sy + trunc(((y - sy) * p) / 1000))
        }
      }
      break
    }
    case 7: { // рост из центра
      c.draw(-1, false, 0, 0)
      const src = aside()
      if (p <= 0) break
      const cx = c.bx + trunc(c.bw / 2)
      const cy = c.by + trunc(c.bh / 2)
      for (let y = 0; y < H; y++) {
        const sy = cy + trunc(((y - cy) * 1000) / p)
        for (let x = 0; x < W; x++) {
          if (src.get(cx + trunc(((x - cx) * 1000) / p), sy)) out.set(x, y)
        }
      }
      break
    }
    case 8: { // лазерный луч
      c.draw(-1, false, 0, 0)
      if (p >= 1000) break
      const beam = c.bx + trunc(((c.bw + 1) * p) / 1000)
      for (let x = beam; x < W; x++) {
        for (let y = 0; y < H; y++) out.reset(x, y)
      }
      for (let y = 0; y < H; y++) out.set(beam, y)
      const bh = c.bh > 0 ? c.bh : 1
      for (let s = 0; s < 3; s++) {
        const h = fxHash((trunc(t / 40) * 3 + s) >>> 0)
        out.set(beam + 1 + (h % 3), c.by + ((h >>> 8) % bh))
      }
      break
    }
    case 9: { // падение с отскоком
      const n = c.text ? c.count : 1
      for (let i = 0; i < n; i++) {
        const start = n > 1 ? trunc((i * 500) / (n - 1)) : 0
        let q = trunc(((p - start) * 1000) / 500)
        if (q <= 0) continue
        if (q > 1000) q = 1000
        const dy = trunc((-(1000 - fxBounce(q)) * (c.by + c.bh)) / 1000)
        c.draw(c.text ? i : -1, false, 0, dy)
      }
      break
    }
    case 10: { // блик
      c.draw(-1, false, 0, 0)
      if (p < 500) {
        dither(out, 0, 0, W, H, p * 2)
        glow = p * 2
        break
      }
      if (p >= 1000) break
      const band = trunc(c.bh / 3) < 4 ? 4 : trunc(c.bh / 3)
      const pos = trunc(((p - 500) * (c.bw + c.bh + band)) / 500) - band
      for (let y = c.by; y < c.by + c.bh; y++) {
        for (let x = c.bx; x < c.bx + c.bw; x++) {
          const d = x - c.bx + (c.by + c.bh - 1 - y)
          if (d < pos || d >= pos + band) continue
          if (out.get(x, y)) out.reset(x, y)
          else out.set(x, y)
        }
      }
      break
    }
    case 11: { // помехи
      c.draw(-1, false, 0, 0)
      const src = aside()
      const amp = trunc(((1000 - p) * trunc(W / 8)) / 1000)
      const f = trunc(t / 60)
      for (let y = 0; y < H; y++) {
        let dx = 0
        if (p < 1000) {
          const h = fxHash((f * 977 + (y >> 2) * 131 + 1) >>> 0)
          if (amp > 0) dx = (h % (2 * amp + 1)) - amp
          if ((h >>> 12) % 1000 < trunc((1000 - p) / 4)) continue
        }
        for (let x = 0; x < W; x++) {
          if (src.get(x - dx, y)) out.set(x, y)
        }
      }
      break
    }
    default: { // проявление
      c.draw(-1, false, 0, 0)
      dither(out, 0, 0, W, H, p)
      glow = p
      break
    }
  }
  return glow
}

// --- src/splash_view.cpp ---

const decoded = new WeakMap<GlyphRow, Uint8Array>()

function glyphBits(g: GlyphRow): Uint8Array {
  let bits = decoded.get(g)
  if (!bits) {
    const raw = atob(g[7])
    bits = Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
    decoded.set(g, bits)
  }
  return bits
}

function drawGlyph(out: Frame, size: SplashFontSize, code: number, penX: number, baseline: number) {
  const g = size.glyphs[code]
  if (!g || !g[5]) return
  const [, , , x0, y0, w, h] = g
  const bits = glyphBits(g)
  const stride = (w + 7) >> 3
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((bits[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1) out.set(penX + x0 + x, baseline + y0 + y)
    }
  }
}

/**
 * Ширина слова, как getUTF8Width в U8g2: шаги пера, у последнего знака — его ширина со сдвигом, и
 * ещё сдвиг первого, если он больше нуля (U8G2_BALANCED_STR_WIDTH_CALCULATION).
 */
function textWidth(size: SplashFontSize, codes: number[]): number {
  let w = 0
  let dx = 0
  let last: GlyphRow | undefined
  let firstOffset: number | null = null
  for (const code of codes) {
    const g = size.glyphs[code]
    if (!g) continue
    dx = g[0]
    w += dx
    if (firstOffset === null) firstOffset = g[2]
    last = g
  }
  if (last && last[1] !== 0) {
    w = w - dx + last[1] + last[2]
    if (firstOffset !== null && firstOffset > 0) w += firstOffset
  }
  return w
}

function textContent(out: Frame, fonts: SplashFonts, s: SplashSettings): Content {
  const W = out.w
  const H = out.h
  const family = fonts.families[s.font < fonts.families.length && splashTextAscii(s.text) ? s.font : 0]
  const codes = [...s.text].map((ch) => ch.codePointAt(0) ?? 0)
  let size = family[family.length - 1]
  for (const f of family) {
    size = f
    if (textWidth(f, codes) <= W - 6 && f.ascent - f.descent <= H - 4) break
  }
  const w = textWidth(size, codes)
  const x = trunc((W - w) / 2)
  const baseline = trunc((H + size.ascent + size.descent) / 2)
  const pen = [x]
  codes.forEach((code, i) => pen.push(pen[i] + (size.glyphs[code]?.[0] ?? 0)))
  return {
    count: codes.length,
    text: true,
    bx: x,
    bw: w,
    by: baseline - size.ascent,
    bh: size.ascent - size.descent,
    draw: (piece, _rows, dx, dy) => {
      const from = piece < 0 ? 0 : piece
      const to = piece < 0 ? codes.length : piece + 1
      for (let i = from; i < to; i++) drawGlyph(out, size, codes[i], pen[i] + dx, baseline + dy)
    },
    span: (piece) => [pen[piece], pen[piece + 1]],
  }
}

const ceilDiv = (a: number, b: number) => trunc((a + b - 1) / b)
const PIECES = 8

function logoContent(out: Frame, logo: Uint8Array): Content {
  const W = out.w
  const H = out.h
  let dw: number, dh: number
  if (W * LOGO_H <= H * LOGO_W) {
    dw = W
    dh = trunc((W * LOGO_H) / LOGO_W)
  } else {
    dh = H
    dw = trunc((H * LOGO_W) / LOGO_H)
  }
  const ox = trunc((W - dw) / 2)
  const oy = trunc((H - dh) / 2)
  let minX = LOGO_W, maxX = -1, minY = LOGO_H, maxY = -1
  for (let y = 0; y < LOGO_H; y++) {
    for (let x = 0; x < LOGO_W; x++) {
      if (!logoPixel(logo, x, y)) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) {
    minX = minY = 0
    maxX = LOGO_W - 1
    maxY = LOGO_H - 1
  }
  const bx = ox + ceilDiv(minX * dw, LOGO_W)
  const by = oy + ceilDiv(minY * dh, LOGO_H)
  return {
    count: PIECES,
    text: false,
    bx,
    bw: ox + ceilDiv((maxX + 1) * dw, LOGO_W) - bx,
    by,
    bh: oy + ceilDiv((maxY + 1) * dh, LOGO_H) - by,
    draw: (piece, rows, dx, dy) => {
      for (let y = 0; y < dh; y++) {
        const sy = trunc((y * LOGO_H) / dh)
        if (piece >= 0 && rows && trunc(sy / (LOGO_H / PIECES)) !== piece) continue
        for (let x = 0; x < dw; x++) {
          const sx = trunc((x * LOGO_W) / dw)
          if (piece >= 0 && !rows && trunc(sx / (LOGO_W / PIECES)) !== piece) continue
          if (logoPixel(logo, sx, sy)) out.set(ox + x + dx, oy + y + dy)
        }
      }
    },
    span: (piece, rows) => (rows
      ? [oy + ceilDiv(piece * (LOGO_H / PIECES) * dh, LOGO_H), oy + ceilDiv((piece + 1) * (LOGO_H / PIECES) * dh, LOGO_H)]
      : [ox + ceilDiv(piece * (LOGO_W / PIECES) * dw, LOGO_W), ox + ceilDiv((piece + 1) * (LOGO_W / PIECES) * dw, LOGO_W)]),
  }
}

export interface SplashFrame {
  frame: Frame
  glow: number // доля яркости OLED, 0..1000
  done: boolean // заставка кончилась
}

/**
 * Кадр заставки через t мс от её начала на экране w x h. logo — логотип 128x64 (null — нет).
 */
export function renderSplash(fonts: SplashFonts, s: SplashSettings, logo: Uint8Array | null, t: number, w = 128, h = 64): SplashFrame {
  const frame = new Frame(w, h)
  const parts = splashParts(s, logo !== null)
  let local = t
  let at = -1
  for (let i = 0; i < parts.length; i++) {
    const len = parts[i].appearMs + parts[i].holdMs
    if (local < len) {
      at = i
      break
    }
    local -= len
  }
  if (at < 0) return { frame, glow: 1000, done: true }
  const part = parts[at]
  const p = splashEase(part.appearMs, s.smooth, local)
  const content = part.logo && logo ? logoContent(frame, logo) : textContent(frame, fonts, s)
  return { frame, glow: compose(frame, content, part.effect, p, local), done: false }
}
