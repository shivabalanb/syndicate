'use client';
import dynamic from 'next/dynamic';

// Dynamically import components that use @make-software/csprclick-ui
// to prevent SSR errors (the library accesses window during initialization)
const AppBody = dynamic(() => import('../components/AppBody'), {
  ssr: false
});

export default function Page() {
  return <AppBody />;
}
