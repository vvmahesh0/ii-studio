import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "II studio",
  description: "Describe your idea and generate an interface.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={"h-full antialiased"}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
