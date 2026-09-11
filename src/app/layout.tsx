import type { Metadata, Viewport } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/app/pwa-register";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EDOS Poultry360",
  description: "Manage every flock. Every farmer. Every decision.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Edospoultry360",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app draw edge-to-edge behind a notch/Dynamic Island/home
  // indicator when installed as a standalone PWA -- required for the
  // env(safe-area-inset-*) CSS already used in the app shell (header top
  // padding, bottom nav's pb-[env(safe-area-inset-bottom)]) to resolve to
  // anything other than 0. Without this, that CSS is silently inert, and
  // a browser tab (which reserves that space itself via its own chrome)
  // looks fine while the installed app doesn't.
  viewportFit: "cover",
  themeColor: "#1d4d43",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
