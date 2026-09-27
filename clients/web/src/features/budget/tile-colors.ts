// One stable tint per name, so the same category or merchant always looks the same
// without anybody picking a colour. Red stays out: it means danger. Presentation only.

import type { Tone } from "@/lib/tone"

const tones: Tone[] = ["brand", "green", "blue", "purple", "yellow"]

export function tileTone(name: string): Tone {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return tones[hash % tones.length]
}
