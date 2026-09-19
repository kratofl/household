// Icon and system colour for a category tile. Categories carry no visual
// metadata yet, so the glyph comes from keywords in the name and the colour
// from a stable hash. Both are presentation only.

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

export function categoryVisual(name: string): { icon: Glyph; color: string } {
  const icon = glyphs.find(([pattern]) => pattern.test(name))?.[1] ?? IconTag
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return { icon, color: colors[hash % colors.length] }
}
