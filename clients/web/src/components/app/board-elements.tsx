"use client"

// Structural elements every board offers, independent of any module: a heading,
// a line of text, and a divider. They carry their own text, so several copies can
// sit on one board. The tray lists them under "Household", above the modules.

import type { WidgetDefinition } from "@/components/app/widget-board"
import { Input } from "@/components/ui/input"
import type { Translator } from "@/lib/i18n"

export function boardElements(t: Translator): WidgetDefinition[] {
  return [
    {
      id: "core.heading",
      title: t("widgets.heading"),
      w: 12,
      h: 1,
      repeatable: true,
      render: (instance) =>
        instance.editing ? (
          <Input
            aria-label={t("widgets.heading")}
            placeholder={t("widgets.heading")}
            value={instance.text}
            maxLength={80}
            onChange={(event) => instance.setText(event.target.value)}
            className="h-full border-0 bg-transparent text-[20px] font-semibold tracking-[-0.01em] shadow-none focus-visible:ring-0"
          />
        ) : (
          <h2 className="flex h-full items-center text-[20px] font-semibold tracking-[-0.01em]">{instance.text}</h2>
        ),
    },
    {
      id: "core.label",
      title: t("widgets.label"),
      w: 4,
      h: 1,
      repeatable: true,
      render: (instance) =>
        instance.editing ? (
          <Input
            aria-label={t("widgets.label")}
            placeholder={t("widgets.label")}
            value={instance.text}
            maxLength={160}
            onChange={(event) => instance.setText(event.target.value)}
            className="h-full border-0 bg-transparent text-muted-foreground shadow-none focus-visible:ring-0"
          />
        ) : (
          <p className="flex h-full items-center text-muted-foreground">{instance.text}</p>
        ),
    },
    {
      id: "core.divider",
      title: t("widgets.divider"),
      w: 12,
      h: 1,
      repeatable: true,
      render: () => (
        <div className="flex h-full items-center">
          <span className="h-px w-full bg-separator" />
        </div>
      ),
    },
  ]
}
