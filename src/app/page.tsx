import Link from "next/link";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { ScissorsLineDashed, FileArchive, Share2, Wrench } from "lucide-react";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      {/* Hero Section */}
      <section className="w-full py-24 md:py-32">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
            Clip, Compress, Share
          </h1>
          <p className="mt-6 max-w-[600px] text-lg text-muted-foreground md:text-xl">
            The all-in-one platform for Discord communities to manage, edit and share video clips.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/tools">
              <Button size="lg" variant="outline" className="h-12 px-8">
                <Wrench className="mr-2" />
                Video Tools
              </Button>
            </Link>
            {session ? (
              <Link href="/clips">
                <Button size="lg" variant="secondary" className="h-12 px-8">
                  <Share2 className="mr-2" />
                  My Clips
                </Button>
              </Link>
            ) : (
              <Link href="/api/auth/signin">
                <Button size="lg" variant="secondary" className="h-12 px-8">
                  Sign in to View Clips
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="w-full py-24">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Link href="/tools/cut" className="group">
              <div className="flex flex-col items-center rounded-lg border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                <div className="rounded-full bg-primary/10 p-3 group-hover:bg-primary/20 transition-all">
                  <ScissorsLineDashed className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-bold">Cut Videos</h3>
                <p className="mt-2 text-muted-foreground">
                  Trim and cut your gaming clips with our easy-to-use editor. No login required!
                </p>
              </div>
            </Link>
            
            <Link href="/tools/compress" className="group">
              <div className="flex flex-col items-center rounded-lg border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                <div className="rounded-full bg-primary/10 p-3 group-hover:bg-primary/20 transition-all">
                  <FileArchive className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-bold">Compress Files</h3>
                <p className="mt-2 text-muted-foreground">
                  Optimize your videos with custom compression settings. Free for everyone!
                </p>
              </div>
            </Link>
            
            <Link href={session ? "/clips" : "/api/auth/signin"} className="group">
              <div className="flex flex-col items-center rounded-lg border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                <div className="rounded-full bg-primary/10 p-3 group-hover:bg-primary/20 transition-all">
                  <Share2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-bold">Share with Discord</h3>
                <p className="mt-2 text-muted-foreground">
                  Organize and share clips with your Discord communities. Sign in to access!
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </HydrateClient>
  );
}