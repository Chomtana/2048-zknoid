'use client';

import { useEffect, useMemo, useState } from 'react';
import { GameView, ITick } from '@/components/arkanoid/GameView';
import {
  Bricks,
  GameInputs,
  Tick,
  defaultLevel,
  CHUNK_LENGTH,
  createBricksBySeed,
} from 'zknoid-chain-dev';
import { Bool, Int64, PublicKey, UInt64 } from 'o1js';
import Link from 'next/link';
import ZknoidWorkerClient from '@/worker/zknoidWorkerClient';
import { Client, useNetworkStore } from '@/lib/stores/network';
import { arkanoidCompetitions } from '@/app/constants/akanoidCompetitions';
import {
  useMinaBridge,
  useObserveProtokitBalance,
  useProtokitBalancesStore,
} from '@/lib/stores/protokitBalances';
import {
  useArkanoidLeaderboardStore,
  useObserveArkanoidLeaderboard,
} from '@/lib/stores/arkanoidLeaderboard';
import { useClientStore } from '@/lib/stores/client';
import { usePollMinaBlockHeight } from '@/lib/stores/minaChain';
import { usePollProtokitBlockHeight } from '@/lib/stores/protokitChain';
import {
  useMinaBalancesStore,
  useObserveMinaBalance,
} from '@/lib/stores/minaBalances';
import Header from '../Header';
import { GameType } from '@/app/constants/games';
import { walletInstalled } from '@/lib/utils';
import { ICompetition } from '@/lib/types';
import { fromContractCompetition } from '@/lib/typesConverter';

enum GameState {
  NotStarted,
  Active,
  Won,
  Lost,
  Replay,
  Proofing,
}

const chunkenize = (arr: any[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size),
  );

