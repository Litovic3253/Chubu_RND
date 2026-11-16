import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { Box3, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type BufferGeometry } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import emotions from '../assets/emotions.json'
import { DEFAULT_SPLASH, SPLASH_FONTS, SPLASH_EFFECTS, PRESETS, melodyProblems, splashLength, type SplashSettings } from './core/setup'
import { initialTunes, SITE_TUNE_SLOTS, playTune, playClip, clipKind, type SoundChoice, type SoundPins } from './sound'
import { ConfigurationPanels } from './panels'
import { LogoAttachment } from './LogoAttachment'
import { createOrderLinks } from './orderLinks'
import { OrderView } from './OrderView'
import { ORDER_API_URL, sendOrder } from './orderApi'

const colors = [['Чёрный', '#202020'], ['Белый', '#e6e4df'], ['Красный', '#a52d2a'], ['Синий', '#28557d'], ['Серый', '#777778']] as const
const packages = ['Базовая — 3000 ₽', 'С кнопкой и пищалкой — 3500 ₽', 'Максимальная — 4000 ₽']
const ledColors = [['Фиолетовый', '#ad6aee'], ['Красный', '#ed5252'], ['Зелёный', '#52cb7c']] as const
const fonts = SPLASH_FONTS.map(item => item.title)
const effects = SPLASH_EFFECTS.map(item => item.title)
const actionOptions = ['Случайная эмоция', 'Следующая эмоция', 'Ничего', ...emotions.map(e => e.title)]
const initial = { package: packages[0], display: 'Белый', idle: 'Случайная эмоция', intro: 'Ничего', touch: actionOptions[0], double: actionOptions[1], speed: '100', pause: '10', brightness: '10', language: 'Русский', word: 'CHUBU', font: 'Обычный', effect: 'Проявление', splash: 'Только слово', name: '', contact: '', socialLink: '', city: '', comment: '' }
export type Settings = typeof initial
export type Key = keyof Settings
const gif = (id: number) => `./assets/dasai/${String(id).padStart(2, '0')}-${emotions[id].name}.gif`

function Model({ color }: { color: string }) {
  const host = useRef<HTMLDivElement>(null)
  const material = useRef<MeshStandardMaterial | null>(null)
  const [error, setError] = useState('Загрузка модели…')
  useEffect(() => {
    const container = host.current
    if (!container) return
    let renderer: WebGLRenderer | undefined
    const geometries: BufferGeometry[] = []
    let controls: OrbitControls | undefined
    let observer: ResizeObserver | undefined
    let frame = 0
    let cancelled = false
    const load = async () => { try {
      const scene = new Scene()
      const camera = new PerspectiveCamera(35, 1, 0.1, 1000)
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.prepend(renderer.domElement)
      material.current = new MeshStandardMaterial({ color: new Color(color), roughness: .55, metalness: .05 })
      const loader = new STLLoader()
      const geometry = await loader.loadAsync('./assets/chubu.stl')
      if (cancelled) { geometry.dispose(); return }
      geometries.push(geometry); geometry.computeVertexNormals(); geometry.center()
      const model = new Mesh(geometry, material.current); scene.add(model)
      const bounds = new Box3().setFromObject(model)
      const size = bounds.getSize(new Vector3()); const max = Math.max(size.x, size.y, size.z)
      camera.up.set(0, 0, 1); camera.position.set(max * 1.3, -max * 2.1, max * 1.5); camera.near = max / 1000; camera.far = max * 100; camera.updateProjectionMatrix()
      scene.add(new HemisphereLight(0xffffff, 0x655043, 2.3)); const light = new DirectionalLight(0xffffff, 2.3); light.position.set(max, max * 2, max * 2); scene.add(light)
      controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = max * .8; controls.maxDistance = max * 6
      const resize = () => { const w = container.clientWidth, h = container.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer?.setSize(w, h) }
      observer = new ResizeObserver(resize); observer.observe(container); resize()
      const tick = () => { controls?.update(); renderer?.render(scene, camera); frame = requestAnimationFrame(tick) }; tick()
      setError('')
    } catch { setError('Не удалось загрузить модель. Обновите страницу и проверьте соединение.') } }
    void load()
    return () => { cancelled = true; cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose(); geometries.forEach(geometry => geometry.dispose()); material.current?.dispose(); renderer?.dispose(); renderer?.domElement.remove() }
  }, [])
  useEffect(() => { material.current?.color.set(color) }, [color])
  return <div className="viewer" id="viewer" ref={host}><div className="viewer-status" id="model-status">{error}</div><div className="viewer-hint">↺ ПОВЕРНУТЬ · ПРОКРУТКА — МАСШТАБ</div></div>
}

