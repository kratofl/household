// One stable colour per name, so the same category or merchant always looks the same
// without anybody picking a colour. Presentation only.

const colors = [
  "var(--sys-green)",
  "var(--sys-blue)",
  "var(--sys-indigo)",
  "var(--sys-purple)",
  "var(--sys-pink)",
  "var(--sys-teal)",
  "var(--sys-brown)",
  "var(--sys-orange)",
]

export function tileColor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return colors[hash % colors.length]
}
