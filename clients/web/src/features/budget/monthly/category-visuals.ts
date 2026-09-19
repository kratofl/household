// Icon and system colour for a category tile. Categories carry no visual
// metadata yet, so the glyph comes from keywords in the name and the colour
// from the shared tile hash. Both are presentation only.

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

import { tileColor } from "../tile-colors"

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

export function categoryVisual(name: string): { icon: Glyph; color: string } {
  return { icon: glyphs.find(([pattern]) => pattern.test(name))?.[1] ?? IconTag, color: tileColor(name) }
}
