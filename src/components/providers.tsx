import { ThemeProvider } from "~/components/theme-provider";
import { Toaster } from "~/components/ui/toaster";
import { NextAuthProvider } from "~/components/session-provider";

export async function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster />
      </ThemeProvider>
    </NextAuthProvider>
  );
}