interface Props {
  text: string
  status: 'idle' | 'pending' | 'copied' | 'manual'
  copy: () => void
}

export function OrderDelivery({ text, status, copy }: Props) {
  return <div id="result" className="order-delivery" role="status" aria-live="polite">
    <strong>{status === 'copied' ? 'Заказ скопирован' : status === 'manual' ? 'Скопируйте заказ вручную' : 'Подготавливаем заказ'}</strong>
    <p>{status === 'copied'
      ? 'В открывшемся чате Telegram вставьте заказ в поле сообщения и нажмите «Отправить».'
      : status === 'manual'
        ? 'Выделите текст ниже и скопируйте его. Затем откройте чат, вставьте текст и нажмите «Отправить».'
        : 'Если Telegram не открылся, воспользуйтесь ссылкой ниже.'}</p>
    <div className="order-delivery-actions">
      <button type="button" className="subtle" onClick={copy}>Скопировать заказ</button>
      <a className="subtle" href="https://t.me/LastJoudas" target="_blank" rel="noopener noreferrer">Открыть чат в Telegram ↗</a>
    </div>
    <label>Текст заказа<textarea readOnly value={text} onFocus={event => event.currentTarget.select()}/></label>
  </div>
}
