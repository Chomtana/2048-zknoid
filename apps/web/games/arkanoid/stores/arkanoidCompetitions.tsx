import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { Bool, PublicKey, UInt64 } from 'o1js';
import { useContext, useEffect } from 'react';
import { useProtokitChainStore } from '../../../lib/stores/protokitChain';
import { useNetworkStore } from '../../../lib/stores/network';
import { GameRecordKey, LeaderboardIndex } from 'zknoid-chain-dev';
import { ICompetition } from '@/lib/types';
import { fromContractCompetition } from '@/lib/typesConverter';
import { ClientAppChain } from '@proto-kit/sdk';
import { arkanoidConfig } from '../config';
import AppChainClientContext from '@/lib/contexts/AppChainClientContext';

export interface CompetitionsState {
  loading: boolean;
  competitions: ICompetition[];
  loadCompetitions: (
    client: ClientAppChain<typeof arkanoidConfig.runtimeModules, any, any, any>,
    player: PublicKey
  ) => Promise<void>;
}

export const useArkanoidCompetitionsStore = create<
  CompetitionsState,
  [['zustand/immer', never]]
>(
  immer((set) => ({
    loading: false,
    competitions: [],
    async loadCompetitions(
      client: ClientAppChain<typeof arkanoidConfig.runtimeModules, any, any, any>,
      player: PublicKey
    ) {
      set((state) => {
        state.loading = true;
      });
      let competitions: ICompetition[] = [];
      const lastCompetitionId =
        +(await client.query.runtime.ArkanoidGameHub.lastCompetitonId.get())!.toString();
      for (let i = 0; i < lastCompetitionId; i++) {
        let curCompetition =
          await client.query.runtime.ArkanoidGameHub.competitions.get(
            UInt64.from(i)
          );
        let registered =
          await client.query.runtime.ArkanoidGameHub.registrations.get(
            //@ts-ignore
            new GameRecordKey({
              competitionId: UInt64.from(i),
              player,
            })
          );
        registered ??= Bool(false);

        competitions.push({
          ...fromContractCompetition(i, curCompetition!),
          registered: registered.toBoolean(),
        });
      }
      set((state) => {
        // @ts-ignore
        state.competitions = competitions;
        state.loading = false;
      });
    },
  }))
);

export const useObserveArkanoidCompetitions = () => {
  const client = useContext<
    ClientAppChain<typeof arkanoidConfig.runtimeModules, any, any, any> | undefined
  >(AppChainClientContext);
  console.log('Client', client);
  const chain = useProtokitChainStore();
  const network = useNetworkStore();
  const competitions = useArkanoidCompetitionsStore();

  useEffect(() => {
    if (!client) throw Error('Client not set in context');
    if (!network.protokitClientStarted) return;

    competitions.loadCompetitions(
      client,
      network.address
        ? PublicKey.fromBase58(network.address)
        : PublicKey.empty()
    );
  }, [
    chain.block?.height,
    network.walletConnected,
    network.address,
    network.protokitClientStarted,
  ]);
};
