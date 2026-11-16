// Set to the deployed Worker URL only after its secrets and recipient are configured.
export const ORDER_API_URL = ''

export async function sendOrder(message: string, image: File | null): Promise<void> {
  const form = new FormData()
  form.set('message', message)
  if (image) form.set('image', image, image.name)
  const response = await fetch(ORDER_API_URL, { method: 'POST', body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) {
    if (data.error === 'partial_delivery') throw new Error('Часть заказа уже доставлена. Свяжитесь с продавцом, чтобы не отправить его повторно.')
    if (data.error === 'invalid_image' || response.status === 413) throw new Error('Выберите изображение PNG, JPG или WEBP размером до 5 МБ.')
    throw new Error('Не удалось отправить заказ. Проверьте соединение и попробуйте ещё раз.')
  }
}
