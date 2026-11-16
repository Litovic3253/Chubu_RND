/**
 * Протокол платы SimHub OLED без работы с портом: экраны, строки команд, разбор ответов, снимок
 * экрана, имитация заезда. Команды платы (src/main.cpp): #CFG2?, #CFG2;…, #PAGES?, #PAGES;маска,
 * #PAGE;N, #SHOT. Прошивка, знавшая только OLED, понимает #CFG? и #CFG;… — для неё legacyConfigLine.
 */
export const ESPRESSIF_VID = 0x303a
/** 9 — кнопка BOOT, 18/19 — USB, 11–17 — память платы. */
export const USABLE_PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 20, 21]
export const NO_PIN = -1

/** Экран, с которым умеет работать прошивка. Порядок и номера — как в lib/core/screen.h. */
export interface DisplayInfo {
  id: number
  title: string
  hint: string
  bus: 'i2c' | 'spi'
  /** Размер при повороте 0° */
  width: number
  height: number
  round: boolean
}

export const DISPLAYS: DisplayInfo[] = [
  { id: 0, title: 'OLED 0.96" 128×64 (SSD1306)', hint: 'Маленький монохромный экран, шина I2C', bus: 'i2c', width: 128, height: 64, round: false },
  { id: 1, title: 'OLED 1.3" 128×64 (SH1106)', hint: 'Если на SSD1306 картинка сдвинута и сбоку мусор', bus: 'i2c', width: 128, height: 64, round: false },
  { id: 2, title: 'TFT 1.77" 128×160 (ST7735)', hint: 'Цветной прямоугольный экран, шина SPI', bus: 'spi', width: 128, height: 160, round: false },
  { id: 3, title: 'TFT 2.0" 240×320 (ST7789)', hint: 'Цветной прямоугольный экран, шина SPI', bus: 'spi', width: 240, height: 320, round: false },
  { id: 4, title: 'Круглый TFT 1.28" 240×240 (GC9A01)', hint: 'Цветной круглый экран, шина SPI', bus: 'spi', width: 240, height: 240, round: true },
]

/** Поворот в четвертях оборота, как его хранит плата. */
export const ROTATIONS = [
  { turns: 0, title: '0°' },
  { turns: 1, title: '90°' },
  { turns: 2, title: '180°' },
  { turns: 3, title: '270°' },
]

/**
 * Типы свечения цветных экранов; номер — как в прошивке (lib/core/theme.h). Одноцветные рисуют
 * всё цветом rgb («чёрный» — чёрное на белом фоне). У цветных (multi) цвета у элементов разные:
 * «как в SimHub» — у каждой панели своя палитра, близкая к панели-образцу; «своя» — одна палитра на
 * все панели. rgb у них — для значка. Тип можно выбрать и в меню на самом устройстве.
 */
export const COLORS: { title: string; rgb: [number, number, number]; multi?: 'simhub' | 'custom'; inverted?: boolean }[] = [
  { title: 'Белый', rgb: [255, 255, 255] },
  { title: 'Жёлто-оранжевый', rgb: [255, 172, 0] },
  { title: 'Зелёный', rgb: [0, 255, 64] },
  { title: 'Голубой', rgb: [0, 229, 255] },
  { title: 'Красный', rgb: [255, 48, 48] },
  { title: 'Жёлтый', rgb: [255, 235, 0] },
  { title: 'Цветная, как в SimHub', rgb: [255, 60, 30], multi: 'simhub' },
  { title: 'Цветная, своя', rgb: [255, 176, 0], multi: 'custom' },
  { title: 'Чёрный (на белом фоне)', rgb: [0, 0, 0], inverted: true },
  { title: 'Красно-оранжевый', rgb: [255, 83, 20] },
  { title: 'Оранжевый', rgb: [255, 128, 0] },
  { title: 'Жёлто-зелёный', rgb: [170, 240, 0] },
  { title: 'Синий', rgb: [40, 90, 255] },
  { title: 'Сине-фиолетовый', rgb: [110, 70, 255] },
  { title: 'Фиолетовый', rgb: [170, 60, 255] },
  { title: 'Красно-фиолетовый', rgb: [240, 40, 180] },
]

