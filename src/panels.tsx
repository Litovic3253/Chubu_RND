import type { Dispatch, SetStateAction } from 'react'
import emotions from '../assets/emotions.json'
import { SPLASH_FONTS, SPLASH_EFFECTS, type SplashSettings } from './core/setup'
import { SoundSettings, type SoundChoice, type SoundPins } from './sound'
import { SplashScreen, FontChoices, LogoUpload } from './splash'
import type { Key, Settings } from './main'

type Timing = Pick<SplashSettings, 'appearMs' | 'holdMs' | 'smooth' | 'logoEffect' | 'logoAppearMs' | 'logoHoldMs'>
type ActionKey = 'idle' | 'intro' | 'touch' | 'double'
type Preview = { id: number; message: string; splash: boolean; seq: number }
interface Props {
  settings: Settings; set: (key: Key, value: string) => void; pickAction: (key: ActionKey, value: string) => void
  splash: SplashSettings; setTiming: Dispatch<SetStateAction<Timing>>; logo: Uint8Array | null; logoName: string; setLogo: (logo: Uint8Array | null, name: string, file: File | null) => void
  soundOn: boolean; setSoundOn: (value: boolean) => void; clipsOn: boolean; setClipsOn: (value: boolean) => void
  output: SoundChoice; setOutput: (value: SoundChoice) => void; volume: number; setVolume: (value: number) => void
  tunes: string[]; setTunes: (value: string[]) => void; invert: boolean; setInvert: (value: boolean) => void
  pins: SoundPins; setPins: (value: SoundPins) => void
  preview: Preview; showAction: (key: 'touch' | 'double') => void; showSplash: () => void; summary: string[][]
}
const gif = (id: number) => `./assets/dasai/${String(id).padStart(2, '0')}-${emotions[id].name}.gif`
const actionOptions = ['Случайная эмоция', 'Следующая эмоция', 'Ничего', ...emotions.map(e => e.title)]
function ActionPicker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const emotion = emotions.find(item => item.title === value)
  return <div className="action-picker"><div className="action-preview">{emotion ? <img src={gif(emotion.index)} alt={`Эмоция ${emotion.title}`}/> : <span>{value === 'Ничего' ? '—' : value === 'Следующая эмоция' ? 'по порядку' : value === 'Только обычные глазки' ? 'моргают' : 'случайно'}</span>}</div><label>{label}<select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select></label></div>
}

