import type { BoardFirmware } from './mode'
/**
 * Раздел «Настройка»: анимации, звуки и железо — то, что веб-настройщик The Mochi делает для своей
 * прошивки, в формате этой прошивки (lib/core/look.h, lib/core/melody.h, команды в src/main.cpp).
 * Здесь только данные и проверки; связь с платой — src/board/link.ts.
 */
import { type BoardConfig, DISPLAYS, NO_PIN, USABLE_PINS } from './board'

// --- Анимации и язык: "#LOOK;speed;pause;invert;idle;intro;touch;double;lang" ---

/** Глазки в покое: номер эмоции — показывают её время от времени, или: */
/** Остались с версии, где кроме Dasai были свои эмоции; плата понимает их как «случайные». */
export const IDLE_RANDOM_DASAI = -3
export const IDLE_RANDOM = -2 // случайные эмоции
export const IDLE_CALM = -1 // только моргают
/** Касание, двойное касание, включение: номер эмоции, или: */
export const ACTION_RANDOM_DASAI = -4
export const ACTION_NEXT = -3 // следующая эмоция по списку
export const ACTION_RANDOM = -2 // случайная
export const ACTION_NONE = -1 // ничего
export const LANG_EN = 0
export const LANG_RU = 1

export interface LookSettings {
  speed: number // скорость анимаций, 50..200 %
  pause: number // пауза между случайными эмоциями, 0..60 с
  invert: boolean
  idle: number
  intro: number
  touch: number
  doubleTouch: number
  lang: number
  brightness: number // яркость экрана, 1..10 (то же — в меню на устройстве)
}

export const DEFAULT_LOOK: LookSettings = {
  speed: 100, pause: 10, invert: false, idle: IDLE_RANDOM, intro: ACTION_NONE, touch: ACTION_RANDOM, doubleTouch: ACTION_NEXT, lang: LANG_EN,
  brightness: 10,
}

export function lookLine(l: LookSettings): string {
  return `#LOOK;${[l.speed, l.pause, l.invert ? 1 : 0, l.idle, l.intro, l.touch, l.doubleTouch, l.lang, l.brightness].join(';')}`
}

/** Числа из ответа «<tag>;…» или «<tag> OK;…» с ровно count полями. */
function replyNumbers(reply: string, tag: string, count: number): number[] | null {
  for (const raw of reply.split(/\r?\n/)) {
    const parts = raw.trim().split(';')
    if ((parts[0] !== tag && parts[0] !== `${tag} OK`) || parts.length !== count + 1) continue
    const n = parts.slice(1).map(Number)
    if (n.every(Number.isInteger)) return n
  }
  return null
}

export function parseLook(reply: string): LookSettings {
  // Прошивки до настройки яркости отвечают восемью полями — яркость у них полная.
  const n = replyNumbers(reply, 'LOOK', 9) ?? replyNumbers(reply, 'LOOK', 8)
  if (!n) throw new Error(`Плата ответила не настройками анимаций: ${JSON.stringify(reply.slice(0, 60))}`)
  // «Случайные Dasai» прежней версии — теперь просто «случайные»: других эмоций нет.
  const random = (v: number, old: number) => (v === old ? IDLE_RANDOM : v)
  return {
    speed: n[0], pause: n[1], invert: n[2] === 1, idle: random(n[3], IDLE_RANDOM_DASAI), intro: n[4],
    touch: random(n[5], ACTION_RANDOM_DASAI), doubleTouch: random(n[6], ACTION_RANDOM_DASAI), lang: n[7],
    brightness: n[8] ?? 10,
  }
}

export function lookProblems(l: LookSettings, emotionCount: number): string[] {
  const found: string[] = []
  const emotionOr = (v: number, lowest: number) => Number.isInteger(v) && v >= lowest && v < emotionCount
  if (!(l.speed >= 50 && l.speed <= 200)) found.push('Скорость анимаций — от 50 до 200%.')
  if (!(l.pause >= 0 && l.pause <= 60)) found.push('Пауза между эмоциями — от 0 до 60 секунд.')
  if (!emotionOr(l.idle, IDLE_RANDOM_DASAI)) found.push('Не выбрано, что глазки делают в покое.')
  if (!emotionOr(l.intro, ACTION_NONE)) found.push('При включении можно показать только эмоцию или ничего.')
  if (!emotionOr(l.touch, ACTION_RANDOM_DASAI) || !emotionOr(l.doubleTouch, ACTION_RANDOM_DASAI)) found.push('Не выбрано действие касания.')
  if (l.lang !== LANG_EN && l.lang !== LANG_RU) found.push('Нет такого языка.')
  if (!(Number.isInteger(l.brightness) && l.brightness >= 1 && l.brightness <= 10)) found.push('Яркость экрана — от 1 до 10.')
  return found
}