/** Порядок типов в списке — как в меню устройства (kThemeMenuOrder): белый, чёрный, цвета по кругу, цветные. */
export const COLOR_ORDER = [0, 8, 4, 9, 10, 1, 5, 11, 2, 3, 12, 13, 14, 15, 6, 7]

const displayOf = (id: number): DisplayInfo => DISPLAYS.find((d) => d.id === id) ?? DISPLAYS[0]

/** Какие повороты доступны: маленький OLED боком не ставится — панели в столбик не помещаются. */
export function rotationsOf(display: number): number[] {
  return displayOf(display).bus === 'i2c' ? [0, 2] : [0, 1, 2, 3]
}

/** Размер экрана так, как его видит зритель после поворота. */
export function screenSize(display: number, rotation: number): { width: number; height: number; round: boolean } {
  const d = displayOf(display)
  const sideways = rotation % 2 === 1 && d.bus === 'spi'
  return { width: sideways ? d.height : d.width, height: sideways ? d.width : d.height, round: d.round }
}

/** Что к чему подключено. Пины шины, которой у выбранного экрана нет, хранятся, но не используются. */
export interface BoardConfig {
  display: number
  rotation: number
  sda: number
  scl: number
  sck: number
  mosi: number
  cs: number
  dc: number
  rst: number
  bl: number
  touch: number
  led: number
  buzzer: number
  color: number
  /** Своя палитра для типа «Цветная, своя»: 5 цветов 0xRRGGBB (PALETTE_ROLES); нет — по умолчанию. */
  palette?: number[]
}

/** Тип свечения «Цветная, своя» — цвета задаёт пользователь (#PALETTE). */
export const THEME_CUSTOM = 7

/** Что красит каждый цвет своей палитры — порядок как в прошивке (lib/core/theme.h). */
export const PALETTE_ROLES = [
  { title: 'Значения', hint: 'цифры и значения на панелях' },
  { title: 'Подписи', hint: 'мелкие подписи' },
  { title: 'Рамки', hint: 'рамки, линии, деления шкал' },
  { title: 'Акцент', hint: 'передача, плашки, полоса меню, глазки и анимации Dasai, заставка' },
  { title: 'Шкалы', hint: 'заполнение шкал' },
]

export const DEFAULT_PALETTE = [0xffffff, 0x6ec8ff, 0x78879b, 0xffb000, 0xffb000]

export const paletteValid = (p: unknown): p is number[] =>
  Array.isArray(p) && p.length === PALETTE_ROLES.length && p.every((v) => Number.isInteger(v) && v >= 0 && v <= 0xffffff)

export const paletteOf = (c: BoardConfig): number[] => (paletteValid(c.palette) ? c.palette : DEFAULT_PALETTE)

export const colorHex = (v: number) => `#${v.toString(16).padStart(6, '0')}`

export function paletteLine(p: number[]): string {
  return `#PALETTE;${p.map((v) => v.toString(16).padStart(6, '0').toUpperCase()).join(';')}`
}

/** "PALETTE;RRGGBB;…" или "PALETTE OK;…" -> пять цветов. */
export function parsePalette(reply: string): number[] {
  const m = /^PALETTE(?: OK)?;((?:[0-9A-Fa-f]{6};){4}[0-9A-Fa-f]{6})\s*$/m.exec(reply)
  if (!m) throw new Error(`Плата ответила не палитрой: ${JSON.stringify(reply.slice(0, 60))}`)
  return m[1].split(';').map((h) => parseInt(h, 16))
}

/** Распайка опорного устройства; пины SPI — те, что на ESP32-C3 SuperMini подписаны как SPI. */
export const DEFAULT_BOARD: BoardConfig = {
  display: 0, rotation: 0, sda: 20, scl: 21, sck: 4, mosi: 6, cs: 7, dc: 10, rst: 5, bl: NO_PIN, touch: 2, buzzer: 3, led: 1, color: 0,
}

export function configLine(c: BoardConfig): string {
  return `#CFG2;${[c.display, c.rotation, c.sda, c.scl, c.sck, c.mosi, c.cs, c.dc, c.rst, c.bl, c.touch, 1, c.buzzer, c.color, c.led].join(';')}`
}

/** Строка настроек для прошивки, которая знает только OLED; для цветного экрана её нет. */
export function legacyConfigLine(c: BoardConfig): string | null {
  if (displayOf(c.display).bus !== 'i2c' || c.display !== displayOf(c.display).id) return null
  return `#CFG;${c.sda};${c.scl};${c.touch};1;${c.buzzer};${c.rotation === 2 ? 1 : 0};${c.display === 1 ? 1 : 0}`
}

