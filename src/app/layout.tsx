import type { Metadata, Viewport } from "next"
import { Montserrat } from "next/font/google"
import "./globals.css"

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PicFlow - Photo Validation",
  description: "Photo validation workflow for church media teams",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon", // Route dynamique
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PicFlow",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#5E17EB", // Violet ICC
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className={`${montserrat.variable} font-sans antialiased bg-gray-50`}>
        {children}
      </body>
    </html>
  )
}
