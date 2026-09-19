"use client"

// The merchant's face in lists and pickers. A shipped logo when there is one, otherwise a
// monogram on the brand's own colour, so a tile never sits empty and adding a logo later is
// only a file. Shares the shape and size of IconTile.

import { useState } from "react"

import { cn } from "@/lib/utils"

import { logoUrl, merchantColor, monogram, monogramInk, type Merchant } from "./merchants"

export function MerchantTile({ merchant, size = 28, className }: { merchant: Merchant; size?: number; className?: string }) {
  const url = logoUrl(merchant)
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size, borderRadius: size * 0.25 }

  // A catalog entry whose logo file has not been added yet falls back like any other merchant.
  if (url && !broken) {
    return (
      <span className={cn("icon-tile bg-card p-[15%]", className)} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" aria-hidden className="size-full object-contain" onError={() => setBroken(true)} />
      </span>
    )
  }
  const background = merchantColor(merchant)
  return (
    <span
      className={cn("icon-tile font-semibold", className)}
      style={{ ...style, background, color: monogramInk(background), fontSize: size * 0.4 }}
    >
      {monogram(merchant.name)}
    </span>
  )
}
