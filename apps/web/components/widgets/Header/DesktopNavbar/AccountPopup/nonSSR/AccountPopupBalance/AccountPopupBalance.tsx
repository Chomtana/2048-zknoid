import {
  useMinaBalancesStore,
  useObserveMinaBalance,
} from '@/lib/stores/minaBalances';
import { useNetworkStore } from '@/lib/stores/network';
import { useProtokitBalancesStore } from '@/lib/stores/protokitBalances';
import { usePollMinaBlockHeight } from '@/lib/stores/minaChain';
import Image from 'next/image';
import CoinImg from '@/components/widgets/Header/nonSSR/BalanceInfo/assets/coin.svg';
import MinaCoinImg from '@/components/widgets/Header/nonSSR/BalanceInfo/assets/mina.png';
import { useBridgeStore } from '@/lib/stores/bridgeStore';

export default function AccountPopupBalance() {
  const minaBalancesStore = useMinaBalancesStore();
  const networkStore = useNetworkStore();
  const bridgeStore = useBridgeStore();
  usePollMinaBlockHeight();
  useObserveMinaBalance();
  const protokitBalancesStore = useProtokitBalancesStore();

  const deposit = (
    Number(protokitBalancesStore.balances[networkStore.address!] ?? 0n) /
    10 ** 9
  ).toFixed(2);

  const minaDeposit = (
    Number(minaBalancesStore.balances[networkStore.address!] ?? 0n) /
    10 ** 9
  ).toFixed(2);

  return (
    <>
      {networkStore.walletConnected && (
        <div className="flex flex-row items-start gap-[1.25vw] text-base">
          <div className="flex h-full w-full flex-col-reverse items-start gap-[14px] lg:w-auto lg:flex-col lg:gap-[0.313vw]">
            <div className="flex items-center gap-[10px]">
              <Image alt="" src={CoinImg} width={26} height={26} />
              <div className="w-full text-start text-bg-dark lg:w-auto">
                Deposit: {deposit}
              </div>
            </div>
            <div className="flex items-center gap-[10px]">
              <Image alt="" src={MinaCoinImg} width={26} height={26} />
              <div className="w-full text-start text-bg-dark lg:w-auto">
                Wallet balance {minaDeposit}
              </div>
            </div>
          </div>
          <button
            className={
              'group flex w-auto flex-row items-center justify-center gap-[10px] rounded-[5px] border border-bg-dark bg-bg-dark px-2 py-3 text-header-menu hover:bg-right-accent lg:py-1'
            }
            onClick={() => bridgeStore.setOpen(10n * 10n ** 9n)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className={'fill-foreground group-hover:fill-bg-dark'}
            >
              <path d="M19 7H18V6C18 5.20435 17.6839 4.44129 17.1213 3.87868C16.5587 3.31607 15.7956 3 15 3H5C4.20435 3 3.44129 3.31607 2.87868 3.87868C2.31607 4.44129 2 5.20435 2 6V18C2 18.7956 2.31607 19.5587 2.87868 20.1213C3.44129 20.6839 4.20435 21 5 21H19C19.7956 21 20.5587 20.6839 21.1213 20.1213C21.6839 19.5587 22 18.7956 22 18V10C22 9.20435 21.6839 8.44129 21.1213 7.87868C20.5587 7.31607 19.7956 7 19 7ZM5 5H15C15.2652 5 15.5196 5.10536 15.7071 5.29289C15.8946 5.48043 16 5.73478 16 6V7H5C4.73478 7 4.48043 6.89464 4.29289 6.70711C4.10536 6.51957 4 6.26522 4 6C4 5.73478 4.10536 5.48043 4.29289 5.29289C4.48043 5.10536 4.73478 5 5 5ZM20 15H19C18.7348 15 18.4804 14.8946 18.2929 14.7071C18.1054 14.5196 18 14.2652 18 14C18 13.7348 18.1054 13.4804 18.2929 13.2929C18.4804 13.1054 18.7348 13 19 13H20V15ZM20 11H19C18.2044 11 17.4413 11.3161 16.8787 11.8787C16.3161 12.4413 16 13.2044 16 14C16 14.7956 16.3161 15.5587 16.8787 16.1213C17.4413 16.6839 18.2044 17 19 17H20V18C20 18.2652 19.8946 18.5196 19.7071 18.7071C19.5196 18.8946 19.2652 19 19 19H5C4.73478 19 4.48043 18.8946 4.29289 18.7071C4.10536 18.5196 4 18.2652 4 18V8.83C4.32127 8.94302 4.65943 9.00051 5 9H19C19.2652 9 19.5196 9.10536 19.7071 9.29289C19.8946 9.48043 20 9.73478 20 10V11Z" />
            </svg>
            <span className={'text-center group-hover:text-bg-dark'}>
              Top up
            </span>
          </button>
        </div>
      )}
    </>
  );
}
