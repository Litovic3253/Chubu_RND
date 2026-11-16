const form = document.querySelector('#config')
const grid = document.querySelector('#emotion-grid')
const selected = new Set(Array.from({ length: 64 }, (_, i) => i))
let emotions = []
let color = 'Чёрный'
const colors = [['Чёрный', '#202020'], ['Белый', '#e6e4df'], ['Красный', '#a52d2a'], ['Синий', '#28557d'], ['Серый', '#777778']]
let setModelColor = () => {}

for (const [name, value] of colors) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'swatch'
  button.style.background = value
  button.setAttribute('aria-label', name)
  button.setAttribute('aria-pressed', String(name === color))
  button.addEventListener('click', () => {
    color = name
    document.querySelector('#color-name').textContent = name
    document.querySelectorAll('.swatch').forEach(el => el.setAttribute('aria-pressed', String(el === button)))
    setModelColor(value)
  })
  document.querySelector('#colors').append(button)
}

function updateCount() { document.querySelector('#count').textContent = `${selected.size} / ${emotions.length}` }
function updateSelection() {
  grid.querySelectorAll('input').forEach(input => { input.checked = selected.has(Number(input.value)) })
  updateCount()
}
try {
  const response = await fetch('./assets/emotions.json')
  if (!response.ok) throw new Error('Каталог недоступен')
  emotions = await response.json()
  for (const item of emotions) {
    const label = document.createElement('label')
    label.className = 'emotion'
    label.dataset.title = item.title.toLocaleLowerCase('ru')
    const image = document.createElement('img')
    image.loading = 'lazy'
    image.alt = ''
    image.src = `./assets/dasai/${String(item.index).padStart(2, '0')}-${item.name}.gif`
    const line = document.createElement('span')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = item.index
    checkbox.checked = true
    if (item.index === 9) { checkbox.disabled = true; label.title = 'Обычные глазки доступны всегда' }
    checkbox.addEventListener('change', () => { checkbox.checked ? selected.add(item.index) : selected.delete(item.index); updateCount() })
    line.append(checkbox, document.createTextNode(item.title))
    label.append(image, line)
    grid.append(label)
  }
  for (const id of ['touch', 'double']) {
    const select = document.querySelector(`#${id}`)
    for (const name of ['Случайная эмоция', 'Следующая эмоция', 'Ничего', ...emotions.map(e => e.title)]) select.add(new Option(name, name))
  }
  document.querySelector('#double').value = 'Следующая эмоция'
  updateCount()
} catch (error) {
  grid.textContent = 'Не удалось загрузить каталог эмоций. Обновите страницу.'
  form.querySelector('[type=submit]').disabled = true
}
document.querySelector('#search').addEventListener('input', e => {
  const query = e.target.value.trim().toLocaleLowerCase('ru')
  grid.querySelectorAll('.emotion').forEach(el => { el.hidden = !el.dataset.title.includes(query) })
})
document.querySelector('#all').addEventListener('click', () => { emotions.forEach(e => selected.add(e.index)); updateSelection() })
document.querySelector('#none').addEventListener('click', () => { selected.clear(); selected.add(9); updateSelection() })
form.addEventListener('change', e => {
  if (e.target.name === 'package') document.querySelector('#price').textContent = e.target.value.match(/\d+ ₽/)[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
})
form.addEventListener('submit', e => {
  e.preventDefault()
  const values = new FormData(form)
  const list = selected.size === emotions.length ? 'Все 64' : emotions.filter(item => selected.has(item.index)).map(item => `${item.index + 1}. ${item.title}`).join(', ')
  const message = ['Здравствуйте! Хочу заказать Чубу.', `Комплектация: ${values.get('package')}`, `Плата: ESP32-C3, экран OLED 0,96″: ${values.get('display')}`, `Цвет корпуса: ${color}`, `Эмоции: ${list}`, `Касание: ${values.get('touch')}`, `Двойное касание: ${values.get('double')}`, `Скорость: ${values.get('speed')}`, `Пауза: ${values.get('pause')}`, `Яркость: ${values.get('brightness')}`, `Звук: ${values.get('sound')}, громкость: ${values.get('volume')}`, `Мелодия: ${values.get('tune') || 'не указана'}`, `Заставка: ${values.get('splash')}, текст: ${values.get('word') || 'без текста'}, шрифт: ${values.get('font')}, эффект: ${values.get('effect')}`, `Имя: ${values.get('name')}`, `Контакт: ${values.get('contact')}`, `Город: ${values.get('city')}`, `Комментарий: ${values.get('comment') || 'нет'}`].join('\n')
  const url = `https://t.me/LastJoudas?text=${encodeURIComponent(message)}`
  const result = document.querySelector('#result')
  result.replaceChildren(document.createTextNode('Откройте Telegram и нажмите «Отправить» в чате. '))
  const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Открыть заказ в Telegram ↗'; result.append(link)
  window.open(url, '_blank', 'noopener,noreferrer')
})

try {
  const [{ Scene, PerspectiveCamera, WebGLRenderer, Color, MeshStandardMaterial, Mesh, HemisphereLight, DirectionalLight, Box3, Vector3 }, { STLLoader }, { OrbitControls }] = await Promise.all([import('three'), import('three/addons/loaders/STLLoader.js'), import('three/addons/controls/OrbitControls.js')])
  const container = document.querySelector('#viewer')
  const scene = new Scene()
  const camera = new PerspectiveCamera(35, 1, 0.1, 1000)
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.prepend(renderer.domElement)
  const material = new MeshStandardMaterial({ color: new Color('#202020'), roughness: .55, metalness: .05 })
  const geometry = await new STLLoader().loadAsync('./assets/case.stl')
  geometry.center(); geometry.computeVertexNormals()
  const model = new Mesh(geometry, material)
  scene.add(model)
  const size = new Box3().setFromObject(model).getSize(new Vector3())
  const max = Math.max(size.x, size.y, size.z)
  camera.position.set(max * 1.4, max * 1.1, max * 2.2)
  camera.near = max / 1000; camera.far = max * 100; camera.updateProjectionMatrix()
  scene.add(new HemisphereLight(0xffffff, 0x655043, 2.3))
  const light = new DirectionalLight(0xffffff, 2.3); light.position.set(max, max * 2, max * 2); scene.add(light)
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true
  controls.minDistance = max * .8; controls.maxDistance = max * 6
  setModelColor = value => material.color.set(value)
  setModelColor(colors.find(c => c[0] === color)[1])
  const resize = () => { const w = container.clientWidth, h = container.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h) }
  new ResizeObserver(resize).observe(container); resize()
  document.querySelector('#model-status').textContent = ''
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera) })
} catch (error) {
  document.querySelector('#model-status').textContent = 'Не удалось загрузить 3D-модель. Цвет можно выбрать ниже.'
}
