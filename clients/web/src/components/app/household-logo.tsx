import Image from "next/image"

import { cn } from "@/lib/utils"

export function HouseholdLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/household-logo.svg"
      alt=""
      width={64}
      height={64}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  )
}