// --- Звук: "#SOUND;out;volume;lrck;bck;din;clips;on" ---

export const SOUND_NONE = 0
export const SOUND_BUZZER = 1
export const SOUND_I2S = 2

export interface SoundSettings {
  out: number
  volume: number // 1..10
  lrck: number
  bck: number
  din: number
  clips: boolean // звуки анимаций Dasai: WAV — только на усилитель I2S, мелодии — и на пищалку
  on: boolean // звук включён (то же — в меню на устройстве)
}

export const DEFAULT_SOUND: SoundSettings = { out: SOUND_BUZZER, volume: 10, lrck: NO_PIN, bck: NO_PIN, din: NO_PIN, clips: true, on: true }

export function soundLine(s: SoundSettings): string {
  return `#SOUND;${[s.out, s.volume, s.lrck, s.bck, s.din, s.clips ? 1 : 0, s.on ? 1 : 0].join(';')}`
}

/** Прошивки до звуков анимаций отвечают пятью полями — тогда звуки считаются включёнными. */
export function parseSound(reply: string): SoundSettings {
  const n = replyNumbers(reply, 'SOUND', 7) ?? replyNumbers(reply, 'SOUND', 6) ?? replyNumbers(reply, 'SOUND', 5)
  if (!n) throw new Error(`Плата ответила не настройками звука: ${JSON.stringify(reply.slice(0, 60))}`)
  return { out: n[0], volume: n[1], lrck: n[2], bck: n[3], din: n[4], clips: n.length < 6 || n[5] === 1, on: n.length < 7 || n[6] === 1 }
}

/** Пины, занятые платой: шина выбранного экрана, сенсор, пищалка — [название, пин]. */
function takenPins(b: BoardConfig): [string, number][] {
  const spi = DISPLAYS.find((d) => d.id === b.display)?.bus === 'spi'
  const screen: [string, number][] = spi
    ? [['экран SCK', b.sck], ['экран MOSI', b.mosi], ['экран CS', b.cs], ['экран DC', b.dc], ['экран RST', b.rst], ['подсветка', b.bl]]
    : [['экран SDA', b.sda], ['экран SCL', b.scl]]
  return [...screen, ['сенсор', b.touch], ['пищалка', b.buzzer]]
}

export function soundProblems(s: SoundSettings, b: BoardConfig): string[] {
  const found: string[] = []
  if (![SOUND_NONE, SOUND_BUZZER, SOUND_I2S].includes(s.out)) found.push('Не выбрано, чем звучать.')
  if (!(Number.isInteger(s.volume) && s.volume >= 1 && s.volume <= 10)) found.push('Громкость — от 1 до 10.')
  if (s.out === SOUND_BUZZER && b.buzzer === NO_PIN) {
    found.push('Не указан пин пищалки: он задаётся в разделе «Прошивка», «Подключение».')
  }
  if (s.out === SOUND_I2S) {
    const pins: [string, number][] = [['LRCK', s.lrck], ['BCLK', s.bck], ['DIN', s.din]]
    const used = new Map<number, string>()
    for (const [name, pin] of pins) {
      if (pin === NO_PIN) found.push(`Не указан пин усилителя: ${name}.`)
      else if (!USABLE_PINS.includes(pin)) found.push(`GPIO${pin} использовать нельзя (усилитель ${name}).`)
      else if (used.has(pin)) found.push(`GPIO${pin} занят дважды: усилитель ${used.get(pin)} и ${name}.`)
      else used.set(pin, name)
    }
    for (const [name, pin] of takenPins(b)) {
      if (pin !== NO_PIN && used.has(pin)) found.push(`GPIO${pin} уже занят: ${name} и усилитель ${used.get(pin)}.`)
    }
  }
  return found
}

// --- Мелодии: "#TUNE;slot;notes" ---

