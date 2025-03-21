import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t py-6 md:py-0">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          Built with the T3 Stack & Next.js
        </p>
        <div className="flex items-center gap-4">
          <Link href="/test-upload" className="text-sm text-muted-foreground hover:underline">
            Test Upload
          </Link>
        </div>
      </div>
    </footer>
  );
}