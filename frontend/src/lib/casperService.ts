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
    const response = await fetch(NODE_URL, {
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

// --- HELPER: Sleep ---
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- HELPER: Poll for Execution ---
/**
 * Polls the network until a deploy is executed.
 * @param deployHash The hex string of the deploy hash.
 * @returns The execution result object from the node.
 */
export async function waitForDeploy(deployHash: string): Promise<any> {
  let attempts = 0;
  while (attempts < 60) {
    // Try for ~3 minutes
    try {
      // The SDK's getDeploy returns [Deploy, GetDeployResult]
      // We force cast 'raw' to any because the SDK types for execution_results are sometimes incomplete
      const [_, raw] = await client.getDeploy(deployHash);
      const result = raw as any;

      if (result.execution_results && result.execution_results.length > 0) {
        return result.execution_results[0]; // Return the first result
      }
    } catch (err) {
      // Deploy might not be found yet (404), ignore and wait
    }
    await sleep(3000); // Check every 3 seconds
    attempts++;
  }
  throw new Error('Timeout waiting for deploy execution');
}

// --- HELPER: Parse Contract Hash from Effects ---
/**
 * Parses the "Write" effects of a transaction to find the newly created contract hash.
 * @param executionResult The raw execution result object.
 * @returns The contract hash string (e.g., "hash-123..." or "contract-123...").
 */
export function parseContractHash(executionResult: any): string {
  if (!executionResult || !executionResult.result) {
    throw new Error('Invalid execution result object');
  }

  // Check for failure
  if (executionResult.result.Failure) {
    throw new Error('Deploy failed on-chain: ' + JSON.stringify(executionResult.result.Failure));
  }

  // Access the effects (transforms)
  const effects = executionResult.result.Success?.effect?.transforms;

  if (!effects || !Array.isArray(effects)) {
    throw new Error('No effects found in execution result.');
  }

  // Strategy: Look for the Key that was written which starts with "contract-" or "hash-"
  // Since we are deploying, we look for the NEWLY created contract.
  for (const transform of effects) {
    const key: string = transform.key;

    // Odra usually saves the package hash under the name provided in odra_cfg_package_hash_key_name
    // But generic parsing looks for the raw hash.
    if (key.startsWith('hash-') || key.startsWith('contract-')) {
      // Simple heuristic: If it's a 'Write' operation, it's likely our new contract
      // You might need to refine this if your contract does many writes.
      // The transform structure is usually { key: "...", transform: "Write" | { Write: ... } }
      // We check if "Write" exists as a key or value depending on node version
      if (
        transform.transform === 'Write' ||
        (typeof transform.transform === 'object' && 'Write' in transform.transform)
      ) {
        return key;
      }
    }
  }
  throw new Error('Could not find new Contract Hash in transaction effects.');
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
