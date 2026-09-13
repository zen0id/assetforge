import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AssetForge — Free Developer Web Utilities',
  description: 'Fast, client-side web tools for converting SVGs, JSON schemas, and generating CSS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">
                AF
              </div>
              <span className="font-semibold text-lg tracking-tight">AssetForge</span>
            </div>
            <div className="text-xs text-slate-400 border border-slate-800 px-2.5 py-1 rounded-full bg-slate-900">
              ⚡ 100% Local & Secure
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">{children}</main>

        <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
          Build assets faster. Free micro-tools for developers.
        </footer>
      </body>
    </html>
  );
}