/**
 * События со звуком — номера как в прошивке (enum Tune в src/main.cpp). simhub — только у прошивки
 * SimHub OLED (у Dasai нет игры и приборки). Прошивка до новых событий знает только первые пять.
 */
export const TUNE_SLOTS: { id: number; title: string; hint: string; simhub?: boolean }[] = [
  { id: 0, title: 'При включении', hint: 'Играет, когда плата включается, и пока на заставке появляется слово.' },
  { id: 1, title: 'Шифт-пойнт', hint: 'Обороты дошли до отсечки — пора переключаться.', simhub: true },
  { id: 2, title: 'Касание', hint: 'Одно касание сенсора.' },
  { id: 3, title: 'Двойное касание', hint: 'Два касания подряд.' },
  { id: 4, title: 'Удержание', hint: 'Сенсор держат полторы секунды — открывается меню (если у «Открытия меню» нет своей мелодии).' },
  { id: 5, title: 'Появление логотипа', hint: 'На заставке появляется логотип. Пусто, а логотип первый — играет «При включении».' },
  { id: 6, title: 'Открытие меню', hint: 'Удержанием открыли меню настроек на устройстве.' },
  { id: 7, title: 'Сохранение настроек', hint: 'В меню выбран пункт «Сохранить».' },
  { id: 8, title: 'Выход без сохранения', hint: 'В меню выбран «Назад», или меню закрылось само через 30 секунд.' },
  { id: 9, title: 'Листание меню', hint: 'В меню: другой пункт или другое значение. Пусто — у громкости короткий писк.' },
  { id: 10, title: 'Игра пошла', hint: 'От SimHub пошли данные, показалась приборка.', simhub: true },
  { id: 11, title: 'Игра пропала', hint: 'Данные от SimHub перестали приходить, вернулись глазки.', simhub: true },
  { id: 12, title: 'Смена страницы', hint: 'Касанием перелистнули страницу приборки. Пусто — играет «Касание».', simhub: true },
]

/** Сколько событий знает прошивка до новых звуков. */
export const LEGACY_TUNES = 5

/** Как было до настроек: на шифт-пойнте короткий писк около 3 кГц, остальное — тихо. */
export const DEFAULT_TUNES = ['', 'G7 80 0', '', '', '', '', '', '', '', '', '', '', '']

/** Самая длинная строка, которую принимает плата (lib/core/protocol.h). */
const MAX_LINE = 400
const MAX_NOTES = 64
const MAX_MS = 5000

/** Мелодия в одну строку, пробелы между словами — по одному. */
const oneLine = (text: string) => text.trim().split(/[\s,]+/).filter(Boolean).join(' ')

export function tuneLine(slot: number, text: string): string {
  return `#TUNE;${slot};${oneLine(text)}`
}

export function parseTune(reply: string): { slot: number; text: string } {
  for (const raw of reply.split(/\r?\n/)) {
    const m = /^TUNE(?: OK)?;(\d+);(.*)$/.exec(raw.replace(/\r$/, ''))
    if (m) return { slot: Number(m[1]), text: m[2].trim() }
  }
  throw new Error(`Плата ответила не мелодией: ${JSON.stringify(reply.slice(0, 60))}`)
}

