import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import { AppShell } from "@/components/app/app-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { defaultThemeId, themeInitScript } from "@/lib/theme"
import { cn } from "@/lib/utils"

import "./globals.css"

// Inter is the closest open alternative to SF Pro; globals.css enables cv11/ss01/tnum.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Household",
  description: "Local household dashboard for modules, account settings, and updates.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={defaultThemeId}
      className={cn("h-full antialiased", inter.variable, geistMono.variable, "font-sans")}
    >
      <head>
        {/* Applies the stored accent theme before first paint, like next-themes does for dark mode. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