/** Пины, которые использует выбранный экран, плюс сенсор и пищалка: [название, пин, можно ли без него]. */
export function usedPins(c: BoardConfig): [string, number, boolean][] {
  const screen: [string, number, boolean][] = displayOf(c.display).bus === 'i2c'
    ? [['экран SDA', c.sda, false], ['экран SCL', c.scl, false]]
    : [['экран SCK', c.sck, false], ['экран MOSI', c.mosi, false], ['экран CS', c.cs, true], ['экран DC', c.dc, false],
      ['экран RST', c.rst, true], ['подсветка', c.bl, true]]
  return [...screen, ['сенсор', c.touch, true], ['пищалка', c.buzzer, true], ['светодиод', c.led, true]]
}

/** Почему такую распайку нельзя записать. Пустой список — всё в порядке. */
export function configProblems(c: BoardConfig): string[] {
  const named = usedPins(c)
  const found: string[] = []
  if (!DISPLAYS.some((d) => d.id === c.display)) found.push('Не выбран экран.')
  else if (!rotationsOf(c.display).includes(c.rotation)) found.push('Этот экран так повернуть нельзя.')
  for (const [name, pin, optional] of named) {
    if (pin === NO_PIN) {
      if (!optional) found.push(`Не указан пин: ${name}.`)
    } else if (!USABLE_PINS.includes(pin)) {
      found.push(`GPIO${pin} использовать нельзя (${name}).`)
    }
  }
  const used = new Map<number, string>()
  for (const [name, pin] of named) {
    if (pin === NO_PIN) continue
    const other = used.get(pin)
    if (other) found.push(`GPIO${pin} занят дважды: ${other} и ${name}.`)
    else used.set(pin, name)
  }
  return found
}

/** Разбирает ответ платы: «CFG2;…» / «CFG2 OK;…» или, от прошивки только для OLED, «CFG;…» / «CFG OK;…». */
export function parseConfig(reply: string): BoardConfig {
  for (const raw of reply.split(/\r?\n/)) {
    const parts = raw.trim().split(';')
    const n = parts.slice(1).map(Number)
    if (!n.every(Number.isInteger)) continue
    if ((parts[0] === 'CFG2' || parts[0] === 'CFG2 OK') && (parts.length === 15 || parts.length === 16)) {
      return {
        display: n[0], rotation: n[1], sda: n[2], scl: n[3], sck: n[4], mosi: n[5], cs: n[6], dc: n[7], rst: n[8], bl: n[9],
        touch: n[10], buzzer: n[12], color: n[13], led: n[14] ?? 1,
      }
    }
    if ((parts[0] === 'CFG' || parts[0] === 'CFG OK') && parts.length === 8) {
      return { ...DEFAULT_BOARD, sda: n[0], scl: n[1], touch: n[2], buzzer: n[4], rotation: n[5] === 1 ? 2 : 0, display: n[6] === 1 ? 1 : 0 }
    }
  }
  throw new Error(`Плата ответила не настройками: ${JSON.stringify(reply.slice(0, 60))}`)
}

type Rgb = [number, number, number]

/**
 * Кадр с экрана устройства: точки строками слева направо сверху вниз. Значение точки — 0 (не
 * светится) или номер краски + 1. palette — цвета красок; null — экран одноцветный (OLED).
 */
export interface Shot {
  width: number
  height: number
  pixels: Uint8Array
  palette: Rgb[] | null
}

const rgb565 = (c: number): Rgb => {
  const r = c >> 11, g = (c >> 5) & 0x3f, b = c & 0x1f
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)]
}

/** «SHOT;hex» — буфер OLED 128×64: ряды высотой 8 точек, байт — столбик, младший бит сверху. */
function decodeMono(hex: string): Shot | null {
  const width = 128, height = 64
  if (hex.length !== (width * height) / 4 || !/^[0-9a-fA-F]+$/.test(hex)) return null
  const pixels = new Uint8Array(width * height)
  for (let row = 0; row < height / 8; row++) {
    for (let x = 0; x < width; x++) {
      const at = (row * width + x) * 2
      const column = parseInt(hex.slice(at, at + 2), 16)
      for (let bit = 0; bit < 8; bit++) if ((column >> bit) & 1) pixels[(row * 8 + bit) * width + x] = 1
    }
  }
  return { width, height, pixels, palette: null }
}

