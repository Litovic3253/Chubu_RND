import { useRef } from 'react'
import { DEFAULT_TUNES, melodyProblems, parseMelody, PRESETS, TUNE_SLOTS } from './core/setup'
import catalog from './core/sounds.json'

export type SoundChoice = 'Пищалка' | 'Усилитель I2S' | 'Без звука'
export type SoundPins = { lrck: string; bck: string; din: string }
export const initialTunes = [...DEFAULT_TUNES]
export const SITE_TUNE_SLOTS = TUNE_SLOTS.filter(slot => !slot.simhub)
let audioContext: AudioContext | undefined
let clipAudio: HTMLAudioElement | undefined

/** Звуки событий — те же ноты и длительности, что принимает прошивка. */
export function playTune(text: string, enabled = true, volume = 6) {
  if (!enabled || !text.trim() || melodyProblems(text).length) return
  audioContext ||= new AudioContext()
  void audioContext.resume()
  let start = audioContext.currentTime + .02
  for (const note of parseMelody(text)) {
    const duration = note.durMs / 1000
    if (note.freq) {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain()
      oscillator.type = 'square'; oscillator.frequency.value = note.freq
      gain.gain.setValueAtTime(Math.max(0, Math.min(10, volume)) * .005, start)
      gain.gain.setValueAtTime(0, start + duration)
      oscillator.connect(gain).connect(audioContext.destination)
      oscillator.start(start); oscillator.stop(start + duration + .01)
    }
    start += duration + note.restMs / 1000
  }
}

const clips = catalog.clips as Record<string, {sound: number; repeats: number}>
export function clipKind(id: number): 'запись I2S' | 'мелодия' | null {
  const clip = clips[String(id)]
  if (!clip) return null
  return catalog.sounds[clip.sound].kind === 2 ? 'мелодия' : 'запись I2S'
}
/** PCM-звуки анимаций извлечены из каталога приложения без изменения частоты и данных. */
export function playClip(id: number, output: SoundChoice, enabled: boolean, volume: number) {
  if (!enabled || output === 'Без звука') return
  const clip = clips[String(id)]
  if (!clip) return
  const sound = catalog.sounds[clip.sound]
  if (sound.kind === 2) { playTune(sound.data, true, volume); return }
  if (sound.kind !== 1 || output !== 'Усилитель I2S') return
  clipAudio?.pause()
  const player = new Audio(sound.data); clipAudio = player
  player.volume = Math.max(0, Math.min(1, volume / 10))
  let left = Math.max(1, clip.repeats)
  player.addEventListener('ended', () => { if (--left > 0) { player.currentTime = 0; void player.play().catch(() => {}) } })
  void player.play().catch(() => {})
}

interface Props {
  output: SoundChoice
  setOutput: (value: SoundChoice) => void
  enabled: boolean
  setEnabled: (value: boolean) => void
  clipsEnabled: boolean
  setClipsEnabled: (value: boolean) => void
  volume: number
  setVolume: (value: number) => void
  tunes: string[]
  setTunes: (value: string[]) => void
  pins: SoundPins
  setPins: (value: SoundPins) => void
}

export function SoundSettings(props: Props) {
  const lastError = useRef<HTMLDivElement>(null)
  const setTune = (id: number, text: string) => props.setTunes(props.tunes.map((old, i) => i === id ? text : old))
  return <section className="card" id="sounds"><div className="card-head"><div><span className="kicker">ЗВУКИ</span><h3>Мелодии событий</h3><p>Выберите готовую мелодию приложения или запишите ноты вручную.</p></div></div>
    <div className="fields"><label>Устройство звука<select value={props.output} onChange={e => props.setOutput(e.target.value as SoundChoice)}><option>Пищалка</option><option>Усилитель I2S</option><option>Без звука</option></select></label><label>Громкость: {props.volume} из 10<input type="range" min="1" max="10" value={props.volume} onChange={e => props.setVolume(Number(e.target.value))}/></label><label className="check-line"><input type="checkbox" checked={props.enabled} onChange={e => props.setEnabled(e.target.checked)}/> Звук включён</label><label className="check-line"><input type="checkbox" checked={props.clipsEnabled} onChange={e => props.setClipsEnabled(e.target.checked)}/> Звуки анимаций Dasai</label></div>
    <p className="muted">Записанные звуки эмоций воспроизводятся через I2S. Пищалка воспроизводит мелодии событий и «Пинг-понг». Прослушивание в браузере приблизительно передаёт звучание пищалки.</p>
    {props.output === 'Усилитель I2S' && <div className="fields i2s-pins">{([['LRCK / WS', 'lrck'], ['BCK / SCK', 'bck'], ['DIN', 'din']] as const).map(([label, key]) => <label key={key}>Пин {label}<select value={props.pins[key]} onChange={event => props.setPins({...props.pins, [key]: event.target.value})}><option value="">Уточним при сборке</option>{[0,1,2,3,4,5,6,7,8,10,20,21].map(pin => <option key={pin} value={String(pin)}>GPIO{pin}</option>)}</select></label>)}</div>}
    <p className="muted">Формат мелодии: нота, длительность и пауза в миллисекундах. Например C5 90 10 E5 90 10 G5 200 0. Пустое поле означает тишину.</p>
    <div className="tune-grid">{SITE_TUNE_SLOTS.map(slot => {
      const text = props.tunes[slot.id] ?? ''
      const errors = melodyProblems(text)
      return <div className="tune-card" key={slot.id}><strong>{slot.title}</strong><p className="muted">{slot.hint}</p><textarea aria-label={`Мелодия: ${slot.title}`} value={text} placeholder="Тишина" onChange={e => setTune(slot.id, e.target.value)}/>
        {errors.length > 0 && <div ref={lastError} role="alert" className="sound-error">{errors.join(' ')}</div>}
        <div className="presets"><button className="subtle" type="button" disabled={!!errors.length} onClick={() => playTune(text, true, props.volume)}>▶ Прослушать</button>{PRESETS.filter(p => p.slots.includes(slot.id)).map(p => <button type="button" className="preset" key={p.title} onClick={() => setTune(slot.id, p.text)}>{p.title}</button>)}<button className="preset" type="button" onClick={() => setTune(slot.id, '')}>Тишина</button></div></div>
    })}</div>
  </section>
}
