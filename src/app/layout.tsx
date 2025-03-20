import "~/styles/globals.css";

import { Comfortaa } from "next/font/google"; // Changed to Comfortaa
import { cookies } from "next/headers";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/components/theme-provider";
import { Providers } from "~/components/providers";

const comfortaa = Comfortaa({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata = {
  title: "ClipIt - Clip, Compress, Share",
  description: "The all-in-one platform for Discord communities to manage, edit and share video clips.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get cookies as string for TRPC provider
  const cookieData = await cookies().toString();
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${comfortaa.variable}`} style={{ fontFamily: 'Comfortaa, sans-serif' }}>
        <Providers>
          <TRPCReactProvider cookies={cookieData}>
            {children}
          </TRPCReactProvider>
        </Providers>
      </body>
    </html>
  );
}