export interface Note {
  freq: number
  durMs: number
  restMs: number
}

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function noteFreq(token: string): number | null {
  if (/^[PR]$/i.test(token)) return 0
  const m = /^([A-Ga-g])(#?)(\d)([Ss]?)$/.exec(token)
  if (!m || (m[2] && m[4])) return null
  const octave = Number(m[3])
  if (octave > 8) return null
  const midi = (octave + 1) * 12 + SEMITONE[m[1].toUpperCase()] + (m[2] || m[4] ? 1 : 0)
  return Math.round(440 * 2 ** ((midi - 69) / 12))
}

/** Ноты мелодии или описание первой ошибки — так же, как разбирает прошивка (lib/core/melody.cpp). */
function parse(text: string): { notes: Note[]; error: string | null } {
  const words = text.split(/[\s,]+/).filter(Boolean)
  const notes: Note[] = []
  for (let i = 0; i < words.length; i += 3) {
    const [note, dur, rest] = words.slice(i, i + 3)
    const n = notes.length + 1
    const freq = noteFreq(note)
    if (freq === null) return { notes, error: `Нота ${n}: «${note}» — не нота. Пишите как C4, D4S или D#4, паузу — P.` }
    if (dur === undefined) return { notes, error: `Нота ${n}: после «${note}» нужны длительность и пауза в миллисекундах.` }
    if (!/^\d{1,5}$/.test(dur) || Number(dur) < 1 || Number(dur) > MAX_MS) return { notes, error: `Нота ${n}: длительность «${dur}» — нужно от 1 до ${MAX_MS} мс.` }
    if (rest === undefined) return { notes, error: `Нота ${n}: после длительности нужна пауза (можно 0).` }
    if (!/^\d{1,5}$/.test(rest) || Number(rest) > MAX_MS) return { notes, error: `Нота ${n}: пауза «${rest}» — нужно от 0 до ${MAX_MS} мс.` }
    notes.push({ freq, durMs: Number(dur), restMs: Number(rest) })
  }
  return { notes, error: null }
}

export function parseMelody(text: string): Note[] {
  const { notes, error } = parse(text)
  if (error) throw new Error(error)
  return notes
}

export function melodyProblems(text: string): string[] {
  const found: string[] = []
  const { notes, error } = parse(text)
  if (error) found.push(error)
  else if (notes.length > MAX_NOTES) found.push(`Нот ${notes.length}, а плата запоминает не больше ${MAX_NOTES}.`)
  const length = tuneLine(0, text).length
  if (length > MAX_LINE) found.push(`Мелодия длиннее, чем плата принимает за раз: ${length} символов из ${MAX_LINE}.`)
  return found
}

/** Готовые мелодии — свои. slots — для каких событий они уместны. */
export const PRESETS: { title: string; text: string; slots: number[] }[] = [
  { title: 'Старт', text: 'C5 90 10 E5 90 10 G5 90 10 C6 240 0', slots: [0, 5, 10] },
  { title: 'Мотор', text: 'C3 60 10 E3 60 10 G3 60 10 C4 60 10 E4 60 10 G4 200 0', slots: [0, 5, 10] },
  { title: 'Позывной', text: 'G5 120 40 G5 120 40 D6 300 0', slots: [0, 5] },
  { title: 'Стартовые огни', text: 'A5 150 350 A5 150 350 A5 150 350 A6 500 0', slots: [0, 10] },
  { title: 'Писк', text: 'G7 80 0', slots: [1] },
  { title: 'Двойной', text: 'A6 60 40 A6 60 0', slots: [1, 6] },
  { title: 'Тройной', text: 'E7 50 30 E7 50 30 E7 50 0', slots: [1] },
  { title: 'Нарастающий', text: 'C6 40 0 E6 40 0 G6 40 0 C7 80 0', slots: [1, 6, 10] },
  { title: 'Щелчок', text: 'C7 15 0', slots: [2, 3, 4, 9, 12] },
  { title: 'Пинг', text: 'E7 60 0', slots: [2, 3, 4, 6, 9, 12] },
  { title: 'Капля', text: 'G6 30 0 C6 60 0', slots: [2, 3, 4, 8, 11] },
  { title: 'Вверх', text: 'C6 50 10 G6 80 0', slots: [2, 3, 4, 6, 7, 12] },
  { title: 'Вниз', text: 'G6 50 10 C6 80 0', slots: [2, 3, 4, 8, 11] },
  // Новые
  { title: 'Турбо', text: 'C5 25 0 E5 25 0 G5 25 0 C6 25 0 E6 25 0 G6 25 0 C7 160 0', slots: [0, 5, 10] },
  { title: 'Фанфары', text: 'G5 110 20 C6 110 20 E6 110 20 G6 260 80 E6 110 20 G6 420 0', slots: [0, 5, 7] },
  { title: 'Подтверждение', text: 'E6 70 30 A6 160 0', slots: [6, 7, 2, 3] },
  { title: 'Отмена', text: 'A6 70 30 E6 160 0', slots: [8, 11, 2, 3] },
  { title: 'Клаксон', text: 'A4 160 70 A4 320 0', slots: [0, 5, 10, 11] },
]

// --- Сведения о плате: "INFO;mac;built;emotions;pages;kind" (kind — simhub или dasai; прежние прошивки
// его не присылают, это всегда SimHub OLED) ---

export interface BoardInfo {
  mac: string
  built: string
  emotions: number
  pages: number
  firmware: BoardFirmware
}

export function parseInfo(reply: string): BoardInfo {
  for (const raw of reply.split(/\r?\n/)) {
    const parts = raw.trim().split(';')
    if (parts[0] === 'INFO' && (parts.length === 5 || parts.length === 6)) {
      const kind = parts[5] ?? 'simhub'
      return {
        mac: parts[1], built: parts[2], emotions: Number(parts[3]), pages: Number(parts[4]),
        firmware: kind === 'simhub' || kind === 'dasai' ? kind : 'unknown',
      }
    }
  }
  throw new Error('Плата не прислала сведений о себе')
}


// --- Заставка при включении: "#SPLASH;вкл;способ;появление мс;плавность;держать мс;шрифт;что показывать;
// способ логотипа;появление логотипа мс;держать логотип мс;слово" (lib/core/splash.h) ---

/** Способы появления — номера как в прошивке (SplashEffect). Работают и для слова, и для логотипа. */
export const SPLASH_EFFECTS = [
  { id: 0, title: 'Проявление', hint: 'точки появляются постепенно, на OLED ещё и плавно растёт яркость' },
  { id: 1, title: 'По буквам', hint: 'буквы проявляются одна за другой (логотип — полосами слева направо)' },
  { id: 2, title: 'Выезд снизу', hint: 'плавно выезжает снизу и встаёт по центру' },
  { id: 3, title: 'Раскрытие от центра', hint: 'открывается от середины к краям' },
  { id: 4, title: 'Печатная машинка', hint: 'буквы печатаются по одной с мигающим курсором (логотип — строками сверху вниз)' },
  { id: 5, title: 'Неоновая вывеска', hint: 'загорается с перебоями, мигает и потом горит ровно' },
  { id: 6, title: 'Сборка из точек', hint: 'точки слетаются со всего экрана и складываются в рисунок' },
  { id: 7, title: 'Рост из центра', hint: 'увеличивается из маленькой точки до полного размера' },
  { id: 8, title: 'Лазерный луч', hint: 'луч проходит слева направо и оставляет за собой рисунок' },
  { id: 9, title: 'Падение с отскоком', hint: 'буквы падают сверху одна за другой и подпрыгивают (логотип — целиком)' },
  { id: 10, title: 'Блик', hint: 'проявляется, и по нему наискосок пробегает блестящая полоса' },
  { id: 11, title: 'Помехи (глитч)', hint: 'дёргается, строки съезжают, потом всё становится чётким' },
]

/** Шрифты слова — номера как в прошивке (src/splash_view.cpp). Русские буквы есть только в первом. */
export const SPLASH_FONTS = [
  { id: 0, title: 'Обычный', hint: 'моноширинный, есть русские буквы' },
  { id: 1, title: 'Спорт', hint: 'высокий узкий, как на приборах' },
  { id: 2, title: 'Жирный', hint: 'широкий и плотный' },
  { id: 3, title: 'Тонкий', hint: 'лёгкий, без засечек' },
  { id: 4, title: 'С засечками', hint: 'классический, жирный' },
  { id: 5, title: 'Курсив', hint: 'наклонный, с засечками' },
  { id: 6, title: 'Пишущая машинка', hint: 'жирный моноширинный' },
  { id: 7, title: 'Пиксельный', hint: 'крупные квадратные точки' },
  { id: 8, title: 'Контурный', hint: 'буквы обведены, внутри пусто' },
]

export const SHOW_WORD = 0
export const SHOW_LOGO = 1
export const SHOW_WORD_LOGO = 2
export const SHOW_LOGO_WORD = 3

export const SPLASH_SHOWS = [
  { id: SHOW_WORD, title: 'Только слово' },
  { id: SHOW_LOGO, title: 'Только логотип' },
  { id: SHOW_WORD_LOGO, title: 'Слово, потом логотип' },
  { id: SHOW_LOGO_WORD, title: 'Логотип, потом слово' },
]

export const SPLASH_TEXT_MAX = 48 // байт UTF-8, как в прошивке (kSplashTextMax)

export interface SplashSettings {
  on: boolean
  effect: number
  appearMs: number // за сколько появляется слово, 100..10000
  smooth: number // плавность 1..10 (у слова и логотипа одна)
  holdMs: number // сколько держится слово, 0..10000
  text: string
  font: number
  show: number
  logoEffect: number
  logoAppearMs: number
  logoHoldMs: number
}

export const DEFAULT_SPLASH: SplashSettings = {
  on: false, effect: 0, appearMs: 1500, smooth: 8, holdMs: 1500, text: '',
  font: 0, show: SHOW_WORD, logoEffect: 0, logoAppearMs: 1500, logoHoldMs: 1500,
}

export function splashLine(s: SplashSettings): string {
  const n = [s.on ? 1 : 0, s.effect, s.appearMs, s.smooth, s.holdMs, s.font, s.show, s.logoEffect, s.logoAppearMs, s.logoHoldMs]
  return `#SPLASH;${n.join(';')};${s.text}`
}

/** Строка для прошивки до шрифтов и логотипа: пять чисел и слово. */
export function splashLineV1(s: SplashSettings): string {
  return `#SPLASH;${[s.on ? 1 : 0, Math.min(s.effect, 3), s.appearMs, s.smooth, s.holdMs].join(';')};${s.text}`
}

/**
 * "SPLASH;…" или "SPLASH OK;…": десять чисел, затем слово до конца строки; у прошивки до шрифтов и
 * логотипа — пять чисел (extended: false, остальное — по умолчанию).
 */
export function parseSplashReply(reply: string): { splash: SplashSettings; extended: boolean } {
  for (const raw of reply.split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '')
    const m = /^SPLASH(?: OK)?;((?:\d+;){10}|(?:\d+;){5})(.*)$/.exec(line)
    if (!m) continue
    const v = m[1].split(';').filter(Boolean).map(Number)
    const s: SplashSettings = { ...DEFAULT_SPLASH, on: v[0] === 1, effect: v[1], appearMs: v[2], smooth: v[3], holdMs: v[4], text: m[2] }
    if (v.length === 10) {
      Object.assign(s, { font: v[5], show: v[6], logoEffect: v[7], logoAppearMs: v[8], logoHoldMs: v[9] })
    }
    return { splash: s, extended: v.length === 10 }
  }
  throw new Error(`Плата ответила не настройками заставки: ${JSON.stringify(reply.slice(0, 60))}`)
}

