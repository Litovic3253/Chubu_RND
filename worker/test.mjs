import assert from 'node:assert/strict'
import { handleRequest } from './worker.mjs'

const env = { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: '123', ALLOWED_ORIGIN: 'https://example.test' }
const headers = { Origin: env.ALLOWED_ORIGIN }
const makeRequest = (message, image) => {
  const form = new FormData()
  form.set('message', message)
  if (image) form.set('image', image, 'logo.png')
  return new Request('https://worker.test/order', { method: 'POST', headers, body: form })
}
const calls = []
const telegram = async (url, init) => {
  calls.push({ url, body: init.body })
  return Response.json({ ok: true, result: { message_id: calls.length } })
}

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
const image = new Blob([bytes], { type: 'image/png' })
const text = 'Детали заказа: ' + 'мелодия '.repeat(400)
let response = await handleRequest(makeRequest(text, image), env, telegram)
assert.equal(response.status, 200)
assert.equal(calls[0].url.endsWith('/sendDocument'), true)
assert.deepEqual(new Uint8Array(await calls[0].body.get('document').arrayBuffer()), bytes)
const messages = calls.slice(1).map(call => call.body.get('text'))
assert.equal(messages.join(''), text)
assert.ok(messages.every(part => [...part].length <= 4096))
assert.ok(calls.slice(1).every(call => JSON.parse(call.body.get('reply_parameters')).message_id === 1))

response = await handleRequest(makeRequest('тест', new Blob(['bad'], { type: 'text/plain' })), env, telegram)
assert.equal(response.status, 400)
response = await handleRequest(makeRequest('тест', image), env, async () => Response.json({ ok: false }, { status: 400 }))
assert.equal(response.status, 502)
let attempt = 0
response = await handleRequest(makeRequest('тест', image), env, async () => ++attempt === 1 ? Response.json({ ok: true, result: { message_id: 9 } }) : Response.json({ ok: false }, { status: 400 }))
assert.equal((await response.json()).error, 'partial_delivery')
const withoutImage = []
response = await handleRequest(makeRequest('Заказ без логотипа'), env, async (url, init) => { withoutImage.push({ url, body: init.body }); return Response.json({ ok: true, result: { message_id: 8 } }) })
assert.equal(response.status, 200)
assert.ok(withoutImage[0].url.endsWith('/sendMessage'))
response = await handleRequest(new Request('https://worker.test/order', { method: 'POST', headers: { Origin: 'https://other.test' } }), env, telegram)
assert.equal(response.status, 403)
console.log('Worker: original file, full order, invalid input and failures verified')
