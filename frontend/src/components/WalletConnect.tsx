'use client';

import { useEffect, useState } from 'react';
import { useClickRef } from '@make-software/csprclick-ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Wallet, LogOut, Copy, ExternalLink } from 'lucide-react';

export default function WalletConnect() {
  const clickRef = useClickRef();
  const [activeAccount, setActiveAccount] = useState<string | null>(null);

  useEffect(() => {
    const checkAccount = async () => {
      const activeAccount = await clickRef?.getActiveAccountAsync();
      setActiveAccount(activeAccount?.public_key || null);
  };
    checkAccount()

    const update = (evt: any) => setActiveAccount(evt.account?.public_key || null);
    const clear = () => setActiveAccount(null);

    clickRef?.on('csprclick:signed_in', update);
    clickRef?.on('csprclick:switched_account', update);
    clickRef?.on('csprclick:signed_out', clear);
    clickRef?.on('csprclick:disconnected', clear);
  }, [clickRef]);

  const shortAddr = activeAccount
    ? `${activeAccount.slice(0, 6)}...${activeAccount.slice(-5)}`
    : '';

  if (!activeAccount) {
    return (
      <Button 
        onClick={() => clickRef?.signIn()} 
        className="gap-2 shadow-sm cursor-pointer" // Added cursor-pointer
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="relative p-6 pl-4 gap-2 rounded-full border-slate-200 cursor-pointer" // Added cursor-pointer
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={`https://api.dicebear.com/7.x/identicon/svg?seed=${activeAccount}`} />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <span className="font-mono text-xs hidden sm:inline-block">{shortAddr}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">My Wallet</p>
            <p className="text-xs leading-none text-muted-foreground break-all">{shortAddr}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer" // <--- FIX HERE
          onSelect={(e) => {
            e.preventDefault();
            navigator.clipboard.writeText(activeAccount);
          }}>
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy Address</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="cursor-pointer" // <--- FIX HERE
          onClick={() =>
            window.open(`https://testnet.cspr.live/account/${activeAccount}`, '_blank')
          }>
          <ExternalLink className="mr-2 h-4 w-4" />
          <span>View on Explorer</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600" // <--- FIX HERE
          onClick={() => clickRef?.signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}