export function parseSplash(reply: string): SplashSettings {
  return parseSplashReply(reply).splash
}

/** Знак, которого нет в шрифте заставки (латиница, цифры и знаки ASCII, кириллица; «;» нельзя), или null. */
export function splashBadChar(text: string): string | null {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    const ascii = code >= 0x20 && code <= 0x7e && ch !== ';'
    const cyrillic = code >= 0x400 && code <= 0x45f
    if (!ascii && !cyrillic) return ch
  }
  return null
}

/** Только латиница, цифры и знаки — они есть во всех шрифтах; иначе слово рисуется «Обычным». */
export const splashTextAscii = (text: string) => [...text].every((ch) => (ch.codePointAt(0) ?? 0) < 0x80)

export const splashShowsWord = (s: SplashSettings) => s.show !== SHOW_LOGO
export const splashShowsLogo = (s: SplashSettings) => s.show !== SHOW_WORD

/** Ошибки, с которыми записывать нельзя. hasLogo — логотип загружен (в программу или на плату). */
export function splashProblems(s: SplashSettings, hasLogo = true): string[] {
  const found: string[] = []
  const bytes = new TextEncoder().encode(s.text).length
  const bad = splashBadChar(s.text)
  if (s.on && splashShowsWord(s) && !s.text.trim()) found.push('Заставка включена, а слово не задано.')
  if (s.on && s.show === SHOW_LOGO && !hasLogo) found.push('Заставка — только логотип, а он не загружен.')
  if (bad) found.push(`Знак «${bad}» на экране не нарисовать: можно латиницу, кириллицу, цифры и знаки препинания (кроме «;»).`)
  if (bytes > SPLASH_TEXT_MAX) found.push(`Слово длинновато: до ${SPLASH_TEXT_MAX} латинских или ${SPLASH_TEXT_MAX / 2} русских букв.`)
  if (!SPLASH_EFFECTS.some((e) => e.id === s.effect)) found.push('Не выбрано, как появляется слово.')
  if (!SPLASH_EFFECTS.some((e) => e.id === s.logoEffect)) found.push('Не выбрано, как появляется логотип.')
  if (!SPLASH_FONTS.some((f) => f.id === s.font)) found.push('Не выбран шрифт.')
  if (!SPLASH_SHOWS.some((f) => f.id === s.show)) found.push('Не выбрано, что показывать.')
  if (!(s.appearMs >= 100 && s.appearMs <= 10000)) found.push('Появление — от 0,1 до 10 секунд.')
  if (!(s.logoAppearMs >= 100 && s.logoAppearMs <= 10000)) found.push('Появление логотипа — от 0,1 до 10 секунд.')
  if (!(s.smooth >= 1 && s.smooth <= 10)) found.push('Плавность — от 1 до 10.')
  if (!(s.holdMs >= 0 && s.holdMs <= 10000)) found.push('Держать — от 0 до 10 секунд.')
  if (!(s.logoHoldMs >= 0 && s.logoHoldMs <= 10000)) found.push('Держать логотип — от 0 до 10 секунд.')
  return found
}

