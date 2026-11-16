/**
 * Две прошивки в одной программе. SimHub — приборные панели по данным игры, без игры — глазки.
 * Dasai — только глазки и анимации Dasai. У каждой свои разделы, распайка и выбор анимаций.
 */
export type Mode = 'simhub' | 'dasai'

const MODE_KEY = 'pauluk-chubu-mode'

export const MODES: { id: Mode; title: string }[] = [
  { id: 'simhub', title: 'SimHub' },
  { id: 'dasai', title: 'Dasai' },
]

export function parseMode(text: string | null): Mode {
  return text === 'dasai' ? 'dasai' : 'simhub'
}

export function loadMode(): Mode {
  try {
    return parseMode(localStorage.getItem(MODE_KEY))
  } catch {
    return 'simhub'
  }
}

export function saveMode(mode: Mode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // не смогли запомнить — не повод ронять программу
  }
}

/** Что за прошивка на плате по ответу #INFO? (поле kind; прежние прошивки его не присылают — это SimHub). */
export type BoardFirmware = Mode | 'unknown'
