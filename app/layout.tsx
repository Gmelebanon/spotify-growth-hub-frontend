import type { Metadata, Viewport } from "next";
import "./globals.css";

import Providers from "./Providers";

export const metadata: Metadata = {
  title: "Spotify Growth Hub",
  description: "Spotify Growth Hub Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
