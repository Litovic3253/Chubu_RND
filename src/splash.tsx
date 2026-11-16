import { useEffect, useRef } from 'react'
import { DEFAULT_SPLASH, guessLogoInk, logoFromRgba, splashLength, type SplashSettings } from './core/setup'
import { renderSplash, type SplashFonts } from './core/splashRender'
import rawFonts from './core/splashFonts.json'

const fonts = rawFonts as unknown as SplashFonts
const W = 128, H = 64

/** Те же растровые шрифты, эффекты и формат кадра, что используются приложением. */
export function SplashScreen({ splash, logo, animate = true }: { splash: SplashSettings; logo: Uint8Array | null; animate?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const image = context.createImageData(W, H)
    const cycle = Math.max(1, splashLength(splash, logo !== null) + 800)
    const started = performance.now()
    let animation = 0, last = ''
    const draw = () => {
      const t = animate ? Math.trunc(performance.now() - started) % cycle : splash.appearMs
      const { frame, glow, done } = renderSplash(fonts, splash, logo, t)
      const level = done ? 0 : Math.max(60, Math.round(255 * glow / 1000))
      const key = `${level}:${frame.px.join('')}`
      if (key !== last) {
        last = key
        frame.px.forEach((on, i) => {
          const value = on ? level : 0
          image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = value
          image.data[i * 4 + 3] = 255
        })
        context.putImageData(image, 0, 0)
      }
      if (animate) animation = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animation)
  }, [splash, logo, animate])
  return <canvas ref={canvas} width={W} height={H} className="splash-canvas" aria-label="Предпросмотр заставки OLED" />
}

export function FontChoices({ splash, onPick }: { splash: SplashSettings; onPick: (font: number) => void }) {
  return <div className="font-grid" role="radiogroup" aria-label="Шрифт заставки">{['Обычный', 'Спорт', 'Жирный', 'Тонкий', 'С засечками', 'Курсив', 'Пишущая машинка', 'Пиксельный', 'Контурный'].map((name, font) =>
    <button type="button" key={name} className="font-tile" role="radio" aria-checked={splash.font === font} onClick={() => onPick(font)}>
      <SplashScreen splash={{ ...DEFAULT_SPLASH, ...splash, text: splash.text || 'Honda', font, show: 0, on: true, effect: 0, holdMs: 1000 }} logo={null} animate={false}/><span>{name}</span>
    </button>)}</div>
}

export function LogoUpload({ onPick, filename }: { onPick: (data: Uint8Array | null, name: string) => void; filename: string }) {
  function load(file?: File) {
    if (!file) { onPick(null, ''); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
      const context = canvas.getContext('2d')
      if (context) {
        const scale = Math.min(W / img.width, H / img.height)
        const width = img.width * scale, height = img.height * scale
        context.drawImage(img, (W - width) / 2, (H - height) / 2, width, height)
        const pixels = context.getImageData(0, 0, W, H).data
        onPick(logoFromRgba(pixels, { ink: guessLogoInk(pixels), threshold: 128, dither: false }), file.name)
      }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { URL.revokeObjectURL(url); onPick(null, '') }
    img.src = url
  }
  return <div><label>Логотип — PNG, JPG или WEBP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => load(e.target.files?.[0])}/></label>
    <p className="muted">{filename ? `Выбран ${filename}. Прикрепите тот же файл к сообщению в Telegram.` : 'Если нужен свой логотип, выберите файл. После формирования заказа прикрепите его к сообщению в Telegram.'}</p></div>
}
