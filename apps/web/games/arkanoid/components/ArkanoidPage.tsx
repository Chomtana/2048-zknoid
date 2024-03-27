'use client';

import { useContext, useEffect, useState } from 'react';
import { GameView, ITick } from '@/games/arkanoid/components/GameView';
import {
  Bricks,
  GameInputs,
  Tick,
  CHUNK_LENGTH,
  createBricksBySeed,
} from 'zknoid-chain-dev';
import { Bool, Field, Int64, PublicKey, UInt64 } from 'o1js';
import { useNetworkStore } from '@/lib/stores/network';
import { useMinaBridge } from '@/lib/stores/protokitBalances';
import {
  useArkanoidLeaderboardStore,
  useObserveArkanoidLeaderboard,
} from '@/games/arkanoid/stores/arkanoidLeaderboard';
import { walletInstalled } from '@/lib/helpers';
import { ICompetition } from '@/lib/types';
import { fromContractCompetition } from '@/lib/typesConverter';
import { useWorkerClientStore } from '@/lib/stores/workerClient';
import AppChainClientContext from '@/lib/contexts/AppChainClientContext';
import GamePage from '@/components/framework/GamePage';
import { arkanoidConfig } from '../config';
import { GameWidget } from '@/components/framework/GameWidget/GameWidget';
import { Leaderboard } from '@/components/framework/GameWidget/Leaderboard';
import { Competition } from '@/components/framework/GameWidget/Competition';
import { ConnectWallet } from '@/components/framework/GameWidget/ConnectWallet';
import { RateGame } from '@/components/framework/GameWidget/RateGame';
import { Lost } from '@/components/framework/GameWidget/Lost';
import { Win } from '@/components/framework/GameWidget/Win';
import { InstallWallet } from '@/components/framework/GameWidget/InstallWallet';
import { DebugCheckbox } from '@/components/framework/GameWidget/DebugCheckbox';
import { defaultGames } from '@/app/constants/games';
import { Currency } from '@/constants/currency';
import { UnsetCompetitionPopup } from '@/components/framework/GameWidget/UnsetCompetitionPopup';
import { useSwitchWidgetStorage } from '@/lib/stores/switchWidgetStorage';

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
    arr.slice(i * size, i * size + size)
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
  const [isRateGame, setIsRateGame] = useState<boolean>(false);

  const client = useContext(AppChainClientContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  useObserveArkanoidLeaderboard(params.competitionId);

  const leaderboardStore = useArkanoidLeaderboardStore();
  const switchStore = useSwitchWidgetStorage();
  const workerClientStore = useWorkerClientStore();

  let [gameId, setGameId] = useState(0);
  let [debug, setDebug] = useState(true);

  let [level, setLevel] = useState<Bricks>(Bricks.empty);

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
    if (!networkStore.protokitClientStarted) return;
    getCompetition();
  }, [networkStore.protokitClientStarted]);

  const getCompetition = async () => {
    let competitionId = +params.competitionId;
    if (isNaN(competitionId)) {
      console.log(
        `Can't load level. competitionId is not a number. Loading default level`
      );
      return;
    }
    let contractCompetition =
      await client.query.runtime.ArkanoidGameHub.competitions.get(
        UInt64.from(competitionId)
      );
    if (contractCompetition === undefined) {
      console.log(`Can't get competition with id <${competitionId}>`);
      return;
    }

    let competition = fromContractCompetition(
      competitionId,
      contractCompetition
    );

    let bricks = createBricksBySeed(Field.from(competition!.seed));

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
          })
      ),
      CHUNK_LENGTH
    );

    // @ts-expect-error
    let userInputs = chunks.map((chunk) => new GameInputs({ ticks: chunk }));

    try {
      const proof = await workerClientStore?.client?.proveGameRecord({
        seed: Field.from(competition!.seed),
        inputs: userInputs,
        debug: Bool(false),
      });

      console.log('Level proof', proof);

      const gameHub = client!.runtime.resolve('ArkanoidGameHub');

      const tx = await client!.transaction(
        PublicKey.fromBase58(networkStore.address!),
        () => {
          gameHub.addGameResult(UInt64.from(competition!.id), proof!);
        }
      );

      await tx.sign();
      await tx.send();
    } catch (e) {
      console.log('Error while generating ZK proof');
      console.log(e);
    }
  };

  useEffect(() => {
    if (
      competition &&
      params.competitionId != switchStore.competitionId?.toString()
    )
      switchStore.setCompetitionId(competition.id);
  }, [competition, params.competitionId, switchStore.competitionId]);

  // TEMPORARY DATA
  const DEBUG_COMPETITION: ICompetition = {
    game: defaultGames[0],
    title: 'Arcanoid',
    id: 0,
    preReg: false,
    preRegDate: {
      start: new Date(2024, 2, 15),
      end: new Date(2024, 2, 20),
    },
    competitionDate: {
      start: new Date(2024, 2, 15),
      end: new Date(2024, 2, 20),
    },
    participationFee: 5n * 10n ** 9n,
    currency: Currency.MINA,
    reward: 1000n * 10n ** 9n,
    seed: 123,
    registered: false,
  };

  const isRestartButton =
    gameState === GameState.Lost || gameState === GameState.Won;

  return (
    <GamePage
      gameConfig={arkanoidConfig}
      image={'/image/game-page/arkanoid-title.svg'}
      defaultPage={'Game'}
    >
      <div className={'grid grid-cols-4 grid-rows-1 gap-4'}>
        {competition && (
          <Leaderboard
            leaderboard={leaderboardStore.getLeaderboard(params.competitionId)}
          />
        )}
        <GameWidget
          ticks={ticksAmount}
          score={score}
          gameRating={arkanoidConfig.rating}
          author={arkanoidConfig.author}
        >
          {networkStore.address ? (
            <>
              {!competition ? (
                <UnsetCompetitionPopup gameId={arkanoidConfig.id} />
              ) : (
                <>
                  {gameState == GameState.Won && <Win sendProof={proof} />}
                  {gameState == GameState.Lost && (
                    <Lost startGame={startGame} />
                  )}
                  {gameState === GameState.NotStarted && (
                    <div
                      className={
                        'flex h-full w-full items-center justify-center'
                      }
                    >
                      <button
                        className={
                          'w-full max-w-[40%] rounded-[5px] border border-bg-dark bg-left-accent py-2 text-center text-[20px]/[20px] font-medium text-dark-buttons-text hover:border-left-accent hover:bg-bg-dark hover:text-left-accent'
                        }
                        onClick={startGame}
                      >
                        Start game
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : walletInstalled() ? (
            <ConnectWallet connectWallet={networkStore.connectWallet} />
          ) : (
            <InstallWallet />
          )}
          {gameState === GameState.Active && (
            <div className={'flex h-full w-full items-center justify-center'}>
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
          )}
        </GameWidget>
        <Competition
          startGame={startGame}
          competition={competition}
          isRestartBtn={isRestartButton}
        />
      </div>
      <DebugCheckbox debug={debug} setDebug={setDebug} />
    </GamePage>
  );
}