/** Предупреждения: записать можно, но выйдет не совсем то, что выбрано. */
export function splashNotes(s: SplashSettings, hasLogo: boolean): string[] {
  const notes: string[] = []
  if (s.font !== 0 && s.text && !splashTextAscii(s.text)) {
    notes.push(`В шрифте «${SPLASH_FONTS[s.font]?.title}» нет русских букв — слово будет показано шрифтом «Обычный».`)
  }
  if (s.on && (s.show === SHOW_WORD_LOGO || s.show === SHOW_LOGO_WORD) && !hasLogo) {
    notes.push('Логотип не загружен — будет только слово.')
  }
  return notes
}

/** Доля появления 0..1000 через t мс — как splashEase в прошивке: мягко и ступенями по плавности. */
export function splashEase(appearMs: number, smooth: number, t: number): number {
  if (t >= appearMs) return 1000
  const x = Math.trunc((t * 1000) / (appearMs || 1))
  const eased = Math.trunc((3 * x * x * 1000 - 2 * x * x * x) / 1000000)
  const steps = 2 + Math.trunc(((Math.min(10, Math.max(1, smooth)) - 1) * 62) / 9)
  const level = Math.trunc((eased * steps) / 1000)
  return Math.trunc((level * 1000) / steps)
}

export function splashProgress(s: SplashSettings, t: number): number {
  return splashEase(s.appearMs, s.smooth, t)
}

