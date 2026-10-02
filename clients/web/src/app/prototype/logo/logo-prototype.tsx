"use client"

// PROTOTYPE ONLY. Shapes for the Household logo, all built the way Apple's
// Photos icon is: clear, saturated glass blocks laid on top of each other.
// Where a block lies over another, the two colours multiply into a deeper
// tone; every block has a light cut edge, brightest along the top, and the
// whole stack casts one soft shadow. Shown bare as the brand mark and on a
// plate as the app icon, at the sizes the app really uses.

import { useId, type ReactNode } from "react"

import { HouseholdLogo } from "@/components/app/household-logo"
import { cn } from "@/lib/utils"

type Point = [number, number]
type Stops = [string, string]

// Amber, orange and deep orange: close enough to stay one brand colour, far
// enough apart that their overlaps read as a third tone.
const AMBER: Stops = ["#ffc54d", "#ff9f0a"]
const ORANGE: Stops = ["#ff9d3d", "#ff7512"]
const DEEP: Stops = ["#ff7c30", "#f4520c"]

/** One glass block. `clear: false` hides what lies beneath it instead of showing it through. */
type Block = { key: string; d: string; transform?: string; colours: Stops; clear?: boolean }

type Shape = { blocks: Block[]; plateFit: string }

/** A polygon with each corner rounded by its radius (one number for all corners). */
function roundedPolygon(points: Point[], radius: number | number[]) {
  const toward = ([ax, ay]: Point, [bx, by]: Point, distance: number): Point => {
    const length = Math.hypot(bx - ax, by - ay)
    return [ax + ((bx - ax) / length) * distance, ay + ((by - ay) / length) * distance]
  }
  const f = (n: number) => n.toFixed(1)
  return (
    points
      .map((point, i) => {
        const r = typeof radius === "number" ? radius : radius[i]
        const [ax, ay] = toward(point, points[(i - 1 + points.length) % points.length], r)
        const [bx, by] = toward(point, points[(i + 1) % points.length], r)
        return `${i === 0 ? "M" : "L"}${f(ax)} ${f(ay)}Q${point[0]} ${point[1]} ${f(bx)} ${f(by)}`
      })
      .join("") + "Z"
  )
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  return roundedPolygon(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    r,
  )
}

const SHAPES = {
  // Today's logo as glass: the tower over two annexes. The front annex covers the foot of the roof block.
  current: {
    plateFit: "translate(92 86) scale(0.64)",
    blocks: [
      { key: "back", colours: DEEP, d: "M228 176h126c56.3 0 102 45.7 102 102v22H192V212c0-19.9 16.1-36 36-36Z" },
      {
        key: "front",
        colours: ORANGE,
        clear: false,
        d: "M228 274h218c23.2 0 42 18.8 42 42v130c0 23.2-18.8 42-42 42H228c-19.9 0-36-16.1-36-36V310c0-19.9 16.1-36 36-36Z",
      },
      { key: "tower", colours: AMBER, d: roundedRect(32, 24, 224, 464, 36) },
    ],
  },
  // The lowercase h, abstract. A round-ended stem and a solid shoulder that
  // starts inside it, so there is no counter between the legs; the stem's
  // right edge shows through the shoulder as a lens.
  // A: the shoulder is a block with one big round corner.
  corner: {
    plateFit: "translate(97 97) scale(0.62)",
    blocks: [
      { key: "stem", colours: AMBER, d: roundedRect(80, 40, 136, 432, 68) },
      {
        key: "shoulder",
        colours: DEEP,
        d: "M208 200H300A140 140 0 0 1 440 340V424Q440 472 392 472H208Q160 472 160 424V248Q160 200 208 200Z",
      },
    ],
  },
  // B: the shoulder is a dome, the arch of a written h and of a doorway.
  dome: {
    plateFit: "translate(97 97) scale(0.62)",
    blocks: [
      { key: "stem", colours: AMBER, d: roundedRect(80, 40, 136, 432, 68) },
      { key: "shoulder", colours: DEEP, d: "M208 472Q160 472 160 424V300A140 140 0 0 1 440 300V424Q440 472 392 472Z" },
    ],
  },
  // C: the dome taken apart into a disc over a base, so three tones meet.
  disc: {
    plateFit: "translate(97 97) scale(0.62)",
    blocks: [
      { key: "stem", colours: AMBER, d: roundedRect(80, 40, 136, 432, 68) },
      { key: "base", colours: ORANGE, d: roundedRect(160, 330, 280, 142, 44) },
      { key: "disc", colours: DEEP, d: "M180 318A130 130 0 1 0 440 318A130 130 0 1 0 180 318Z" },
    ],
  },
} satisfies Record<string, Shape>

type ShapeKey = keyof typeof SHAPES

// Superellipse with n = 5, close to the continuous corner of Apple's icons.
const PLATE = (() => {
  const points: string[] = []
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * 2 * Math.PI
    const x = 256 + 256 * Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** 0.4
    const y = 256 + 256 * Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 0.4
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `M${points.join("L")}Z`
})()

