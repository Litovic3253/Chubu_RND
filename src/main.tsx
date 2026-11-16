import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { Box3, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type BufferGeometry } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import emotions from '../assets/emotions.json'
import modelData from '../assets/case.stl'

const colors = [['Чёрный', '#202020'], ['Белый', '#e6e4df'], ['Красный', '#a52d2a'], ['Синий', '#28557d'], ['Серый', '#777778']] as const
const packages = ['Базовая — 3000 ₽', 'С кнопкой и пищалкой — 3500 ₽', 'Максимальная — 4000 ₽']
const melodies: Record<string, string> = { 'Без звука': '', 'Короткий сигнал': 'C6 100 0', 'Два сигнала': 'C6 90 80 C6 90 0', 'Приветствие': 'C5 120 40 E5 120 40 G5 220 0', 'Вверх': 'C5 90 20 D5 90 20 E5 90 20 G5 180 0', 'Мягкий звонок': 'G5 150 70 E5 220 0' }
const fonts = ['Обычный', 'Спорт', 'Жирный', 'Тонкий', 'С засечками', 'Курсив', 'Пишущая машинка', 'Пиксельный', 'Контурный']
const effects = ['Проявление', 'По буквам', 'Выезд снизу', 'Раскрытие от центра', 'Печатная машинка', 'Неоновая вывеска', 'Сборка из точек', 'Рост из центра', 'Лазерный луч', 'Падение с отскоком', 'Блик', 'Помехи (глитч)']
const actionOptions = ['Случайная эмоция', 'Следующая эмоция', 'Ничего', ...emotions.map(e => e.title)]
const initial = { package: packages[0], display: 'Белый', touch: actionOptions[0], double: actionOptions[1], speed: 'Обычная — 100%', pause: '10 секунд', brightness: '10 / 10', sound: 'Включён', volume: 'Средняя', tune: 'Без звука', touchTune: 'Без звука', doubleTune: 'Без звука', word: 'CHUBU', font: 'Обычный', effect: 'Проявление', splash: 'Только слово', name: '', contact: '', city: '', comment: '' }
type Settings = typeof initial
type Key = keyof Settings
const gif = (id: number) => `./assets/dasai/${String(id).padStart(2, '0')}-${emotions[id].name}.gif`

function Model({ color }: { color: string }) {
  const host = useRef<HTMLDivElement>(null)
  const material = useRef<MeshStandardMaterial | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const container = host.current
    if (!container) return
    let renderer: WebGLRenderer | undefined
    let geometry: BufferGeometry | undefined
    let controls: OrbitControls | undefined
    let observer: ResizeObserver | undefined
    let frame = 0
    try {
      const scene = new Scene()
      const camera = new PerspectiveCamera(35, 1, 0.1, 1000)
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.prepend(renderer.domElement)
      material.current = new MeshStandardMaterial({ color: new Color(color), roughness: .55, metalness: .05 })
      const binary = atob(modelData.split(',')[1])
      const data = Uint8Array.from(binary, ch => ch.charCodeAt(0))
      geometry = new STLLoader().parse(data.buffer); geometry.center(); geometry.computeVertexNormals()
      const model = new Mesh(geometry, material.current); scene.add(model)
      const size = new Box3().setFromObject(model).getSize(new Vector3()); const max = Math.max(size.x, size.y, size.z)
      camera.position.set(max * 1.4, max * 1.1, max * 2.2); camera.near = max / 1000; camera.far = max * 100; camera.updateProjectionMatrix()
      scene.add(new HemisphereLight(0xffffff, 0x655043, 2.3)); const light = new DirectionalLight(0xffffff, 2.3); light.position.set(max, max * 2, max * 2); scene.add(light)
      controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = max * .8; controls.maxDistance = max * 6
      const resize = () => { const w = container.clientWidth, h = container.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer?.setSize(w, h) }
      observer = new ResizeObserver(resize); observer.observe(container); resize()
      const tick = () => { controls?.update(); renderer?.render(scene, camera); frame = requestAnimationFrame(tick) }; tick()
    } catch { setError('Не удалось открыть 3D-модель. Цвет можно выбрать рядом.') }
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose(); geometry?.dispose(); material.current?.dispose(); renderer?.dispose(); renderer?.domElement.remove() }
  }, [])
  useEffect(() => { material.current?.color.set(color) }, [color])
  return <div className="viewer" id="viewer" ref={host}><div className="viewer-status" id="model-status">{error}</div><div className="viewer-hint">↺ ПОВЕРНУТЬ · ПРОКРУТКА — МАСШТАБ</div></div>
}

