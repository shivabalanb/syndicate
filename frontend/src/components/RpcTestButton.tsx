'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { testRpcConnection, NODE_URL } from '@/lib/casperService';

export default function RpcTestButton() {
  const [rpcStatus, setRpcStatus] = useState<{
    testing: boolean;
    result?: { success: boolean; message: string; latency?: number };
  }>({ testing: false });

  const handleTestRpc = async () => {
    setRpcStatus({ testing: true });
    const result = await testRpcConnection();
    setRpcStatus({ testing: false, result });
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTestRpc}
        disabled={rpcStatus.testing}
        className="gap-2">
        {rpcStatus.testing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : rpcStatus.result?.success ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : rpcStatus.result ? (
          <WifiOff className="h-4 w-4 text-red-500" />
        ) : (
          <Wifi className="h-4 w-4" />
        )}
        Test RPC
      </Button>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{NODE_URL}</p>
        {rpcStatus.result && (
          <p className={`text-xs ${rpcStatus.result.success ? 'text-green-600' : 'text-red-500'}`}>
            {rpcStatus.result.message}
            {rpcStatus.result.latency && ` (${rpcStatus.result.latency}ms)`}
          </p>
        )}
      </div>
    </div>
  );
}
