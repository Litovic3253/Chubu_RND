import { useEffect, useState } from 'react'

export function LogoAttachment({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('')
  const shareData = { files: [file] }
  let canShare = false
  try { canShare = !!navigator.share && !!navigator.canShare?.(shareData) } catch { /* use manual attachment */ }

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    setStatus('')
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  async function shareFile() {
    try {
      await navigator.share({ files: [file] })
      setStatus('Убедитесь, что выбрали Telegram и отправили файл в чат @LastJoudas.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus('Не удалось открыть отправку файла. Прикрепите его вручную в чате Telegram.')
    }
  }

  return <div className="logo-delivery">
    <strong>2. Отправьте картинку логотипа</strong>
    <p>Файл «{file.name}» нужно отправить отдельно: Telegram не прикрепляет изображение к тексту заказа автоматически.</p>
    {canShare ? <><p>Нажмите кнопку, выберите Telegram, затем чат @LastJoudas и отправьте файл.</p><button type="button" className="subtle" onClick={() => void shareFile()}>Поделиться картинкой ↗</button></> : <p>В открытом чате Telegram нажмите скрепку и выберите исходный файл «{file.name}».</p>}
    <p>Если не находите файл, <a href={url || undefined} download={file.name}>скачайте выбранную картинку</a> и прикрепите её в чате.</p>
    {status && <p role="status">{status}</p>}
  </div>
}
