import Link from "next/link";
import { HydrateClient } from "~/trpc/server";
import { Button } from "~/components/ui/button";
import { 
  ScissorsLineDashed, 
  FileArchive, 
  Download, 
  Wrench,
  ChevronRight
} from "lucide-react";

export default async function ToolsPage() {
  return (
    <HydrateClient>
      <section className="w-full py-12 md:py-24">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-12">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Video Tools
            </h1>
            <p className="mt-4 max-w-[600px] text-muted-foreground">
              Powerful tools to help you manage, edit, and share your video content
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Video Cutting Tool */}
            <div className="flex flex-col h-full rounded-lg border bg-card shadow-sm transition-all hover:shadow-md">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-full bg-primary/10 p-3">
                    <ScissorsLineDashed className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Video Cutter</h3>
                </div>
                <p className="text-muted-foreground mb-6">
                  Trim and cut your gaming clips with our easy-to-use editor. No login required!
                </p>
                <Link href="/tools/cut" className="mt-auto">
                  <Button className="w-full">
                    Cut Video
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Video Compression Tool */}
            <div className="flex flex-col h-full rounded-lg border bg-card shadow-sm transition-all hover:shadow-md">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-full bg-primary/10 p-3">
                    <FileArchive className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Video Compression</h3>
                </div>
                <p className="text-muted-foreground mb-6">
                  Reduce video file size while maintaining quality with our compression tool.
                </p>
                <Link href="/tools/compress" className="mt-auto">
                  <Button className="w-full">
                    Compress Video
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Coming Soon Tool */}
            <div className="flex flex-col h-full rounded-lg border bg-card shadow-sm transition-opacity opacity-75">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-full bg-muted p-3">
                    <Download className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">Video Downloader</h3>
                </div>
                <p className="text-muted-foreground mb-6">
                  Download videos from various platforms. Coming soon!
                </p>
                <Button disabled variant="outline" className="w-full">
                  Coming Soon
                </Button>
              </div>
            </div>

            {/* Coming Soon - Additional Tools */}
            <div className="flex flex-col h-full rounded-lg border bg-card shadow-sm transition-opacity opacity-75">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-full bg-muted p-3">
                    <Wrench className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">More Tools</h3>
                </div>
                <p className="text-muted-foreground mb-6">
                  Additional video tools are on the way. Stay tuned for updates!
                </p>
                <Button disabled variant="outline" className="w-full">
                  Coming Soon
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </HydrateClient>
  );
}