export interface SplashPart {
  logo: boolean
  effect: number
  appearMs: number
  holdMs: number
}

/** Куски заставки, как в прошивке (splashParts): слово — если задано, логотип — если загружен. */
export function splashParts(s: SplashSettings, hasLogo: boolean): SplashPart[] {
  const word = { logo: false, effect: s.effect, appearMs: s.appearMs, holdMs: s.holdMs }
  const logo = { logo: true, effect: s.logoEffect, appearMs: s.logoAppearMs, holdMs: s.logoHoldMs }
  const hasWord = s.text.length > 0
  const order = s.show === SHOW_LOGO ? [logo] : s.show === SHOW_WORD_LOGO ? [word, logo] : s.show === SHOW_LOGO_WORD ? [logo, word] : [word]
  return order.filter((p) => (p.logo ? hasLogo : hasWord))
}

export function splashLength(s: SplashSettings, hasLogo: boolean): number {
  return splashParts(s, hasLogo).reduce((sum, p) => sum + p.appearMs + p.holdMs, 0)
}

// --- Логотип заставки: 128x64, 1 бит на точку; "#LOGO;смещение;hex" кусками по 128 байт, "#LOGO!;crc32" ---

export const LOGO_W = 128
export const LOGO_H = 64
export const LOGO_BYTES = (LOGO_W * LOGO_H) / 8
export const LOGO_CHUNK = 128

export const logoPixel = (logo: Uint8Array, x: number, y: number) => ((logo[y * (LOGO_W / 8) + (x >> 3)] >> (7 - (x & 7))) & 1) === 1

export const logoEmpty = (logo: Uint8Array) => logo.every((b) => b === 0)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