export function GlassLogo({
  shape,
  plate,
  dark = false,
  className,
}: {
  shape: ShapeKey
  plate: boolean
  dark?: boolean
  className?: string
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "")
  const url = (name: string) => `url(#${id}-${name})`
  const { blocks, plateFit } = SHAPES[shape]

  // The first `count` blocks as they look stacked: each block paints over what
  // is beneath, then, if it is clear, shows that again through itself,
  // multiplied with its own colour.
  function stack(count: number): ReactNode {
    if (count === 0) return null
    const below = stack(count - 1)
    const block: Block = blocks[count - 1]
    return (
      <>
        {below}
        <path d={block.d} transform={block.transform} fill={url(`fill-${block.key}`)} />
        {below && block.clear !== false ? (
          <g clipPath={url(`clip-${block.key}`)} opacity={0.8} style={{ mixBlendMode: "multiply" }}>
            {below}
          </g>
        ) : null}
        <g clipPath={url(`clip-${block.key}`)}>
          <path d={block.d} transform={block.transform} fill="none" stroke={url("edge")} strokeWidth={9} />
        </g>
      </>
    )
  }

  return (
    <svg viewBox="0 0 512 512" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        {blocks.map((block: Block) => (
          <g key={block.key}>
            <linearGradient id={`${id}-fill-${block.key}`} x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" stopColor={block.colours[0]} />
              <stop offset="1" stopColor={block.colours[1]} />
            </linearGradient>
            <clipPath id={`${id}-clip-${block.key}`}>
              <path d={block.d} transform={block.transform} />
            </clipPath>
          </g>
        ))}
        {/* The cut edge: bright along the top, still faintly lit at the bottom. */}
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="0.35" stopColor="#fff" stopOpacity={0.4} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.25} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={14} />
          <feOffset dy={16} result="drop" />
          <feFlood floodColor={dark ? "#000" : "#a33600"} floodOpacity={dark ? 0.5 : 0.25} />
          <feComposite operator="in" in2="drop" />
        </filter>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={dark ? "#3a3a3c" : "#ffffff"} />
          <stop offset="1" stopColor={dark ? "#1c1c1e" : "#ececf0"} />
        </linearGradient>
        <linearGradient id={`${id}-plate-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.7} />
          <stop offset="0.2" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <clipPath id={`${id}-clip-plate`}>
          <path d={PLATE} />
        </clipPath>
      </defs>

      {plate ? (
        <>
          <path d={PLATE} fill={url("plate")} />
          <g clipPath={url("clip-plate")}>
            <path d={PLATE} fill="none" stroke={url("plate-edge")} strokeWidth={8} />
          </g>
        </>
      ) : null}

      <g transform={plate ? plateFit : undefined}>
        <g filter={url("shadow")}>
          {blocks.map((block: Block) => (
            <path key={block.key} d={block.d} transform={block.transform} />
          ))}
        </g>
        <g style={{ isolation: "isolate" }}>{stack(blocks.length)}</g>
      </g>
    </svg>
  )
}

type Row = "now" | ShapeKey

const ROWS: { key: Row; title: string; note: string }[] = [
  { key: "now", title: "Jetzt", note: "Die heutige Datei, flach." },
  { key: "current", title: "Heutige Form als Glas", note: "Der Stand von eben, zum Vergleich." },
  { key: "corner", title: "A · h mit Eckbogen", note: "Stamm und ein Block mit einer großen runden Ecke. Am nächsten an der heutigen Form, nur in zwei Teilen." },
  { key: "dome", title: "B · h mit Kuppel", note: "Die Schulter ist ein Bogen wie beim geschriebenen h, zugleich eine Haustür." },
  { key: "disc", title: "C · h aus Kreis und Sockel", note: "Die Kuppel in Kreis und Sockel zerlegt. Drei Farben, drei Überlappungen, am meisten Glas." },
]

function Mark({ row, dark, plate = false, className }: { row: Row; dark: boolean; plate?: boolean; className: string }) {
  if (row === "now") return <HouseholdLogo className={className} />
  return <GlassLogo shape={row} plate={plate} dark={dark} className={className} />
}

function Panel({ row, dark }: { row: Row; dark: boolean }) {
  return (
    <div className={cn("flex-1 rounded-2xl bg-background p-5 text-foreground", dark && "dark")}>
      <div className="flex items-end gap-6">
        <Mark row={row} dark={dark} className="size-40" />
        <Mark row={row} dark={dark} className="size-20" />
        {row === "now" ? null : <Mark row={row} dark={dark} plate className="size-20" />}
        <div className="flex flex-col gap-3">
          <div className="flex h-14 items-center gap-2.5 rounded-xl bg-sidebar px-4 shadow-[0_0_0_0.5px_var(--glass-rim)]">
            <Mark row={row} dark={dark} className="size-8" />
            <span className="text-[19px] leading-none font-bold tracking-[-0.03em]">Household</span>
          </div>
          <div className="flex h-8 w-44 items-center gap-2 rounded-t-lg bg-fill-3 px-3 text-[12px]">
            <Mark row={row} dark={dark} plate className="size-4" />
            Household
          </div>
        </div>
      </div>
    </div>
  )
}

export function LogoPrototype() {
  return (
    <main className="min-h-screen bg-sidebar p-8 text-foreground">
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">Logo als kleines h</h1>
      <p className="mt-1 max-w-2xl text-muted-foreground">
        Gleiches Glas wie eben. Von links: Login-Größe, klein, auf Platte als App-Icon, im Header, als Favicon.
      </p>
      <div className="mt-8 flex flex-col gap-8">
        {ROWS.map((row) => (
          <section key={row.key}>
            <h2 className="text-[17px] font-semibold">{row.title}</h2>
            <p className="mb-3 text-muted-foreground">{row.note}</p>
            <div className="flex flex-col gap-4 xl:flex-row">
              <Panel row={row.key} dark={false} />
              <Panel row={row.key} dark />
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