export default function ArkanoidPage({
  params,
}: {
  params: { competitionId: string };
}) {
  const [gameState, setGameState] = useState(GameState.NotStarted);
  const [lastTicks, setLastTicks] = useState<ITick[]>([]);
  const [score, setScore] = useState<number>(0);
  const [ticksAmount, setTicksAmount] = useState<number>(0);
  const [competition, setCompetition] = useState<ICompetition>();
  // const competition = arkanoidCompetitions.find(
  //   (x) => x.id == params.competitionId,
  // );

  const client = useClientStore();

  useObserveArkanoidLeaderboard(params.competitionId);
  usePollMinaBlockHeight();
  usePollProtokitBlockHeight();
  useObserveMinaBalance();
  useObserveProtokitBalance();

  const minaBalances = useMinaBalancesStore();
  const protokitBalances = useProtokitBalancesStore();
  const leaderboardStore = useArkanoidLeaderboardStore();

  let [gameId, setGameId] = useState(0);
  let [debug, setDebug] = useState(true);
  // const level: Bricks = useMemo(() => defaultLevel(), []);
  let [level, setLevel] = useState<Bricks>(Bricks.empty);
  const [workerClient, setWorkerClient] = useState<ZknoidWorkerClient | null>(
    null,
  );
  const networkStore = useNetworkStore();

  let bridge = useMinaBridge();

  const startGame = async () => {
    if (competition!.participationFee > 0) {
      await bridge(competition!.participationFee);
    }

    setGameState(GameState.Active);
    setGameId(gameId + 1);
  };

  useEffect(() => {
    async function timeout(seconds: number): Promise<void> {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, seconds * 1000);
      });
    }

    (async () => {
      console.log('Loading web worker...');
      const zkappWorkerClient = new ZknoidWorkerClient();
      await timeout(5);

      console.log('Done loading web worker');
      console.log('Loading contracts in web worker');

      await zkappWorkerClient.loadContracts();

      console.log('Compiling contracts in web worker');

      // @todo wait for protokit support for 0.15.x
      // await zkappWorkerClient.compileContracts();

      // console.log('Contracts compilation finished');

      // await zkappWorkerClient.initZkappInstance("B62qr9UxamCE5PaEZCZnKsb6jX85W1JVCYpdB8CFE7rNZzSvusaW7sb");

      // console.log('Contracts initialization finished');

      setWorkerClient(zkappWorkerClient);
    })();
  }, []);

  useEffect(() => {
    client.start().then((client) => getCompetition(client));
  }, []);

  const getCompetition = async (client: Client) => {
    let competitionId = +params.competitionId;
    if (isNaN(competitionId)) {
      console.log(
        `Can't load level. competitionId is not a number. Loading default level`,
      );
      return;
    }

    let contractCompetition =
      await client.query.runtime.ArkanoidGameHub.competitions.get(
        UInt64.from(competitionId),
      );
    if (contractCompetition === undefined) {
      console.log(`Can't get competition with id <${competitionId}>`);
      return;
    }

    let competition = fromContractCompetition(
      competitionId,
      contractCompetition,
    );

    let bricks = createBricksBySeed(Int64.from(competition!.seed));

    setCompetition(competition);
    setLevel(bricks);
  };

  // useEffect(() => {
  //   let bricks = createBricksBySeed(Int64.from(competition!.seed));

  //   setLevel(bricks);
  // }, [competition]);

  const proof = async () => {
    console.log('Ticks', lastTicks);

    let chunks = chunkenize(
      lastTicks.map(
        (elem) =>
          // @ts-expect-error
          new Tick({
            action: Int64.from(elem.action),
            momentum: Int64.from(elem.momentum),
          }),
      ),
      CHUNK_LENGTH,
    );

    // @ts-expect-error
    let userInputs = chunks.map((chunk) => new GameInputs({ ticks: chunk }));

    try {
      const proof = await workerClient?.proveGameRecord({
        bricks: level,
        inputs: userInputs,
        debug: Bool(false),
      });

      console.log('Level proof', proof);

      const gameHub = client.client!.runtime.resolve('ArkanoidGameHub');

      const tx = await client.client!.transaction(
        PublicKey.fromBase58(networkStore.address!),
        () => {
          gameHub.addGameResult(
            UInt64.from(competition!.competitionId),
            proof!,
          );
        },
      );

      await tx.sign();
      await tx.send();
    } catch (e) {
      console.log('Error while generating ZK proof');
      console.log(e);
    }
  };

  return (
    <>
      <Header
        address={networkStore.address}
        connectWallet={networkStore.connectWallet}
        minaBalance={
          networkStore.address
            ? minaBalances.balances[networkStore.address]
            : 0n
        }
        protokitBalance={
          networkStore.address
            ? protokitBalances.balances[networkStore.address]
            : 0n
        }
        walletInstalled={networkStore.walletInstalled()}
        currentGame={GameType.Arkanoid}
      />
      <main className="flex grow flex-col items-center gap-5 p-5">
        {networkStore.address ? (
          <div className="flex flex-col gap-5">
            {gameState == GameState.Won && (
              <div>
                You won! Ticks verification:{' '}
                <input
                  type="text"
                  value={JSON.stringify(lastTicks)}
                  readOnly
                ></input>
              </div>
            )}
            {gameState == GameState.Lost && (
              <div>You've lost! Nothing to prove</div>
            )}

            <div className="flex flex-row items-center justify-center gap-5">
              {(gameState == GameState.Won || gameState == GameState.Lost) && (
                <div
                  className="rounded-xl bg-slate-300 p-5 hover:bg-slate-400"
                  onClick={() => startGame()}
                >
                  Restart
                </div>
              )}
              {gameState == GameState.NotStarted && (
                <div
                  className="rounded-xl bg-slate-300 p-5 hover:bg-slate-400"
                  onClick={() => startGame()}
                >
                  Start for {competition?.participationFee} 🪙
                </div>
              )}
              {gameState == GameState.Won && (
                <div
                  className="rounded-xl bg-slate-300 p-5 hover:bg-slate-400"
                  onClick={() => proof()}
                >
                  Send proof
                </div>
              )}
            </div>
          </div>
        ) : walletInstalled() ? (
          <div
            className="rounded-xl bg-slate-300 p-5"
            onClick={async () => networkStore.connectWallet()}
          >
            Connect wallet
          </div>
        ) : (
          <Link
            href="https://www.aurowallet.com/"
            className="rounded-xl bg-slate-300 p-5"
            rel="noopener noreferrer"
            target="_blank"
          >
            Install wallet
          </Link>
        )}
        <div className="flex w-full">
          <div className="w-1/3"></div>
          <div className="flex w-1/3 items-center justify-center">
            <GameView
              onWin={(ticks) => {
                console.log('Ticks', ticks);
                setLastTicks(ticks);
                setGameState(GameState.Won);
              }}
              onLost={(ticks) => {
                setLastTicks(ticks);
                setGameState(GameState.Lost);
              }}
              onRestart={(ticks) => {
                setLastTicks(ticks);
                startGame();
              }}
              level={level}
              gameId={gameId}
              debug={debug}
              setScore={setScore}
              setTicksAmount={setTicksAmount}
            />
          </div>
          <div className="flex flex-col items-center">
            <h1> Leaderboard </h1>
            <table className="min-w-max text-left">
              <thead className="font-semibold">
                <tr>
                  <th className="w-96 bg-gray-300 px-6 py-3"> Address </th>
                  <th className="w-20  bg-gray-400 px-6 py-3"> Score </th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {leaderboardStore
                  .getLeaderboard(params.competitionId)
                  .map((user, i) => (
                    <tr className="border-b bg-white">
                      <td className="bg-gray-300">{user.player.toBase58()}</td>
                      <td className="bg-gray-400">{user.score.toString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          Score: {score} Ticks: {ticksAmount}
        </div>
        <div className="grow"></div>
        {/* <div className="flex flex-col gap-10">
          <div>
            Active competitions:
            <div className="flex flex-col">
              {arkanoidCompetitions.map((competition) => (
                <Link
                  href={`/games/arkanoid/${competition.id}`}
                  key={competition.id}
                >
                  {competition.name} – {competition.prizeFund} 🪙
                </Link>
              ))}
            </div>
          </div>
        </div> */}
        <div className="w-full text-end">
          Debug:{' '}
          <input
            type="checkbox"
            checked={debug}
            onChange={(event) => {
              setDebug(event.target.checked);
            }}
          ></input>
        </div>
      </main>
    </>
  );
}
