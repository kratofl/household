import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The design system's type styles (globals.css) are font sizes, so tailwind-merge
// must not mistake `text-callout` for a colour and drop it next to `text-label`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["large-title", "kpi", "title-1", "title-2", "title-3", "headline", "body", "callout", "footnote", "caption"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
