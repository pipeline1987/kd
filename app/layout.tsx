import type { Metadata } from "next";
import { Barlow_Condensed, Shippori_Mincho, Source_Serif_4 } from "next/font/google";
import { Masthead } from "@/components/Masthead";
import { SiteFooter } from "@/components/SiteFooter";
import { articles } from "@/lib/articles";
import { formatDateline } from "@/lib/article";
import "./globals.css";

const masthead = Shippori_Mincho({
  variable: "--font-masthead",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const condensed = Barlow_Condensed({
  variable: "--font-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Konoha Daily",
    template: "%s · Konoha Daily",
  },
  description:
    "All ranks, D to S, reported daily. Twenty years of Konohagakure mission reports.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const latest = articles[0]!;
  return (
    <html
      lang="en"
      className={`${masthead.variable} ${serif.variable} ${condensed.variable} h-full`}
      data-theme="anbu"
    >
      <body className="min-h-full">
        <Masthead dateline={formatDateline(latest)} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
