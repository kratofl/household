"use client"

import * as React from "react"
import { ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label: string
    color?: string
  }
>

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer")
  }
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
}: React.ComponentProps<"div"> & {
  id?: string
  config: ChartConfig
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex h-[260px] w-full justify-center text-caption",
          "[&_.recharts-cartesian-axis-tick_text]:fill-label-secondary",
          "[&_.recharts-cartesian-grid_line]:stroke-separator",
          "[&_.recharts-tooltip-cursor]:fill-fill",
          className,
        )}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorVars = Object.entries(config)
    .filter(([, item]) => item.color)
    .map(([key, item]) => `  --color-${key}: ${item.color};`)

  if (colorVars.length === 0) return null

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colorVars.join("\n")}\n}`,
      }}
    />
  )
}

type ChartTooltipPayload = {
  dataKey?: string | number
  name?: string | number
  value?: string | number
  color?: string
  payload?: Record<string, unknown>
}

function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string | number
  valueFormatter?: (value: string | number) => string
}) {
  const { config } = useChart()

  if (!active || !payload?.length) return null

  return (
    <div className="glass min-w-32 rounded-sm px-3 py-2 text-footnote text-label">
      {label ? <div className="mb-1 font-medium">{label}</div> : null}
      <div className="space-y-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "")
          const labelText = config[key]?.label ?? item.name ?? key
          const value = item.value ?? ""

          return (
            <div key={`${key}-${value}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-label-secondary">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.color ?? config[key]?.color }}
                />
                {labelText}
              </span>
              <span className="font-medium">
                {valueFormatter ? valueFormatter(value) : value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChartTooltip = RechartsTooltip

export { ChartContainer, ChartTooltip, ChartTooltipContent }
