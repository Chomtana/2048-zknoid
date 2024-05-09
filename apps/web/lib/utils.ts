import { type RuntimeModulesRecord } from '@proto-kit/module';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GameRecordProof } from 'zknoid-chain-dev';
import {  client } from 'zknoid-chain-dev';
// import { ModulesConfig } from '@proto-kit/common';
import { dummyProofBase64 } from '@/app/constants/dummyProofBase64';
import { PublicKey } from 'o1js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dummy = GameRecordProof.fromJSON({
  publicInput: [],
  publicOutput: [''],
  maxProofsVerified: 2,
  proof: dummyProofBase64,
});

export async function mockProof<O, P>(
  publicOutput: O,
  ProofType: new ({
    proof,
    publicInput,
    publicOutput,
    maxProofsVerified,
  }: {
    proof: unknown;
    publicInput: any;
    publicOutput: any;
    maxProofsVerified: 0 | 2 | 1;
  }) => P
): Promise<P> {
  return new ProofType({
    proof: dummy.proof,
    maxProofsVerified: 2,
    publicInput: undefined,
    publicOutput,
  });
}

export function buildClient<
  RuntimeModules extends RuntimeModulesRecord = RuntimeModulesRecord,
>(modules: RuntimeModules) {
  // const client = ClientAppChain.fromRuntime(modules);

  // client.configurePartial({
  //   Runtime: {
  //     ArkanoidGameHub: {},
  //     Balances: {},
  //     RandzuLogic: {},
  //     ThimblerigLogic: {},
  //   } as ModulesConfig<typeof modules>,
  // });

  // client.configurePartial({
  //   GraphqlClient: {
  //     url:
  //       process.env.NEXT_PUBLIC_PROTOKIT_URL || 'http://127.0.0.1:8080/graphql',
  //   },
  // });

  return client;
}


export const formatPubkey = (pubkey: PublicKey | undefined) => pubkey ? pubkey.toBase58().slice(0, 16) + '...' : 'None';