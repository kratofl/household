import type { Metadata } from "next"
import { Figtree } from "next/font/google"

import { AppShell } from "@/components/app/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

import "./globals.css"

// The design system's font is SF Pro on Apple devices and Figtree everywhere
// else; globals.css puts the system font first in the stack.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "Household",
  description: "Local household dashboard for modules and account settings.",
  icons: {
    icon: "/household-logo.svg",
    apple: "/household-logo.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full antialiased", figtree.variable, "font-sans")}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
