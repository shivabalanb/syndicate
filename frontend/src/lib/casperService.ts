import {
  CasperClient,
  CLAccountHash,
  CLKey,
  CLByteArray,
  decodeBase16,
  GetDeployResult
} from 'casper-js-sdk';

// Public Casper Testnet RPC endpoint
// NOTE: Port 35000 is P2P, port 7777 is RPC
export const NODE_URL = '/api/casper-rpc';
const client = new CasperClient(NODE_URL);

// --- TEST RPC CONNECTION ---
export async function testRpcConnection(): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  const startTime = Date.now();
  try {
    // Try to get the node status/peers - a lightweight RPC call
    const response = await fetch(`${NODE_URL}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'info_get_status',
        params: []
      })
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();

    if (data.error) {
      return { success: false, message: `RPC Error: ${data.error.message}` };
    }

    const chainName = data.result?.chainspec_name || 'unknown';
    return {
      success: true,
      message: `Connected to ${chainName}`,
      latency
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Connection failed'
    };
  }
}

// --- HELPER: Convert Hash String to CLKey (Address) ---
/**
 * Converts a string address (account-hash, hash, contract) into a CLKey for Odra/Casper arguments.
 * @param hashString The address string (e.g. "hash-...", "account-hash-...")
 * @returns A CLKey object suitable for RuntimeArgs
 */
export function stringToKey(hashString: string): CLKey {
  if (!hashString) throw new Error('Invalid hash string: null or undefined');

  const cleanHash = hashString
    .replace('account-hash-', '')
    .replace('hash-', '')
    .replace('contract-', '');

  const bytes = decodeBase16(cleanHash);

  // If it's an Account
  if (hashString.startsWith('account-hash')) {
    return new CLKey(new CLAccountHash(bytes));
  }

  // If it's a Contract or Package (Standard "hash-" or "contract-")
  return new CLKey(new CLByteArray(bytes));
}

// --- QUERY TOKEN CONTRACT FOR NAME AND SYMBOL ---
/**
 * Fetches token name and symbol from a deployed token contract
 * @param contractHash The contract hash (e.g. "hash-..." or just the hex)
 * @returns Object with name and symbol, or null if failed
 */
export async function fetchTokenMetadata(contractHash: string): Promise<{
  name: string;
  symbol: string;
} | null> {
  try {
    const cleanHash = contractHash.replace('hash-', '').replace('contract-', '');

    // Query the contract's named keys for 'name' and 'symbol'
    const response = await fetch(`${NODE_URL}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'query_global_state',
        params: {
          state_identifier: null, // latest state
          key: `hash-${cleanHash}`,
          path: []
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('RPC Error:', data.error);
      return null;
    }

    // Parse the stored values from the contract state
    const storedValue = data.result?.stored_value;
    if (!storedValue?.Contract) {
      console.error('Not a contract:', storedValue);
      return null;
    }

    const namedKeys = storedValue.Contract.named_keys || [];

    // Find name and symbol keys
    let nameKey = namedKeys.find((k: any) => k.name === 'name')?.key;
    let symbolKey = namedKeys.find((k: any) => k.name === 'symbol')?.key;

    if (!nameKey || !symbolKey) {
      console.error('Name or symbol key not found in contract');
      return null;
    }

    // Fetch the actual values
    const [nameResult, symbolResult] = await Promise.all([
      fetchURef(nameKey),
      fetchURef(symbolKey)
    ]);

    return {
      name: nameResult || '',
      symbol: symbolResult || ''
    };
  } catch (err) {
    console.error('Failed to fetch token metadata:', err);
    return null;
  }
}

async function fetchURef(urefKey: string): Promise<string | null> {
  try {
    const response = await fetch(`${NODE_URL}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'query_global_state',
        params: {
          state_identifier: null,
          key: urefKey,
          path: []
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return null;
    }

    const storedValue = data.result?.stored_value;
    if (storedValue?.CLValue?.parsed) {
      return storedValue.CLValue.parsed;
    }

    return null;
  } catch {
    return null;
  }
}
