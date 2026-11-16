import { decodeOrder } from './orderLinks'

export function OrderView({ encoded }: { encoded: string }) {
  let text = ''
  try { text = decodeOrder(encoded) } catch { text = 'Не удалось прочитать заказ. Попросите клиента отправить ссылку ещё раз.' }
  return <main className="wrap" style={{paddingTop: '40px', paddingBottom: '40px'}}>
    <section className="card order-delivery"><span className="kicker">ЧУБУ</span><h1>Детали заказа</h1>
      <p>Данные находятся в этой ссылке. Передавайте её только тем, кому предназначен заказ.</p>
      <pre style={{whiteSpace:'pre-wrap', overflowWrap:'anywhere', font:'inherit', lineHeight:1.7}}>{text}</pre>
      <a className="subtle" href={window.location.pathname}>Открыть конфигуратор</a>
    </section>
  </main>
}
