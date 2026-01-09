'use client';

import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from 'styled-components';
import { AccountMenuItem, CsprClickThemes } from '@make-software/csprclick-ui';

// Lazy load the library components
const ClickProvider = dynamic(
  () => import('@make-software/csprclick-ui').then((mod) => mod.ClickProvider),
  { ssr: false }
);

const ClickUI = dynamic(() => import('@make-software/csprclick-ui').then((mod) => mod.ClickUI), {
  ssr: false
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } }
});

const clickOptions = {
  appName: 'Syndicate',
  contentMode: 'iframe',
  providers: ['casper-wallet', 'ledger', 'casperdash', 'metamask-snap'],
  appId: 'csprclick-template' // <--- CRITICAL: Must be this exact string for localhost
};

export default function ClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClickProvider options={clickOptions}>
      <ThemeProvider theme={CsprClickThemes.light}>
      <ClickUI />

        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </ClickProvider>
  );
}