export function ConfigurationPanels(p: Props) {
  const { settings: s, splash } = p
  const field = (label: string, key: Key, options: string[]) => <label>{label}<select name={key} value={s[key]} onChange={e => p.set(key, e.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
  const slider = (label: string, key: keyof Timing, min: number, max: number, step = 100) => <label>{label}: {key === 'smooth' ? `${splash[key]} из 10` : `${(splash[key] / 1000).toFixed(1)} с`}<input type="range" min={min} max={max} step={step} value={splash[key]} onChange={e => p.setTiming(v => ({...v, [key]: Number(e.target.value)}))}/></label>
  return <>
    <section className="card" id="settings"><div className="card-head"><div><span className="kicker">НАСТРОЙКИ</span><h3>Добавьте индивидуальности</h3><p>OLED 0,96″ и плата ESP32-C3.</p></div></div>
      <div className="fields">{field('Цвет экрана OLED 0,96″', 'display', ['Белый', 'Синий'])}{field('Язык меню', 'language', ['Русский', 'English'])}
        <label>Скорость анимаций: {s.speed}%<input name="speed" type="range" min="50" max="200" step="10" value={s.speed} onChange={e => p.set('speed', e.target.value)}/></label>
        <label>Пауза между случайными эмоциями: {s.pause} с<input name="pause" type="range" min="0" max="60" value={s.pause} onChange={e => p.set('pause', e.target.value)}/></label>
        <label>Яркость экрана: {s.brightness} из 10<input name="brightness" type="range" min="1" max="10" value={s.brightness} onChange={e => p.set('brightness', e.target.value)}/></label>
        <label className="check-line"><input type="checkbox" checked={p.invert} onChange={e => p.setInvert(e.target.checked)}/> Негатив — тёмное по светлому</label></div>
      <div className="divider"/><div className="card-head compact"><div><span className="kicker">ЧТО ПОКАЗЫВАТЬ</span><h3>Реакции Чубу</h3></div></div>
      <div className="fields"><ActionPicker label="Глазки в покое" value={s.idle} options={['Случайная эмоция', 'Только обычные глазки', ...emotions.map(e => e.title)]} onChange={value => p.pickAction('idle', value)}/><ActionPicker label="При включении" value={s.intro} options={['Ничего', ...emotions.map(e => e.title)]} onChange={value => p.pickAction('intro', value)}/><ActionPicker label="Касание" value={s.touch} options={actionOptions} onChange={value => p.pickAction('touch', value)}/><ActionPicker label="Двойное касание" value={s.double} options={actionOptions} onChange={value => p.pickAction('double', value)}/></div>
      <div className="divider"/><div className="card-head compact"><div><span className="kicker">ЗАСТАВКА</span><h3>Первое впечатление</h3><p>Предпросмотр использует те же шрифты и эффекты, что приложение и прошивка.</p></div></div>
      <div className="fields"><label>Надпись<input name="word" maxLength={24} value={s.word} onChange={e => p.set('word', e.target.value)}/></label>{field('Что показывать', 'splash', ['Только слово', 'Только логотип', 'Слово, затем логотип', 'Логотип, затем слово', 'Без заставки'])}{field('Как появляется слово', 'effect', SPLASH_EFFECTS.map(item => item.title))}{slider('Время появления слова', 'appearMs', 100, 10000)}{slider('Держать слово', 'holdMs', 0, 10000)}{slider('Плавность', 'smooth', 1, 10, 1)}</div>
      <p className="field-label splash-heading">ШРИФТ</p><FontChoices splash={splash} onPick={font => p.set('font', SPLASH_FONTS[font].title)}/><p className="muted">Русские буквы есть только в «Обычном» шрифте.</p>
      <div className="splash-grid"><div><LogoUpload filename={p.logoName} onPick={p.setLogo}/><label>Как появляется логотип<select value={splash.logoEffect} onChange={e => p.setTiming(v => ({...v, logoEffect:Number(e.target.value)}))}>{SPLASH_EFFECTS.map(f => <option value={f.id} key={f.id}>{f.title}</option>)}</select></label>{slider('Появление логотипа', 'logoAppearMs', 100, 10000)}{slider('Держать логотип', 'logoHoldMs', 0, 10000)}</div><div><span className="field-label">ПРЕДПРОСМОТР OLED</span>{splash.on ? <SplashScreen splash={splash} logo={p.logo}/> : <div className="blank-screen">Заставка выключена</div>}{!p.logo && s.splash.includes('логотип') && <p className="muted">Логотип не загружен. Добавьте изображение, чтобы увидеть его.</p>}</div></div>
    </section>
    <SoundSettings output={p.output} setOutput={p.setOutput} enabled={p.soundOn} setEnabled={p.setSoundOn} clipsEnabled={p.clipsOn} setClipsEnabled={p.setClipsOn} volume={p.volume} setVolume={p.setVolume} tunes={p.tunes} setTunes={p.setTunes} pins={p.pins} setPins={p.setPins}/>
    <section className="card" id="preview"><div className="card-head"><div><span className="kicker">ПРЕДПРОСМОТР</span><h3>Попробуйте своего Чубу</h3><p>Нажмите на экран или кнопки, чтобы попробовать выбранные действия и мелодии.</p></div></div><div className="preview-layout"><div><button type="button" id="test-screen" className="test-screen" aria-label="Касание тестового экрана" onClick={() => p.showAction('touch')}>{p.preview.splash ? <SplashScreen key={p.preview.seq} splash={splash} logo={p.logo}/> : <img key={`${p.preview.id}-${p.preview.seq}`} id="test-face" src={gif(p.preview.id)} alt="Тестовый экран устройства" style={{filter:s.display === 'Синий' ? 'sepia(1) saturate(6) hue-rotate(175deg)' : undefined}}/>}</button><div className="preview-buttons"><button type="button" className="subtle" id="try-touch" onClick={() => p.showAction('touch')}>Касание</button><button type="button" className="subtle" id="try-double" onClick={() => p.showAction('double')}>Двойное касание</button><button type="button" className="subtle" id="try-splash" onClick={p.showSplash}>Заставка</button></div><p id="preview-status" className="muted" role="status">{p.preview.message}</p><p className="muted">Скорость GIF и яркость экрана в браузере могут отличаться от устройства.</p></div><div><span className="field-label">ВАШ ВЫБОР</span><dl id="order-summary" className="summary">{p.summary.map(([label,value]) => <div className="summary-row" key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></div></div></section>
  </>
}
