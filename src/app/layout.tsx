import "~/styles/globals.css";

import { Comfortaa } from "next/font/google"; // Changed to Comfortaa
import { TRPCReactProvider } from "~/trpc/react";
import { Providers } from "~/components/providers";
import { NavigationBar } from "~/components/navigation-bar";
import { Footer } from "~/components/footer";
import { auth } from "~/server/auth";

// Server initialization
import { initializeServer } from "~/server/init";

// Initialize server-side services in production or when explicitly enabled
if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_SCHEDULER_IN_DEV === 'true') {
  initializeServer();
}

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
  // Get session for the navigation bar
  const session = await auth();
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${comfortaa.variable}`} style={{ fontFamily: 'Comfortaa, sans-serif' }}>
        <Providers>
          <TRPCReactProvider>
            <div className="flex flex-col min-h-screen bg-background text-foreground">
              <NavigationBar session={session} />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </TRPCReactProvider>
        </Providers>
      </body>
    </html>
  );
}