/**
 * «SHOTC;ширина;высота;палитра;серии» — цветной кадр. Палитра — RGB565 по 4 hex-цифры на краску.
 * Серии (lib/core/shotcodec.h): байт VN — значение V, N точек; байт V0 и байт L — значение V, L + 16 точек.
 */
function decodeColour(parts: string[]): Shot | null {
  const width = Number(parts[1]), height = Number(parts[2])
  const paletteHex = parts[3] ?? '', runs = parts[4] ?? ''
  const sane = Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 480 && height <= 480
    && width % 8 === 0 && height % 8 === 0
  if (!sane || paletteHex.length % 4 !== 0 || !/^[0-9a-fA-F]+$/.test(paletteHex) || runs.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(runs)) return null
  const palette: Rgb[] = []
  for (let i = 0; i < paletteHex.length; i += 4) palette.push(rgb565(parseInt(paletteHex.slice(i, i + 4), 16)))
  const pixels = new Uint8Array(width * height)
  let n = 0
  for (let i = 0; i < runs.length; i += 2) {
    const byte = parseInt(runs.slice(i, i + 2), 16)
    let run = byte & 0x0f
    if (run === 0) {
      i += 2
      if (i >= runs.length) return null // серия оборвана
      run = parseInt(runs.slice(i, i + 2), 16) + 16
    }
    if (n + run > pixels.length) return null
    pixels.fill(byte >> 4, n, n + run)
    n += run
  }
  return n === pixels.length ? { width, height, pixels, palette } : null
}

/** Ответ на #SHOT: «SHOT;…» — одноцветный экран 128×64, «SHOTC;…» — цветной экран любого размера. */
export function decodeShot(reply: string): Shot {
  for (const raw of reply.split(/\r?\n/)) {
    const line = raw.trim()
    const shot = line.startsWith('SHOTC;') ? decodeColour(line.split(';')) : line.startsWith('SHOT;') ? decodeMono(line.slice(5)) : undefined
    if (shot) return shot
    if (shot === null) break
  }
  throw new Error('Плата не прислала снимок экрана')
}

/** Кадр → пиксели RGBA для canvas. У цветного кадра цвета свои; одноцветный рисуется цветом rgb. */
export function shotToRgba(shot: Shot, rgb: Rgb = [255, 255, 255]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(shot.pixels.length * 4)
  for (let p = 0; p < shot.pixels.length; p++) {
    const value = shot.pixels[p]
    const i = p * 4
    if (value) {
      const colour = shot.palette ? (shot.palette[value - 1] ?? [255, 0, 255]) : rgb
      out[i] = colour[0]
      out[i + 1] = colour[1]
      out[i + 2] = colour[2]
    }
    out[i + 3] = 255
  }
  return out
}

const SIM_MAX_RPM = 8500
const SIM_LAP_SECONDS = 15
const SIM_GEAR_SECONDS = 2.5 // столько длится разгон на одной передаче
const SIM_GEARS = 6
/**
 * Полный цикл имитации в секундах: один круг, за который машина разгоняется на каждой из
 * передач до отсечки. Столько на проверке показывается одна панель при автоматическом листании.
 */
export const SIM_CYCLE_SECONDS = SIM_LAP_SECONDS

/**
 * Строка телеметрии на момент t секунд от начала теста. Одинакова при одинаковом t:
 * разгон по передачам до отсечки, круги по 15 секунд, выдуманная трасса и греющиеся шины.
 */