function App() {
  const [settings, setSettings] = useState<Settings>(initial)
  const [selected, setSelected] = useState<Set<number>>(() => new Set(emotions.map(e => e.index)))
  const [color, setColor] = useState<string>(colors[0][0])
  const [ledColor, setLedColor] = useState<string>(ledColors[0][0])
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState({ id: 9, message: 'Обычные глазки в покое', splash: false, seq: 0 })
  const [tunes, setTunes] = useState<string[]>(initialTunes)
  const [output, setOutput] = useState<SoundChoice>('Пищалка')
  const [pins, setPins] = useState<SoundPins>({ lrck: '', bck: '', din: '' })
  const [volume, setVolume] = useState(10)
  const [soundOn, setSoundOn] = useState(true)
  const [clipsOn, setClipsOn] = useState(true)
  const [invert, setInvert] = useState(false)
  const [logo, setLogo] = useState<Uint8Array | null>(null)
  const [logoName, setLogoName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [splashTiming, setSplashTiming] = useState({ appearMs: 1500, holdMs: 1500, smooth: 8, logoEffect: 0, logoAppearMs: 1500, logoHoldMs: 1500 })
  const [orderLinks, setOrderLinks] = useState<string[]>([])
  const [orderMode, setOrderMode] = useState<'direct' | 'page' | 'parts'>('direct')
  const [orderError, setOrderError] = useState('')
  const [sendingOrder, setSendingOrder] = useState(false)
  const [orderSent, setOrderSent] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nextEmotionIndex = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const set = (key: Key, value: string) => setSettings(current => ({ ...current, [key]: value }))
  const splash: SplashSettings = { ...DEFAULT_SPLASH, ...splashTiming, on: settings.splash !== 'Без заставки', text: settings.word, font: fonts.indexOf(settings.font), effect: effects.indexOf(settings.effect), show: Math.max(0, ['Только слово', 'Только логотип', 'Слово, затем логотип', 'Логотип, затем слово'].indexOf(settings.splash)) }
  const tuneProblems = SITE_TUNE_SLOTS.some(slot => melodyProblems(tunes[slot.id] ?? '').length > 0)
  function pickAction(key: 'idle' | 'intro' | 'touch' | 'double', value: string) {
    set(key, value); const chosen = emotions.find(e => e.title === value)
    if (chosen) setSelected(current => new Set([...current, chosen.index]))
  }
  function toggleEmotion(id: number, checked: boolean) {
    setSelected(current => { const next = new Set(current); checked ? next.add(id) : next.delete(id); return next })
    if (!checked) setSettings(current => ({ ...current, idle: current.idle === emotions[id].title ? actionOptions[0] : current.idle, intro: current.intro === emotions[id].title ? 'Ничего' : current.intro, touch: current.touch === emotions[id].title ? actionOptions[0] : current.touch, double: current.double === emotions[id].title ? actionOptions[0] : current.double }))
  }
  function showAction(key: 'touch' | 'double') {
    playTune(tunes[key === 'touch' ? 2 : 3], soundOn && output !== 'Без звука', volume)
    const action = settings[key], available = emotions.filter(e => selected.has(e.index) && e.index !== 9)
    if (action === 'Ничего') { setPreview(p => ({ ...p, message: 'Для этого касания действие не выбрано' })); return }
    const next = action === 'Следующая эмоция' && available.length ? available[nextEmotionIndex.current++ % available.length] : undefined
    const item = emotions.find(e => e.title === action) ?? (action === 'Следующая эмоция' ? next : available[Math.floor(Math.random() * available.length)])
    if (!item) { setPreview(p => ({ ...p, message: 'Выберите хотя бы одну эмоцию' })); return }
    playClip(item.index, output, soundOn && clipsOn, volume)
    clearTimeout(timer.current); setPreview(p => ({ id: item.index, message: `${key === 'touch' ? 'Касание' : 'Двойное касание'}: ${item.title}`, splash: false, seq: p.seq + 1 }))
    timer.current = setTimeout(() => setPreview(p => ({ ...p, id: 9, message: 'Обычные глазки в покое' })), 4500)
  }
  function showSplash() {
    clearTimeout(timer.current); playTune(tunes[0], soundOn && output !== 'Без звука', volume)
    if (!splash.on) { setPreview(p => ({ ...p, splash: false, message: 'Заставка выключена' })); return }
    setPreview(p => ({ ...p, splash: true, seq: p.seq + 1, message: 'Заставка при включении' }))
    timer.current = setTimeout(() => setPreview(p => ({ ...p, splash: false, id: 9, message: 'Обычные глазки в покое' })), Math.max(800, splashLength(splash, logo !== null)))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setOrderError('')
    setOrderLinks([])
    setOrderSent(false)
    if (tuneProblems) { document.querySelector('#sounds')?.scrollIntoView({ behavior: 'smooth' }); return }
    const assignedPins = Object.values(pins).filter(Boolean)
    if (output === 'Усилитель I2S' && new Set(assignedPins).size !== assignedPins.length) { setOrderError('Пины I2S не должны повторяться.'); return }
    let socialLink = settings.socialLink.trim()
    if (socialLink) {
      if (!/^[a-z][a-z\d+.-]*:\/\//i.test(socialLink)) socialLink = `https://${socialLink}`
      try {
        const url = new URL(socialLink)
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error('Invalid link')
        socialLink = url.href
      } catch { setOrderError('Проверьте ссылку на профиль: например, https://t.me/username или https://vk.com/id.'); return }
    }
    const included = emotions.filter(e => selected.has(e.index)).map(e => e.title).join(', ')
    const excluded = emotions.filter(e => !selected.has(e.index)).map(e => e.title).join(', ')
    const list = !excluded ? 'Все 64' : included.length <= excluded.length + 11 ? included : `Все, кроме: ${excluded}`
    const configuredTunes = SITE_TUNE_SLOTS.filter(slot => tunes[slot.id]?.trim()).map(slot => {
      const notes = tunes[slot.id].trim()
      const preset = PRESETS.find(item => item.slots.includes(slot.id) && item.text === notes)
      return `- ${slot.title}: ${preset ? preset.title : `своя мелодия (${notes})`}`
    })
    const message = [
      'ЗАКАЗ ЧУБУ',
      '', 'КОНТАКТЫ',
      `- Имя: ${settings.name}`, `- Связь: ${settings.contact}`, `- Город: ${settings.city}`,
      ...(socialLink ? [`- Профиль: ${socialLink}`] : []),
      ...(settings.comment ? [`- Комментарий: ${settings.comment}`] : []),
      '', 'КОМПЛЕКТАЦИЯ',
      `- ${settings.package}`, `- Корпус: ${color}`, `- Экран OLED 0,96″: ${settings.display}`, '- Плата: ESP32-C3',
      ...(settings.package === packages[2] ? [`- Цвет светодиодной полоски: ${ledColor}`] : []),
      '', `ЭМОЦИИ (${selected.size} из ${emotions.length})`, list,
      '', 'РЕАКЦИИ',
      `- В покое: ${settings.idle}`, `- При включении: ${settings.intro}`, `- Касание: ${settings.touch}`, `- Двойное касание: ${settings.double}`,
      '', 'ЭКРАН',
      `- Скорость: ${settings.speed}%`, `- Пауза: ${settings.pause} с`, `- Яркость: ${settings.brightness}/10`, `- Негатив: ${invert ? 'вкл' : 'выкл'}`, `- Язык: ${settings.language}`,
      '', 'ЗВУК',
      `- Звук: ${soundOn ? 'включён' : 'выключен'}`, `- Устройство: ${output}`, `- Громкость: ${volume}/10`, `- Анимации: ${clipsOn ? 'включены' : 'выключены'}`,
      ...(output === 'Усилитель I2S' ? [`- Пины I2S: LRCK ${pins.lrck || 'уточнить'}, BCK ${pins.bck || 'уточнить'}, DIN ${pins.din || 'уточнить'}`] : []),
      '', 'МЕЛОДИИ', ...(configuredTunes.length ? configuredTunes : ['- Не выбраны']), '- Остальные: пусто',
      '', 'ЗАСТАВКА',
      `- Режим: ${settings.splash}`, `- Текст: ${settings.word || 'без текста'}`, `- Шрифт: ${settings.font}`,
      `- Эффект слова: ${settings.effect}, ${splash.appearMs} мс`, `- Слово держать: ${splash.holdMs} мс`, `- Плавность: ${splash.smooth}/10`,
      `- Логотип: ${logoName || 'не загружен'}`, `- Эффект логотипа: ${SPLASH_EFFECTS[splash.logoEffect].title}, ${splash.logoAppearMs} мс`, `- Логотип держать: ${splash.logoHoldMs} мс`,
      ...(logoName && !ORDER_API_URL ? ['', 'Файл логотипа прикреплю отдельным сообщением.'] : [])
    ].join('\n')
    if (ORDER_API_URL) {
      setSendingOrder(true)
      try { await sendOrder(message, logoFile); setOrderSent(true) }
      catch (error) { setOrderError(error instanceof Error ? error.message : 'Не удалось отправить заказ. Попробуйте ещё раз.') }
      finally { setSendingOrder(false) }
      return
    }
    const result = createOrderLinks(message, window.location.href)
    setOrderLinks(result.links)
    setOrderMode(result.mode)
    if (!logoFile && result.links.length === 1) window.open(result.links[0], '_blank', 'noopener,noreferrer')
  }
  const summary = [['Комплектация', settings.package], ['Экран', `OLED 0,96″, ${settings.display}`], ['Корпус', color], ...(settings.package === packages[2] ? [['Светодиодная полоска', ledColor]] : []), ['Эмоции', selected.size === 64 ? 'Все 64' : emotions.filter(e => selected.has(e.index)).map(e => e.title).join(', ')], ['В покое', settings.idle], ['При включении', settings.intro], ['Касание', settings.touch], ['Двойное касание', settings.double], ['Заставка', `${settings.splash} · ${settings.word} · ${settings.font} · ${settings.effect} · ${splash.appearMs} мс · держать ${splash.holdMs} мс · плавность ${splash.smooth}/10${logoName ? ` · логотип ${logoName}: ${SPLASH_EFFECTS[splash.logoEffect].title}, ${splash.logoAppearMs}/${splash.logoHoldMs} мс` : ''}`], ['Анимация', `${settings.speed}% · пауза ${settings.pause} с · яркость ${settings.brightness}/10 · ${invert ? 'негатив' : 'обычный'} · ${settings.language}`], ['Звук', `${soundOn ? 'Включён' : 'Выключен'} · ${output} · громкость ${volume}/10 · звуки анимаций ${clipsOn ? 'вкл' : 'выкл'}`], ['Мелодии', SITE_TUNE_SLOTS.map(slot => `${slot.title}: ${tunes[slot.id] || 'тишина'}`).join('; ')]]
  return <><header><a className="brand" href="#top"><img src="assets/icon.png" alt=""/><span>Чубу<br/><small>Паулюкевичуса</small></span></a><nav><a href="#case">Корпус</a><a href="#emotions">Эмоции</a><a href="#settings">Настройки</a></nav><a className="header-cta" href="#order">Собрать своего ↗</a></header>
  <main id="top"><section className="hero wrap"><div><div className="eyebrow"><span className="dot"/>ВАШ ПОПУТЧИК</div><h1>Маленький<br/>характер.<br/><em>Большие эмоции.</em></h1><p>Чубу оживляет приборную панель. Выберите эмоции, заставку, звук и цвет корпуса — соберём устройство под вас.</p><div className="hero-actions"><a className="button" href="#case">Собрать Чубу <span>↗</span></a><a className="text-link" href="#emotions">Посмотреть эмоции ↓</a></div><div className="facts"><span>64 анимации</span><span>Настройка под вас</span><span>Сделано с характером</span></div></div><div className="hero-display"><div className="screen-label">CHUBU / DISPLAY <span>● ONLINE</span></div><div className="screen"><img src={gif(9)} alt="Анимированные глаза Чубу"/></div><div className="display-bottom"><span>НАЖМИ. УЛЫБНИСЬ. ПОЕХАЛИ.</span><b>✳</b></div></div></section>
  <section className="config wrap"><div className="section-intro"><div><div className="eyebrow">КОНФИГУРАТОР</div><h2>Ваш Чубу,<br/><em>ваши правила.</em></h2></div><p>Выберите детали, а в конце проверьте заказ.</p></div><form id="config" onSubmit={submit}>
  <section className="card" id="package"><div className="card-head"><div><span className="kicker">КОМПЛЕКТАЦИЯ</span><h3>Выберите своего Чубу</h3></div></div><div className="packages">{packages.map((p,i) => <label className="package" key={p}><input type="radio" name="package" value={p} checked={settings.package === p} onChange={() => set('package',p)}/><span><strong>{['Базовая','С кнопкой и пищалкой','Максимальная'][i]}</strong><small>{['Устройство в базовой комплектации','Базовая комплектация + кнопка и пищалка','Кнопка, пищалка, вибромотор и светодиодная полоска'][i]}</small><b>{['3 000 ₽','3 500 ₽','4 000 ₽'][i]}</b></span></label>)}</div>{settings.package === packages[2] && <div className="led-choice"><span className="field-label">ЦВЕТ СВЕТОДИОДНОЙ ПОЛОСКИ</span><p className="muted">Выберите цвет свечения для максимальной комплектации.</p><div className="led-colors" role="group" aria-label="Цвет светодиодной полоски">{ledColors.map(([name, value]) => <button type="button" key={name} className="led-color" aria-pressed={ledColor === name} onClick={() => setLedColor(name)}><span className="led-dot" style={{backgroundColor: value}}/>{name}</button>)}</div></div>}</section>
  <section className="card" id="case"><div className="card-head"><div><span className="kicker">КОРПУС</span><h3>Выберите цвет</h3><p>Вращайте модель мышью или пальцем.</p></div><span className="pill">3D ПРОСМОТР</span></div><div className="case-layout"><Model color={colors.find(c => c[0] === color)?.[1] ?? '#202020'}/><div className="case-options"><span className="field-label">ЦВЕТ КОРПУСА</span><div id="colors" className="colors">{colors.map(([name,value]) => <button type="button" key={name} className="swatch" style={{background:value}} aria-label={name} aria-pressed={color === name} onClick={() => setColor(name)}/>)}</div><p className="color-name">{color}</p><div className="info">Цвет на экране может отличаться от цвета готового изделия.</div><span className="field-label">ВЫБРАННАЯ КОМПЛЕКТАЦИЯ</span><strong className="price" id="price">{['3 000 ₽','3 500 ₽','4 000 ₽'][packages.indexOf(settings.package)]}</strong><p className="muted">Стоимость доставки уточняется.</p></div></div></section>
  <section className="card" id="emotions"><div className="card-head"><div><span className="kicker">ХАРАКТЕР</span><h3>Эмоции Чубу</h3><p>Выберите анимации, которые будут на устройстве.</p></div><span className="pill" id="count">{selected.size} / 64</span></div><div className="controls"><input id="search" type="search" placeholder="Найти эмоцию" aria-label="Найти эмоцию" value={query} onChange={e => setQuery(e.target.value)}/><button type="button" className="subtle" id="all" onClick={() => setSelected(new Set(emotions.map(e => e.index)))}>Выбрать все</button><button type="button" className="subtle" id="none" onClick={() => { setSelected(new Set([9])); setSettings(s => ({...s,idle:actionOptions[0],intro:'Ничего',touch:actionOptions[0],double:actionOptions[0]})) }}>Снять выбор</button></div><div id="emotion-grid" className="emotion-grid">{emotions.filter(e => e.title.toLowerCase().includes(query.trim().toLowerCase())).map(e => <div className="emotion" key={e.index}><img src={gif(e.index)} loading="lazy" alt=""/><label className="emotion-label"><input type="checkbox" value={e.index} checked={selected.has(e.index)} disabled={e.index === 9} onChange={event => toggleEmotion(e.index,event.target.checked)}/>{e.index + 1}. {e.title}</label>{clipKind(e.index) && <button type="button" className="clip-play" onClick={() => playClip(e.index, 'Усилитель I2S', true, volume)}>▶ {clipKind(e.index)}</button>}</div>)}</div><p className="muted">Обычные глазки остаются включёнными между эмоциями.</p></section>
  <ConfigurationPanels pins={pins} setPins={setPins} settings={settings} set={set} pickAction={pickAction} splash={splash} setTiming={setSplashTiming} logo={logo} logoName={logoName} setLogo={(data, name, file) => { setLogo(data); setLogoName(name); setLogoFile(file); setOrderLinks([]) }} soundOn={soundOn} setSoundOn={setSoundOn} clipsOn={clipsOn} setClipsOn={setClipsOn} output={output} setOutput={setOutput} volume={volume} setVolume={setVolume} tunes={tunes} setTunes={setTunes} invert={invert} setInvert={setInvert} preview={preview} showAction={showAction} showSplash={showSplash} summary={summary}/>
  <section className="card order" id="order"><div className="card-head"><div><span className="kicker">ПОСЛЕДНИЙ ШАГ</span><h3>Осталось познакомиться</h3><p>Оставьте контакты — обсудим детали и стоимость.</p></div></div><div className="fields">{([['Имя','name',80],['Телефон или Telegram','contact',120],['Город','city',80],['Ссылка на VK, Telegram или Instagram','socialLink',300],['Комментарий','comment',300]] as const).map(([label,key,max]) => <label key={key}>{label}{key !== 'comment' && key !== 'socialLink' && <span> *</span>}<input name={key} required={key !== 'comment' && key !== 'socialLink'} inputMode={key === 'socialLink' ? 'url' : undefined} placeholder={key === 'socialLink' ? 'Например, https://t.me/username' : undefined} maxLength={max} value={settings[key]} onChange={e => set(key,e.target.value)}/></label>)}</div><div className="submit-row"><p>{ORDER_API_URL ? 'Отправим заказ и выбранный логотип продавцу в Telegram.' : logoFile ? 'Сначала подготовьте заказ, затем отправьте текст и картинку логотипа в Telegram.' : 'Откроется Telegram с готовым текстом заказа. Проверьте его и нажмите «Отправить».'}</p><button className="button" type="submit" disabled={tuneProblems || sendingOrder}>{sendingOrder ? 'Отправляем…' : ORDER_API_URL ? 'Отправить заказ' : logoFile ? 'Подготовить заказ' : 'Отправить заказ'} <span>↗</span></button></div>{orderSent && <p role="status">Заказ отправлен. Мы свяжемся с вами!</p>}{orderError && <p role="alert" className="sound-error">{orderError}</p>}{tuneProblems && <p role="alert" className="sound-error">Исправьте ошибки в мелодиях, прежде чем отправить заказ.</p>}{orderLinks.length > 0 && <div id="result" className="order-delivery" role="status"><strong>{logoFile ? '1. Отправьте заказ' : 'Заказ подготовлен'}</strong><p>{orderMode === 'parts' ? 'Отправьте каждую часть заказа по порядку: откройте ссылку и нажмите «Отправить» в Telegram.' : orderMode === 'page' ? 'Откройте Telegram и отправьте сообщение со ссылкой на полный заказ. Отправьте его продавцу.' : 'Откройте заказ, проверьте текст в Telegram и нажмите «Отправить».'}</p>{orderLinks.map((link, i) => <a className="subtle" key={link} href={link} target="_blank" rel="noopener noreferrer" style={{display: 'inline-flex', marginRight: 8, marginBottom: 8}}>{orderLinks.length > 1 ? `Отправить часть ${i + 1} из ${orderLinks.length} ↗` : 'Открыть заказ в Telegram ↗'}</a>)}{logoFile && <LogoAttachment file={logoFile}/>}</div>}</section>
  </form></section></main><footer className="wrap"><span>ЧУБУ ПАУЛЮКЕВИЧУСА</span><span>СДЕЛАНО С ХАРАКТЕРОМ ✳</span></footer></>
}

function Router() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const update = () => setHash(window.location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const encodedOrder = new URLSearchParams(hash.slice(1)).get('order')
  return encodedOrder ? <OrderView encoded={encodedOrder}/> : <App />
}
createRoot(document.getElementById('root')!).render(<Router />)
