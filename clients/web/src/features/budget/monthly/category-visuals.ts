import {
  IconBabyCarriage,
  IconBottle,
  IconCar,
  IconDeviceLaptop,
  IconGasStation,
  IconGift,
  IconHeart,
  IconHome,
  IconMovie,
  IconPaw,
  IconPlane,
  IconShirt,
  IconShoppingCart,
  IconTag,
  IconToolsKitchen2,
} from "@tabler/icons-react"

import type { Tone } from "@/lib/tone"

import { tileTone } from "../tile-colors"

type Glyph = typeof IconTag

const glyphs: [RegExp, Glyph][] = [
  [/tank|benzin|sprit|diesel/i, IconGasStation],
  [/lebensmittel|einkauf|supermarkt|rewe|edeka|aldi|lidl/i, IconShoppingCart],
  [/essen|restaurant|café|cafe|bäcker|lieferando/i, IconToolsKitchen2],
  [/kleid|mode|schuh/i, IconShirt],
  [/freizeit|kino|hobby|sport|spiel/i, IconMovie],
  [/haushalt|wohn|möbel|baumarkt/i, IconHome],
  [/drogerie|pflege|apotheke/i, IconBottle],
  [/auto|kfz|werkstatt|parken/i, IconCar],
  [/elektro|technik|computer|handy/i, IconDeviceLaptop],
  [/geschenk/i, IconGift],
  [/gesund|arzt|medi/i, IconHeart],
  [/kind|baby|schule/i, IconBabyCarriage],
  [/tier|hund|katze/i, IconPaw],
  [/reise|urlaub|flug|hotel/i, IconPlane],
]

export const categoryColors = ["brand", "green", "blue", "purple", "yellow"] as const
export const categoryIcons = {
  tag: IconTag, cart: IconShoppingCart, home: IconHome, car: IconCar,
  fuel: IconGasStation, food: IconToolsKitchen2, shirt: IconShirt, movie: IconMovie,
  bottle: IconBottle, laptop: IconDeviceLaptop, gift: IconGift, heart: IconHeart,
  baby: IconBabyCarriage, paw: IconPaw, plane: IconPlane,
}

export function categoryVisual(name: string, appearance?: { color: string; icon: string }): { icon: Glyph; tone: Tone } {
  const icon = Object.entries(categoryIcons).find(([key]) => key === appearance?.icon)?.[1]
  const tone = categoryColors.find(color => color === appearance?.color)
  return { icon: icon ?? glyphs.find(([pattern]) => pattern.test(name))?.[1] ?? IconTag, tone: tone ?? tileTone(name) }
}
