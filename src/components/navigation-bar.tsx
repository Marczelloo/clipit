import Link from "next/link";
import type { Session } from "next-auth";
import { Video } from "lucide-react";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";

interface NavigationBarProps {
  session: Session | null;
}

export async function NavigationBar({ session }: NavigationBarProps) {
  return (
    <nav className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">ClipIt</span>
        </Link>
        <div className="flex items-center gap-4">
            <Link href="/tools">
                <Button variant="ghost">Tools</Button>
            </Link>
            <ThemeToggle />
            {session ? (
            <div className="flex items-center gap-4">
                <Link href="/clips">
                <Button variant="default">My Clips</Button>
                </Link>
                <Link href="/api/auth/signout">
                <Button variant="outline">Sign out</Button>
                </Link>
            </div>
            ) : (
            <Link href="/api/auth/signin">
                <Button>Sign in</Button>
            </Link>
            )}
        </div>
      </div>
    </nav>
  );
}