export function simLine(t: number): string {
  const gear = (Math.floor(t / SIM_GEAR_SECONDS) % SIM_GEARS) + 1
  const phase = (t / SIM_GEAR_SECONDS) % 1
  const rpm = Math.floor(3200 + (SIM_MAX_RPM * 1.02 - 3200) * phase)
  const speed = Math.floor((rpm / SIM_MAX_RPM) * 46 * gear)

  const lap = Math.floor(t / SIM_LAP_SECONDS) + 1
  const u = (t / SIM_LAP_SECONDS) % 1
  const curMs = Math.floor(u * SIM_LAP_SECONDS * 1000)
  const lastMs = lap === 1 ? 0 : SIM_LAP_SECONDS * 1000 + (lap % 4) * 137
  const bestMs = lap === 1 ? 0 : SIM_LAP_SECONDS * 1000
  const deltaMs = Math.trunc(Math.sin(t / 3) * 1500)

  const a = 2 * Math.PI * u
  const x = Math.round(1000 + 400 * Math.cos(a) + 120 * Math.cos(3 * a))
  const z = Math.round(-500 + 250 * Math.sin(a) + 80 * Math.sin(2 * a))
  const heat = Math.min(1, t / 60)
  const temps = [2, 4, -1, 0].map((d) => Math.round(60 + 30 * heat + d))
  const press = [1, 3, -4, -3].map((d) => Math.round(260 + 15 * heat + d))
  const wear = [1, 2, 0, 0].map((d) => Math.round(100 - 12 * heat - d))

  return '$' + [gear, speed, rpm, SIM_MAX_RPM, curMs, lastMs, bestMs, deltaMs, lap, 20, 3,
    4242, Math.round(u * 1000), x, z, ...temps, ...press, ...wear].join(';')
}

/** Соперники для имитации: слот, позиция, отрыв (мс), лучший круг (мс), имя. Игрок — третий. */
const SIM_RIVALS: [number, number, number, number, string][] = [
  [2, 0, 0, 0, ''],
  [1, 1, -4150, 14710, 'VERSTAPPEN'],
  [0, 2, -850, 14980, 'Norris'],
  [3, 4, 620, 15120, 'Leclerc'],
  [4, 5, 3900, 15340, 'Alonso'],
  [5, 6, 12050, 15800, 'Hamilton'],
]

/**
 * Кадр имитации целиком: основная строка simLine и дополнительные данные ("&..."), которые в
 * игре шлёт формула SimHub, — чтобы на проверке были живыми и панели с топливом, педалями,
 * перегрузками, секторами, соперниками, грузовиком и компьютером.
 */
export function simFrame(t: number): string {
  const phase = (t / SIM_GEAR_SECONDS) % 1
  const u = (t / SIM_LAP_SECONDS) % 1
  const heat = Math.min(1, t / 60)
  // Перед переключением — короткое торможение, остальное время газ в пол.
  const braking = phase > 0.9
  const throttle = braking ? 0 : Math.round(60 + 40 * phase)
  const brake = braking ? 80 : 0
  const gLong = braking ? -140 : Math.round(70 - 50 * phase)
  const gLat = Math.round(Math.sin(2 * Math.PI * u * 3) * 180)
  const fuel10 = Math.max(0, 420 - Math.round(t * 2))
  const car = [Math.round(78 + 16 * heat), Math.round(88 + 20 * heat), fuel10, Math.round(fuel10 / 6.5),
    Math.round(fuel10 / 2.65), 265, Math.round((fuel10 / 2.65) * 1.5), throttle, brake, 0, gLong, gLat, 3, 2, 24, 31,
    Math.round(throttle * 0.7), 0, 0, 287, SIM_LAP_SECONDS * 1000, Math.max(0, 1800 - Math.floor(t)), 565, 0]
  const sector = Math.min(3, Math.floor(u * 3) + 1)
  const sectors = [sector, 5020, Math.trunc(Math.sin(t / 5) * 300), Math.trunc(Math.cos(t / 7) * 400),
    sector > 1 ? 5020 : 0, sector > 2 ? 4980 : 0, 0, 5040, 4990, 5010, 5000, 4950, 4990]
  const wobble = Math.trunc(Math.sin(t / 4) * 400)
  const clock = new Date()
  return [
    simLine(t),
    '&C;' + car.join(';'),
    '&S;' + sectors.join(';'),
    ...SIM_RIVALS.map(([slot, pos, gap, best, name]) => `&R;${slot};${pos};${pos ? gap + wobble : 0};${best};${name}`),
    `&T;90;${Math.floor(t) % 2};0;${Math.max(0, 134 - Math.floor(t / 60))};412;3;11;0;Rotterdam`,
    `&P;${Math.round(55 + 10 * heat)};${Math.round(35 + 20 * phase)};54;${Math.round(60 + 12 * heat)};92;1450;144;${clock.getHours()};${clock.getMinutes()}`,
  ].join('\n')
}