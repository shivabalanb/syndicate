'use client';

import { useState } from 'react';
import { useClickRef } from '@make-software/csprclick-ui';
import {
  DeployUtil,
  RuntimeArgs,
  CLValueBuilder,
  CLPublicKey,
  CLAccountHash,
  CLKey,
  decodeBase16
} from 'casper-js-sdk';
import { stringToKey } from '@/lib/casperService';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, CheckCircle, ArrowRight, Copy, SkipForward } from 'lucide-react';

// --- CONFIG ---
const CHAIN_NAME = 'casper-test';
const REGISTRY_CONTRACT_HASH = process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ADDRESS as string;

export default function CreateSyndicateModal() {
  const clickRef = useClickRef();
  const [isOpen, setIsOpen] = useState(false);

  // State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Data
  const [formData, setFormData] = useState({ name: '', symbol: '' });
  const [deployHashes, setDeployHashes] = useState({ token: '', governance: '' });
  const [addresses, setAddresses] = useState({ token: '', governance: '' });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // --- ACTIONS ---

  // STEP 1: Deploy Token
  const deployToken = async () => {
    setLoading(true);

    try {
      const activeAccount = await clickRef?.getActiveAccountAsync();
      if (!activeAccount?.public_key) throw new Error('Connect Wallet');

      const response = await fetch('/contracts/Token.wasm');
      const wasmBytes = new Uint8Array(await response.arrayBuffer());

      const pubKey = CLPublicKey.fromHex(activeAccount.public_key);
      const recipientKey = new CLKey(new CLAccountHash(pubKey.toAccountHash()));

      const timestamp = Date.now();
      const tokenKeyName = `token_pkg_${timestamp}`;
      console.log('Using package key name:', tokenKeyName);

      const args = RuntimeArgs.fromMap({
        name: CLValueBuilder.string(formData.name),
        symbol: CLValueBuilder.string(formData.symbol),
        decimals: CLValueBuilder.u8(9),
        initial_supply: CLValueBuilder.u256(1_000_000_000),
        recipient: recipientKey,
        buy_rate: CLValueBuilder.u256(10),
        odra_cfg_package_hash_key_name: CLValueBuilder.string(tokenKeyName),
        odra_cfg_allow_key_override: CLValueBuilder.bool(true),
        odra_cfg_is_upgradable: CLValueBuilder.bool(true),
        odra_cfg_is_upgrade: CLValueBuilder.bool(false)
      });

      const deployParams = new DeployUtil.DeployParams(pubKey, CHAIN_NAME);
      const session = DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBytes, args);
      const payment = DeployUtil.standardPayment(500 * 1_000_000_000);
      const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

      const result = await clickRef.send(DeployUtil.deployToJson(deploy), activeAccount.public_key);

      if (!result || !result.deployHash) {
        throw new Error('Transaction cancelled or failed to send.');
      }

      console.log('Token Deploy Hash:', result.deployHash);
      setDeployHashes((prev) => ({ ...prev, token: result.deployHash! }));
      setStep(2); // Go to enter token address step
    } catch (err: unknown) {
      console.error(err);
      alert('Token Error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Deploy Governance
  const deployGovernance = async () => {
    if (!addresses.token) {
      alert('Please enter the Token contract address first');
      return;
    }

    setLoading(true);

    try {
      const activeAccount = await clickRef?.getActiveAccountAsync();
      if (!activeAccount?.public_key) throw new Error('Wallet disconnected');

      const response = await fetch('/contracts/Governance.wasm');
      const wasmBytes = new Uint8Array(await response.arrayBuffer());

      const tokenKey = stringToKey(addresses.token);

      const timestamp = Date.now();
      const govKeyName = `gov_pkg_${timestamp}`;
      console.log('Using gov package key name:', govKeyName);

      const args = RuntimeArgs.fromMap({
        token_contract_hash: tokenKey,
        odra_cfg_package_hash_key_name: CLValueBuilder.string(govKeyName),
        odra_cfg_allow_key_override: CLValueBuilder.bool(true),
        odra_cfg_is_upgradable: CLValueBuilder.bool(true),
        odra_cfg_is_upgrade: CLValueBuilder.bool(false)
      });

      const pubKey = CLPublicKey.fromHex(activeAccount.public_key);
      const deployParams = new DeployUtil.DeployParams(pubKey, CHAIN_NAME);
      const session = DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBytes, args);
      const payment = DeployUtil.standardPayment(400 * 1_000_000_000);
      const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

      const result = await clickRef.send(DeployUtil.deployToJson(deploy), activeAccount.public_key);

      if (!result || !result.deployHash) {
        throw new Error('Transaction cancelled.');
      }

      console.log('Governance Deploy Hash:', result.deployHash);
      setDeployHashes((prev) => ({ ...prev, governance: result.deployHash! }));
      setStep(4); // Go to enter governance address step
    } catch (err: unknown) {
      console.error(err);
      alert('Governance Error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 5: Register on Registry
  const registerDAO = async () => {
    if (!addresses.token || !addresses.governance) {
      alert('Please enter both Token and Governance addresses');
      return;
    }

    setLoading(true);

    try {
      const activeAccount = await clickRef?.getActiveAccountAsync();
      if (!activeAccount?.public_key) throw new Error('Wallet disconnected');

      const tokenKey = stringToKey(addresses.token);
      const govKey = stringToKey(addresses.governance);

      const args = RuntimeArgs.fromMap({
        token_address: tokenKey,
        governance_address: govKey
      });

      const pubKey = CLPublicKey.fromHex(activeAccount.public_key);
      const deployParams = new DeployUtil.DeployParams(pubKey, CHAIN_NAME);

      const registryHashBytes = decodeBase16(
        REGISTRY_CONTRACT_HASH.replace('hash-', '').replace('contract-', '')
      );

      const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        registryHashBytes,
        'register_dao',
        args
      );

      const payment = DeployUtil.standardPayment(100 * 1_000_000_000);
      const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

      const result = await clickRef.send(DeployUtil.deployToJson(deploy), activeAccount.public_key);

      if (!result || !result.deployHash) {
        throw new Error('Transaction cancelled.');
      }

      console.log('Registry Deploy Hash:', result.deployHash);
      setStep(6); // Done
    } catch (err: unknown) {
      console.error(err);
      alert('Registry Error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ---
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Launch Syndicate
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Launch DAO Wizard</DialogTitle>
        </DialogHeader>

        {/* STEP 1: Deploy Token */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Syndicate Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Token Symbol</Label>
              <Input
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              />
            </div>
            <Button onClick={deployToken} disabled={loading} className="w-full mt-4">
              {loading ? <Loader2 className="animate-spin mr-2" /> : 'Deploy Token (1/3)'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              className="w-full text-muted-foreground gap-1">
              <SkipForward className="h-3 w-3" /> Skip
            </Button>
          </div>
        )}

        {/* STEP 2: Enter Token Address */}
        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 font-medium">Token deploy sent!</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-green-100 px-2 py-1 rounded flex-1 truncate">
                  {deployHashes.token}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(deployHashes.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Check the explorer for the contract hash, then paste it below:
            </p>

            <div className="grid gap-2">
              <Label>Token Contract Address</Label>
              <Input
                placeholder="hash-... or contract-..."
                value={addresses.token}
                onChange={(e) => setAddresses({ ...addresses, token: e.target.value })}
              />
            </div>

            <Button onClick={() => setStep(3)} disabled={!addresses.token} className="w-full gap-2">
              Continue to Governance <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(3)}
              className="w-full text-muted-foreground gap-1">
              <SkipForward className="h-3 w-3" /> Skip
            </Button>
          </div>
        )}

        {/* STEP 3: Deploy Governance */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Deploy the Governance contract linked to your Token.
            </p>

            <Button onClick={deployGovernance} disabled={loading} className="w-full">
              {loading ? <Loader2 className="animate-spin mr-2" /> : 'Deploy Governance (2/3)'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(4)}
              className="w-full text-muted-foreground gap-1">
              <SkipForward className="h-3 w-3" /> Skip
            </Button>
          </div>
        )}

        {/* STEP 4: Enter Governance Address */}
        {step === 4 && (
          <div className="space-y-4 py-4">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 font-medium">Governance deploy sent!</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-green-100 px-2 py-1 rounded flex-1 truncate">
                  {deployHashes.governance}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(deployHashes.governance)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Check the explorer for the contract hash, then paste it below:
            </p>

            <div className="grid gap-2">
              <Label>Governance Contract Address</Label>
              <Input
                placeholder="hash-... or contract-..."
                value={addresses.governance}
                onChange={(e) => setAddresses({ ...addresses, governance: e.target.value })}
              />
            </div>

            <Button
              onClick={() => setStep(5)}
              disabled={!addresses.governance}
              className="w-full gap-2">
              Continue to Register <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(5)}
              className="w-full text-muted-foreground gap-1">
              <SkipForward className="h-3 w-3" /> Skip
            </Button>
          </div>
        )}

        {/* STEP 5: Register DAO */}
        {step === 5 && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Enter contract addresses to register your DAO in the registry.
            </p>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Token Contract Address *</Label>
                <Input
                  placeholder="hash-... or contract-..."
                  value={addresses.token}
                  onChange={(e) => setAddresses({ ...addresses, token: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Governance Contract Address *</Label>
                <Input
                  placeholder="hash-... or contract-..."
                  value={addresses.governance}
                  onChange={(e) => setAddresses({ ...addresses, governance: e.target.value })}
                />
              </div>
            </div>

            <Button
              onClick={registerDAO}
              disabled={loading || !addresses.token || !addresses.governance}
              className="w-full">
              {loading ? <Loader2 className="animate-spin mr-2" /> : 'Register DAO (3/3)'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(6)}
              className="w-full text-muted-foreground gap-1">
              <SkipForward className="h-3 w-3" /> Skip
            </Button>
          </div>
        )}

        {/* STEP 6: SUCCESS */}
        {step === 6 && (
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-xl">All Systems Go!</h3>
            <p className="text-muted-foreground">Your DAO registration has been submitted.</p>
            <Button onClick={() => setIsOpen(false)} variant="outline" className="w-full">
              Close Wizard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
