'use client';

import Link from 'next/link';
import WalletConnect from './WalletConnect';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-purple-400 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LOGO */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            Syndicate
          </Link>
        </div>

        {/* RIGHT SIDE: Wallet Action */}
        <div className="flex items-center gap-4">
          <WalletConnect />
        </div>
      </div>
    </nav>
  );
}