let audioContext: AudioContext | undefined
function playTune(name: string, enabled: boolean) {
  if (!enabled || !melodies[name]) return
  audioContext ||= new AudioContext(); void audioContext.resume()
  const tokens = melodies[name].split(' '); let at = audioContext.currentTime + .02
  const steps: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  for (let i = 0; i < tokens.length; i += 3) {
    const match = /^([A-G])(\d)$/.exec(tokens[i]); if (!match) continue
    const midi = (Number(match[2]) + 1) * 12 + steps[match[1]], duration = Number(tokens[i + 1]) / 1000
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain()
    oscillator.type = 'square'; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
    gain.gain.setValueAtTime(.035, at); gain.gain.setValueAtTime(0, at + duration)
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(at); oscillator.stop(at + duration + .01)
    at += duration + Number(tokens[i + 2]) / 1000
  }
}

function App() {
  const [settings, setSettings] = useState<Settings>(initial)
  const [selected, setSelected] = useState<Set<number>>(() => new Set(emotions.map(e => e.index)))
  const [color, setColor] = useState<string>(colors[0][0])
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState({ id: 9, message: 'Обычные глазки в покое', word: '', seq: 0 })
  const [orderUrl, setOrderUrl] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const nextEmotionIndex = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const set = (key: Key, value: string) => setSettings(current => ({ ...current, [key]: value }))
  function pickAction(key: 'touch' | 'double', value: string) {
    set(key, value); const chosen = emotions.find(e => e.title === value)
    if (chosen) setSelected(current => new Set([...current, chosen.index]))
  }
  function toggleEmotion(id: number, checked: boolean) {
    setSelected(current => { const next = new Set(current); checked ? next.add(id) : next.delete(id); return next })
    if (!checked) setSettings(current => ({ ...current, touch: current.touch === emotions[id].title ? actionOptions[0] : current.touch, double: current.double === emotions[id].title ? actionOptions[0] : current.double }))
  }
  function showAction(key: 'touch' | 'double') {
    playTune(settings[key === 'touch' ? 'touchTune' : 'doubleTune'], settings.sound === 'Включён')
    const action = settings[key], available = emotions.filter(e => selected.has(e.index) && e.index !== 9)
    if (action === 'Ничего') { setPreview(p => ({ ...p, message: 'Для этого касания действие не выбрано' })); return }
    const next = action === 'Следующая эмоция' && available.length ? available[nextEmotionIndex.current++ % available.length] : undefined
    const item = emotions.find(e => e.title === action) ?? (action === 'Следующая эмоция' ? next : available[Math.floor(Math.random() * available.length)])
    if (!item) { setPreview(p => ({ ...p, message: 'Выберите хотя бы одну эмоцию' })); return }
    clearTimeout(timer.current); setPreview(p => ({ id: item.index, message: `${key === 'touch' ? 'Касание' : 'Двойное касание'}: ${item.title}`, word: '', seq: p.seq + 1 }))
    timer.current = setTimeout(() => setPreview(p => ({ ...p, id: 9, message: 'Обычные глазки в покое' })), 4500)
  }
  function showSplash() {
    clearTimeout(timer.current); playTune(settings.tune, settings.sound === 'Включён')
    const word = settings.splash === 'Без заставки' ? ' ' : settings.splash === 'Только логотип' || settings.splash === 'Логотип, затем слово' ? 'ЛОГОТИП' : settings.word || ' '
    setPreview(p => ({ ...p, word, message: `Заставка: ${settings.splash}, ${settings.effect}. Условный предпросмотр.` }))
    timer.current = setTimeout(() => setPreview(p => ({ ...p, word: '', id: 9, message: 'Обычные глазки в покое' })), 3000)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const list = selected.size === emotions.length ? 'Все 64' : emotions.filter(e => selected.has(e.index)).map(e => `${e.index + 1}. ${e.title}`).join(', ')
    const tune = (key: 'tune' | 'touchTune' | 'doubleTune') => `${settings[key]} (${melodies[settings[key]] || 'тишина'})`
    const message = ['Здравствуйте! Хочу заказать Чубу.', `Комплектация: ${settings.package}`, `Плата: ESP32-C3, экран OLED 0,96″: ${settings.display}`, `Цвет корпуса: ${color}`, `Эмоции: ${list}`, `Касание: ${settings.touch}`, `Двойное касание: ${settings.double}`, `Скорость: ${settings.speed}`, `Пауза: ${settings.pause}`, `Яркость: ${settings.brightness}`, `Звук: ${settings.sound}, громкость: ${settings.volume}`, `Мелодии — включение: ${tune('tune')}, касание: ${tune('touchTune')}, двойное касание: ${tune('doubleTune')}`, `Заставка: ${settings.splash}, текст: ${settings.word || 'без текста'}, шрифт: ${settings.font}, эффект: ${settings.effect}`, `Имя: ${settings.name}`, `Контакт: ${settings.contact}`, `Город: ${settings.city}`, `Комментарий: ${settings.comment || 'нет'}`].join('\n')
    const url = `https://t.me/LastJoudas?text=${encodeURIComponent(message)}`; setOrderUrl(url); window.open(url, '_blank', 'noopener,noreferrer')
  }
  const field = (label: string, key: Key, options: string[]) => <label>{label}<select name={key} id={key === 'touch' || key === 'double' ? key : undefined} value={settings[key]} onChange={e => key === 'touch' || key === 'double' ? pickAction(key, e.target.value) : set(key, e.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
  const melodyField = (label: string, key: 'tune' | 'touchTune' | 'doubleTune') => <div className="tune-field">{field(label, key, Object.keys(melodies))}<button type="button" className="subtle" data-play-tune={key} onClick={() => playTune(settings[key], settings.sound === 'Включён')}>▶ Прослушать</button></div>
  const summary = [['Комплектация', settings.package], ['Экран', `OLED 0,96″, ${settings.display}`], ['Корпус', color], ['Эмоции', selected.size === 64 ? 'Все 64' : emotions.filter(e => selected.has(e.index)).map(e => e.title).join(', ')], ['Касание', `${settings.touch} · ${settings.touchTune}`], ['Двойное касание', `${settings.double} · ${settings.doubleTune}`], ['Заставка', `${settings.splash} · ${settings.word} · ${settings.font} · ${settings.effect}`], ['Анимация', `${settings.speed} · пауза ${settings.pause} · яркость ${settings.brightness}`], ['Звук', `${settings.sound} · ${settings.volume} · включение: ${settings.tune}`]]
  return <><header><a className="brand" href="#top"><img src="assets/icon.png" alt=""/><span>Чубу<br/><small>Паулюкевичуса</small></span></a><nav><a href="#case">Корпус</a><a href="#emotions">Эмоции</a><a href="#settings">Настройки</a></nav><a className="header-cta" href="#order">Собрать своего ↗</a></header>
  <main id="top"><section className="hero wrap"><div><div className="eyebrow"><span className="dot"/>ВАШ ПОПУТЧИК</div><h1>Маленький<br/>характер.<br/><em>Большие эмоции.</em></h1><p>Чубу оживляет приборную панель. Выберите эмоции, заставку, звук и цвет корпуса — соберём устройство под вас.</p><div className="hero-actions"><a className="button" href="#case">Собрать Чубу <span>↗</span></a><a className="text-link" href="#emotions">Посмотреть эмоции ↓</a></div><div className="facts"><span>64 анимации</span><span>Настройка под вас</span><span>Сделано с характером</span></div></div><div className="hero-display"><div className="screen-label">CHUBU / DISPLAY <span>● ONLINE</span></div><div className="screen"><img src={gif(9)} alt="Анимированные глаза Чубу"/></div><div className="display-bottom"><span>НАЖМИ. УЛЫБНИСЬ. ПОЕХАЛИ.</span><b>✳</b></div></div></section>
  <section className="config wrap"><div className="section-intro"><div><div className="eyebrow">КОНФИГУРАТОР</div><h2>Ваш Чубу,<br/><em>ваши правила.</em></h2></div><p>Выберите детали, а в конце проверьте заказ.</p></div><form id="config" onSubmit={submit}>
  <section className="card" id="package"><div className="card-head"><div><span className="kicker">КОМПЛЕКТАЦИЯ</span><h3>Выберите своего Чубу</h3></div></div><div className="packages">{packages.map((p,i) => <label className="package" key={p}><input type="radio" name="package" value={p} checked={settings.package === p} onChange={() => set('package',p)}/><span><strong>{['Базовая','С кнопкой и пищалкой','Максимальная'][i]}</strong><small>{['Устройство в базовой комплектации','Базовая комплектация + кнопка и пищалка','Кнопка, пищалка, вибромотор и светодиодная полоска'][i]}</small><b>{['3 000 ₽','3 500 ₽','4 000 ₽'][i]}</b></span></label>)}</div></section>
  <section className="card" id="case"><div className="card-head"><div><span className="kicker">КОРПУС</span><h3>Выберите цвет</h3><p>Вращайте модель мышью или пальцем.</p></div><span className="pill">3D ПРОСМОТР</span></div><div className="case-layout"><Model color={colors.find(c => c[0] === color)?.[1] ?? '#202020'}/><div className="case-options"><span className="field-label">ЦВЕТ КОРПУСА</span><div id="colors" className="colors">{colors.map(([name,value]) => <button type="button" key={name} className="swatch" style={{background:value}} aria-label={name} aria-pressed={color === name} onClick={() => setColor(name)}/>)}</div><p className="color-name">{color}</p><div className="info">Цвет на экране может отличаться от цвета готового изделия.</div><span className="field-label">ВЫБРАННАЯ КОМПЛЕКТАЦИЯ</span><strong className="price" id="price">{['3 000 ₽','3 500 ₽','4 000 ₽'][packages.indexOf(settings.package)]}</strong><p className="muted">Стоимость доставки уточняется.</p></div></div></section>
  <section className="card" id="emotions"><div className="card-head"><div><span className="kicker">ХАРАКТЕР</span><h3>Эмоции Чубу</h3><p>Выберите анимации, которые будут на устройстве.</p></div><span className="pill" id="count">{selected.size} / 64</span></div><div className="controls"><input id="search" type="search" placeholder="Найти эмоцию" aria-label="Найти эмоцию" value={query} onChange={e => setQuery(e.target.value)}/><button type="button" className="subtle" id="all" onClick={() => setSelected(new Set(emotions.map(e => e.index)))}>Выбрать все</button><button type="button" className="subtle" id="none" onClick={() => { setSelected(new Set([9])); setSettings(s => ({...s,touch:actionOptions[0],double:actionOptions[0]})) }}>Снять выбор</button></div><div id="emotion-grid" className="emotion-grid">{emotions.filter(e => e.title.toLowerCase().includes(query.trim().toLowerCase())).map(e => <label className="emotion" key={e.index}><img src={gif(e.index)} loading="lazy" alt=""/><span><input type="checkbox" value={e.index} checked={selected.has(e.index)} disabled={e.index === 9} onChange={event => toggleEmotion(e.index,event.target.checked)}/>{e.title}</span></label>)}</div><p className="muted">Обычные глазки остаются включёнными между эмоциями.</p></section>
  <section className="card" id="settings"><div className="card-head"><div><span className="kicker">НАСТРОЙКИ</span><h3>Добавьте индивидуальности</h3><p>OLED 0,96″ и плата ESP32-C3.</p></div></div><div className="fields">{field('Цвет экрана OLED 0,96″','display',['Белый','Синий'])}{field('При касании','touch',actionOptions)}{field('При двойном касании','double',actionOptions)}{field('Скорость анимаций','speed',['Обычная — 100%','Медленная — 75%','Быстрая — 125%','Очень быстрая — 150%'])}{field('Пауза между эмоциями','pause',['10 секунд','5 секунд','20 секунд','30 секунд','60 секунд'])}{field('Яркость экрана','brightness',['10 / 10','8 / 10','5 / 10','3 / 10'])}{field('Звук','sound',['Включён','Выключен'])}{field('Громкость','volume',['Средняя','Тихая','Громкая'])}{melodyField('Мелодия при включении','tune')}{melodyField('Мелодия касания','touchTune')}{melodyField('Мелодия двойного касания','doubleTune')}<p className="muted">Примеры звучат в браузере, тембр пищалки может отличаться.</p></div><div className="divider"/><div className="card-head compact"><div><span className="kicker">ЗАСТАВКА</span><h3>Первое впечатление</h3></div></div><div className="fields"><label>Надпись<input name="word" maxLength={24} value={settings.word} onChange={e => set('word',e.target.value)}/></label>{field('Шрифт','font',fonts)}{field('Появление','effect',effects)}{field('Показывать','splash',['Только слово','Только логотип','Слово, затем логотип','Логотип, затем слово','Без заставки'])}</div><p className="muted">Русские буквы доступны в шрифте «Обычный». Логотип можно согласовать после отправки заявки.</p></section>
  <section className="card" id="preview"><div className="card-head"><div><span className="kicker">ПРЕДПРОСМОТР</span><h3>Попробуйте своего Чубу</h3><p>Нажмите на экран или кнопки, чтобы попробовать выбранные действия и мелодии. Предпросмотр заставки, скорости и яркости приблизительный.</p></div></div><div className="preview-layout"><div><button type="button" id="test-screen" className="test-screen" aria-label="Касание тестового экрана" onClick={() => showAction('touch')}>{preview.word ? <span id="test-word">{preview.word}</span> : <img key={`${preview.id}-${preview.seq}`} id="test-face" src={gif(preview.id)} alt="Тестовый экран устройства" style={{filter:settings.display === 'Синий' ? 'sepia(1) saturate(6) hue-rotate(175deg)' : undefined}}/>}</button><div className="preview-buttons"><button type="button" className="subtle" id="try-touch" onClick={() => showAction('touch')}>Касание</button><button type="button" className="subtle" id="try-double" onClick={() => showAction('double')}>Двойное касание</button><button type="button" className="subtle" id="try-splash" onClick={showSplash}>Заставка</button></div><p id="preview-status" className="muted" role="status">{preview.message}</p></div><div><span className="field-label">ВАШ ВЫБОР</span><dl id="order-summary" className="summary">{summary.map(([label,value]) => <div className="summary-row" key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl></div></div></section>
  <section className="card order" id="order"><div className="card-head"><div><span className="kicker">ПОСЛЕДНИЙ ШАГ</span><h3>Осталось познакомиться</h3><p>Оставьте контакты — обсудим детали и стоимость.</p></div></div><div className="fields">{([['Имя','name',80],['Телефон или Telegram','contact',120],['Город','city',80],['Комментарий','comment',300]] as const).map(([label,key,max]) => <label key={key}>{label}{key !== 'comment' && <span> *</span>}<input name={key} required={key !== 'comment'} maxLength={max} value={settings[key]} onChange={e => set(key,e.target.value)}/></label>)}</div><div className="submit-row"><p>Откроется Telegram с текстом заказа. Отправьте сообщение в чате.</p><button className="button" type="submit">Отправить заказ <span>↗</span></button></div>{orderUrl && <div id="result" role="status">Откройте Telegram и нажмите «Отправить». <a href={orderUrl} target="_blank" rel="noreferrer">Открыть заказ ↗</a></div>}</section>
  </form></section></main><footer className="wrap"><span>ЧУБУ ПАУЛЮКЕВИЧУСА</span><span>СДЕЛАНО С ХАРАКТЕРОМ ✳</span></footer></>
}

createRoot(document.getElementById('root')!).render(<App />)