/** CRC-32, как zlib и прошивка (dasaiCrc32). */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const hex = (data: Uint8Array) => Array.from(data, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')

/** Команды записи логотипа: куски и подтверждение. */
export function logoLines(logo: Uint8Array): string[] {
  const lines: string[] = []
  for (let off = 0; off < LOGO_BYTES; off += LOGO_CHUNK) lines.push(`#LOGO;${off};${hex(logo.subarray(off, off + LOGO_CHUNK))}`)
  lines.push(`#LOGO!;${crc32(logo)}`)
  return lines
}

/** "LOGO;есть;crc32" -> есть ли логотип на плате и его crc32. */
export function parseLogoInfo(reply: string): { has: boolean; crc: number } {
  const m = /^LOGO;([01]);(\d+)\s*$/m.exec(reply)
  if (!m) throw new Error(`Плата ответила не про логотип: ${JSON.stringify(reply.slice(0, 60))}`)
  return { has: m[1] === '1', crc: Number(m[2]) }
}

/** "LOGO;смещение;hex" -> байты куска. */
export function parseLogoChunk(reply: string, off: number): Uint8Array {
  const m = new RegExp(`^LOGO;${off};([0-9A-Fa-f]{${LOGO_CHUNK * 2}})\\s*$`, 'm').exec(reply)
  if (!m) throw new Error(`Плата прислала не тот кусок логотипа: ${JSON.stringify(reply.slice(0, 60))}`)
  const out = new Uint8Array(LOGO_CHUNK)
  for (let i = 0; i < LOGO_CHUNK; i++) out[i] = parseInt(m[1].slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Что в картинке считать рисунком (светится на экране). */
export const LOGO_INK_DARK = 0 // тёмное на светлом
export const LOGO_INK_LIGHT = 1 // светлое на тёмном
export const LOGO_INK_OPAQUE = 2 // непрозрачное (PNG с прозрачным фоном)

export interface LogoTuning {
  ink: number
  threshold: number // 1..254
  dither: boolean // растр — для фото и плавных переходов
}

/** Насколько точка — рисунок (0..255) по её цвету и прозрачности. */
function inkOf(r: number, g: number, b: number, a: number, ink: number): number {
  const lum = (r * 299 + g * 587 + b * 114) / 1000
  if (ink === LOGO_INK_OPAQUE) return a
  if (ink === LOGO_INK_LIGHT) return (lum * a) / 255 // прозрачное — как чёрное
  return 255 - (lum * a + 255 * (255 - a)) / 255 // прозрачное — как белое
}

/**
 * Картинка 128x64 (RGBA, уже вписанная) -> логотип 1 бит на точку. По порогу или растром
 * (Флойд — Штейнберг), чтобы передать полутона.
 */
export function logoFromRgba(rgba: Uint8ClampedArray | Uint8Array, t: LogoTuning): Uint8Array {
  const v = new Float32Array(LOGO_W * LOGO_H)
  for (let i = 0; i < v.length; i++) v[i] = inkOf(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3], t.ink)
  const out = new Uint8Array(LOGO_BYTES)
  for (let y = 0; y < LOGO_H; y++) {
    for (let x = 0; x < LOGO_W; x++) {
      const i = y * LOGO_W + x
      const on = v[i] >= t.threshold
      if (on) out[y * (LOGO_W / 8) + (x >> 3)] |= 0x80 >> (x & 7)
      if (!t.dither) continue
      const err = v[i] - (on ? 255 : 0)
      if (x + 1 < LOGO_W) v[i + 1] += (err * 7) / 16
      if (y + 1 < LOGO_H) {
        if (x > 0) v[i + LOGO_W - 1] += (err * 3) / 16
        v[i + LOGO_W] += (err * 5) / 16
        if (x + 1 < LOGO_W) v[i + LOGO_W + 1] += err / 16
      }
    }
  }
  return out
}

/** Что считать рисунком, если не сказано: есть прозрачность — непрозрачное; край светлый — тёмное. */
export function guessLogoInk(rgba: Uint8ClampedArray | Uint8Array): number {
  let transparent = 0
  let opaque = 0
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 128) transparent++
    else opaque++
  }
  if (transparent > 0 && opaque > 0 && transparent > rgba.length / 4 / 20) return LOGO_INK_OPAQUE
  let light = 0
  let edge = 0
  for (let y = 0; y < LOGO_H; y++) {
    for (let x = 0; x < LOGO_W; x++) {
      if (x > 1 && x < LOGO_W - 2 && y > 1 && y < LOGO_H - 2) continue
      const i = (y * LOGO_W + x) * 4
      edge++
      if ((rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000 >= 128) light++
    }
  }
  return light * 2 >= edge ? LOGO_INK_DARK : LOGO_INK_LIGHT
}
