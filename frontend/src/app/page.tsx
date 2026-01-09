'use client';

import RpcTestButton from "@/components/RpcTestButton";
import dynamic from "next/dynamic";

const CreateDAOModal = dynamic(
  () => import('@/components/CreateDAOModal'),
  { 
    ssr: false, // Prevents "window is undefined" errors for wallet components
    loading: () => <p>Loading Modal...</p> // Optional: loading state
  }
);

export default function Page() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="flex flex-col gap-6 pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Syndicate DAO</h1>
        <p className="text-xl text-slate-500">Welcome to your investment platform.</p>
      </div>
      <RpcTestButton />
      <CreateDAOModal/>
    </div>
  );
}
