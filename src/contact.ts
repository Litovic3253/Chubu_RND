export function contactLink(input: string): string | null {
  const value = input.trim()
  const username = value.match(/^@?([a-zA-Z][a-zA-Z0-9_]{4,31})$/)
  if (username) return `https://t.me/${username[1]}`
  const link = value.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-zA-Z][a-zA-Z0-9_]{4,31})\/?$/i)
  if (link) return `https://t.me/${link[1]}`
  if (!/^\+?[\d\s()\-]+$/.test(value)) return null
  let digits = value.replace(/\D/g, '')
  if (/^8\d{10}$/.test(digits)) digits = '7' + digits.slice(1)
  else if (/^9\d{9}$/.test(digits)) digits = '7' + digits
  if (digits.length < 10 || digits.length > 15 || digits.startsWith('0')) return null
  return `https://t.me/+${digits}`
}
