import { strFromU8, strToU8, zlibSync, unzlibSync } from 'fflate'

const telegram = (text: string) => `https://t.me/LastJoudas?text=${encodeURIComponent(text)}`
const maxUrl = 3950

export function encodeOrder(text: string): string {
  const compressed = zlibSync(strToU8(text), { level: 9 })
  let binary = ''
  for (const byte of compressed) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeOrder(encoded: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > 20000) throw new Error('Invalid order')
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return strFromU8(unzlibSync(bytes))
}

export function createOrderLinks(message: string, pageUrl: string): { links: string[]; mode: 'direct' | 'page' | 'parts' } {
  const direct = telegram(message)
  if (direct.length <= maxUrl && [...message].length <= 4096) return { links: [direct], mode: 'direct' }
  const orderUrl = `${pageUrl.split('#')[0].split('?')[0]}#order=${encodeOrder(message)}`
  const pageLink = telegram(`Здравствуйте! Хочу заказать Чубу.\nПолный заказ: ${orderUrl}`)
  if (pageLink.length <= maxUrl) return { links: [pageLink], mode: 'page' }

  // Split unusually large orders without dropping data; each link is within Telegram's URL limit.
  const parts: string[] = []
  let part = ''
  for (const char of message) {
    if (encodeURIComponent(part + char).length > 3300) { parts.push(part); part = '' }
    part += char
  }
  if (part) parts.push(part)
  return { links: parts.map((text, i) => telegram(`Заказ Чубу — часть ${i + 1} из ${parts.length}\n${text}`)), mode: 'parts' }
}
