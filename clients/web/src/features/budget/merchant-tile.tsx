"use client"

// The merchant's face in lists and pickers. A shipped logo when there is one, then a
// monogram on the brand's own colour, otherwise a monogram on the hashed tint, so a
// tile never sits empty and adding a logo later is only a file. Shares the shape and
// size of IconTile.

import { useState } from "react"

import { tileRadius } from "@/components/app/grouped"
import { toneTint } from "@/lib/tone"
import { cn } from "@/lib/utils"

import { logoUrl, monogram, monogramInk, type Merchant } from "./merchants"
import { tileTone } from "./tile-colors"

export function MerchantTile({ merchant, size = 32, className }: { merchant: Merchant; size?: number; className?: string }) {
  const url = logoUrl(merchant)
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size, borderRadius: tileRadius(size) }
  const tile = "inline-flex shrink-0 items-center justify-center font-semibold"

  // A catalog entry whose logo file has not been added yet falls back like any other merchant.
  if (url && !broken) {
    return (
      <span className={cn(tile, "border border-separator bg-white p-[15%]", className)} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" aria-hidden className="size-full object-contain" onError={() => setBroken(true)} />
      </span>
    )
  }
  const text = { fontSize: size * 0.4 }
  if (merchant.color) {
    return (
      <span className={cn(tile, className)} style={{ ...style, ...text, background: merchant.color, color: monogramInk(merchant.color) }}>
        {monogram(merchant.name)}
      </span>
    )
  }
  return (
    <span className={cn(tile, toneTint[tileTone(merchant.name)], className)} style={{ ...style, ...text }}>
      {monogram(merchant.name)}
    </span>
  )
}
