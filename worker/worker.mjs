const MAX_IMAGE = 5 * 1024 * 1024
const MAX_REQUEST = MAX_IMAGE + 65536
const MAX_MESSAGE = 12000

export async function handleRequest(request, env, send = fetch) {
  const origin = request.headers.get('Origin')
  const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '', 'Vary': 'Origin' }
  const result = (status, data) => Response.json(data, { status, headers: cors })
  if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return result(403, { error: 'origin' })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/order') return result(404, { error: 'not_found' })
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return result(503, { error: 'not_configured' })
  const rawLength = Number(request.headers.get('Content-Length') || 0)
  if (rawLength > MAX_REQUEST) return result(413, { error: 'too_large' })
  let input
  try { input = await request.formData() } catch { return result(400, { error: 'invalid_form' }) }
  const message = input.get('message')
  const image = input.get('image')
  if (typeof message !== 'string' || !message.trim() || [...message].length > MAX_MESSAGE) return result(400, { error: 'invalid_message' })
  if (image !== null && (!(image instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(image.type) || image.size > MAX_IMAGE || image.size === 0)) return result(400, { error: 'invalid_image' })

  const api = async (method, payload) => {
    payload.set('chat_id', env.TELEGRAM_CHAT_ID)
    const response = await send(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', body: payload })
    const data = await response.json()
    if (!response.ok || !data.ok || !data.result?.message_id) throw new Error('Telegram request failed')
    return data.result.message_id
  }
  let delivered = false
  try {
    let replyId
    if (image) {
      const payload = new FormData()
      payload.set('document', image, image.name || 'logo')
      payload.set('caption', 'Логотип к заказу Чубу. Подробности в ответах к файлу.')
      replyId = await api('sendDocument', payload)
      delivered = true
    }
    const chars = [...message]
    for (let i = 0; i < chars.length; i += 4096) {
      const payload = new FormData()
      payload.set('text', chars.slice(i, i + 4096).join(''))
      if (replyId) payload.set('reply_parameters', JSON.stringify({ message_id: replyId }))
      const id = await api('sendMessage', payload)
      delivered = true
      replyId ||= id
    }
    return result(200, { ok: true })
  } catch {
    return result(502, { error: delivered ? 'partial_delivery' : 'delivery_failed' })
  }
}

export default { fetch: (request, env) => handleRequest(request, env) }
