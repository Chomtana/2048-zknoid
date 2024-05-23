'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

import Link from 'next/link';
import { useEffect } from 'react';

import { formatAddress, walletInstalled } from '@/lib/helpers';
import { useNetworkStore } from '@/lib/stores/network';

import { useRegisterWorkerClient } from '@/lib/stores/workerClient';

import { HeaderCard } from './HeaderCard';
import { api } from '@/trpc/react';
import { getEnvContext } from '@/lib/envContext';
import AccountCard from './header/AccountCard';

const BalanceInfo = dynamic(
  () => import('@/components/ui/games-store/BalanceInfo'),
  {
    ssr: false,
  }
);

const NetworkPicker = dynamic(() => import('@/components/NetworkPicker'), {
  ssr: false,
});

export default function DesktopNavbar({
  autoconnect,
}: {
  autoconnect: boolean;
}) {
  const networkStore = useNetworkStore();
  useEffect(() => {
    if (!walletInstalled()) return;

    if (autoconnect) {
      networkStore.connectWallet(true);
    }
  }, []);
  const logWalletConnectedMutation =
    api.logging.logWalletConnected.useMutation();

  useEffect(() => {
    if (networkStore.walletConnected) {
      logWalletConnectedMutation.mutate({
        userAddress: networkStore.address ?? '',
        envContext: getEnvContext(),
      });
    }
  }, [networkStore.walletConnected]);

  return (
    <header className="z-10 hidden h-[91px] w-full items-center px-3 lg:flex lg:px-[50px]">
      <div className={'flex w-full items-center justify-between'}>
        <Link
          href={'/'}
          className={'cursor-pointer ease-in-out hover:opacity-80'}
        >
          <Image
            src={'/image/zknoid-logo.svg'}
            alt={'ZkNoid logo'}
            width={219}
            height={47}
          />
        </Link>
        {networkStore.walletConnected && networkStore.address && (
          <BalanceInfo />
        )}

        <div className="flex gap-5">
          {networkStore.walletConnected && networkStore.address ? (
            <>
              <AccountCard
                text={formatAddress(networkStore.address)}
              />
              <NetworkPicker />
            </>
          ) : walletInstalled() ? (
            <HeaderCard
              svg={'account'}
              text="Connect wallet"
              isMiddle={true}
              onClick={() => {
                networkStore.connectWallet(false);
              }}
            />
          ) : (
            <Link
              href="https://www.aurowallet.com/"
              rel="noopener noreferrer"
              target="_blank"
            >
              <HeaderCard
                svg={'account'}
                text="Install wallet"
                isMiddle={true}
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
