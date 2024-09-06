import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Field, Poseidon, PublicKey, UInt64 } from 'o1js';
import { useNetworkStore } from '@/lib/stores/network';
import { ClientAppChain } from 'zknoid-chain-dev';
import GamePage from '@/components/framework/GamePage';
import { game2048Config } from './config';
import ZkNoidGameContext from '@/lib/contexts/ZkNoidGameContext';
import { useProtokitChainStore } from '@/lib/stores/protokitChain';
import CoverSVG from './assets/game-cover.svg';
import { motion } from 'framer-motion';
import Button from '@/components/shared/Button';
import { useNotificationStore } from '@/components/shared/Notification/lib/notificationStore';
import Game2048Board from './Game2048Board';
import { useStore } from 'zustand';
import { useSessionKeyStore } from '@/lib/stores/sessionKeyStorage';
import { AppChainTransaction } from '@proto-kit/sdk';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function Game2048Page({
  params,
}: {
  params: { competitionId: string };
}) {
  const [hiddenNumberHash, setHiddenNumberHash] = useState(0n);
  const [userScore, setUserScore] = useState(0n);
  const [inputNumber, setInputNumber] = useState(1);
  const [gameStarted, setGameStarted] = useState(false)

  const { client } = useContext(ZkNoidGameContext);

  if (!client) {
    throw Error('Context app chain client is not set');
  }

  const networkStore = useNetworkStore();
  const protokitChain = useProtokitChainStore();
  const notificationStore = useNotificationStore();

  const client_ = client as ClientAppChain<
    typeof game2048Config.runtimeModules,
    any,
    any,
    any
  >;

  console.log('Protokit Started', networkStore.protokitClientStarted, networkStore.walletConnected, networkStore.address)

  const query = networkStore.protokitClientStarted
    ? client_.query.runtime.Game2048
    : undefined;

  const sessionPublicKey = useStore(useSessionKeyStore, (state) => state.getSessionKey()).toPublicKey();
  const sessionPrivateKey = useStore(useSessionKeyStore, (state) => state.getSessionKey());
  const sessionNonce = useRef(0)

  const newGame = useCallback(async () => {
    const game2048 = client_.runtime.resolve('Game2048');

    try {
      const tx = await client.transaction(
        PublicKey.fromBase58(networkStore.address!),
        async () => {
          await game2048.resetGame(sessionPublicKey);
        },
      );

      await tx.sign();
      await tx.send();

      await wait(1000)

      setGameStarted(true)

      notificationStore.create({
        type: 'success',
        message: 'Game Started!',
      });
    } catch (err) {
      console.error(err)
      notificationStore.create({
        type: 'error',
        message: 'Error starting game! Please reconnect your wallet and try again...',
      });
      throw err
    }
  }, [client_, client, networkStore, notificationStore, sessionPublicKey]);

  const move = useCallback(async (dir: 'u' | 'd' | 'l' | 'r') => {
    const game2048 = client_.runtime.resolve('Game2048');

    try {
      let tx: AppChainTransaction

      switch (dir) {
        case 'u':
          tx = await client.transaction(
            sessionPublicKey,
            async () => {
              await game2048.moveUp();
            },
            { nonce: sessionNonce.current++ },
          );
          break;

        case 'd':
          tx = await client.transaction(
            sessionPublicKey,
            async () => {
              await game2048.moveDown();
            },
            { nonce: sessionNonce.current++ },
          );
          break;

        case 'l':
          tx = await client.transaction(
            sessionPublicKey,
            async () => {
              await game2048.moveLeft();
            },
            { nonce: sessionNonce.current++ },
          );
          break;

        case 'r':
          tx = await client.transaction(
            sessionPublicKey,
            async () => {
              await game2048.moveRight();
            },
            { nonce: sessionNonce.current++ },
          );
          break;
      }

      tx.transaction = tx.transaction?.sign(sessionPrivateKey);
      await tx.send();
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [client_, client, networkStore, notificationStore, sessionPublicKey, sessionPrivateKey, sessionNonce]);

  const addTile = useCallback(async (r: number, c: number) => {
    const game2048 = client_.runtime.resolve('Game2048');

    try {
      console.log('Add tile end', r, c)
      const tx = await client.transaction(
        sessionPublicKey,
        async () => {
          await game2048.addTile(Field(r), Field(c));
        },
        { nonce: sessionNonce.current++ }
      );

      tx.transaction = tx.transaction?.sign(sessionPrivateKey);
      await tx.send();
    } catch (err) {
      console.error(err)
    }
  }, [client_, client, networkStore, notificationStore, sessionPublicKey, sessionPrivateKey, sessionNonce]);  

  // const hideNumber = async (number: number) => {
  //   const guessLogic = client_.runtime.resolve('GuessGame');

  //   const tx = await client.transaction(
  //     PublicKey.fromBase58(networkStore.address!),
  //     async () => {
  //       await guessLogic.hideNumber(UInt64.from(number));
  //     }
  //   );

  //   await tx.sign();
  //   await tx.send();
  // };

  // const guessNumber = async (number: number) => {
  //   const guessLogic = client_.runtime.resolve('GuessGame');

  //   const hash = Poseidon.hash(UInt64.from(number).toFields());

  //   if (hash.equals(Field.from(hiddenNumberHash)).toBoolean()) {
  //     notificationStore.create({
  //       type: 'success',
  //       message: 'Guessed correctly',
  //     });

  //     const tx = await client.transaction(
  //       PublicKey.fromBase58(networkStore.address!),
  //       async () => {
  //         await guessLogic.guessNumber(UInt64.from(number));
  //       }
  //     );

  //     await tx.sign();
  //     await tx.send();
  //   } else {
  //     notificationStore.create({
  //       type: 'error',
  //       message: 'Guessed incorrectly!',
  //     });
  //   }
  // };

  // useEffect(() => {
  //   query?.hiddenNumber.get().then((n) => {
  //     const newHiddenNumberHash = n ? n.toBigInt() : 0n;
  //     // Game state updated
  //     if (newHiddenNumberHash != hiddenNumberHash) {
  //       setInputNumber(0);
  //     }
  //     setHiddenNumberHash(newHiddenNumberHash);
  //   });

  //   if (networkStore.address) {
  //     const userWallet = PublicKey.fromBase58(networkStore.address);

  //     query?.scores.get(userWallet).then((n) => {
  //       if (n) setUserScore(n.toBigInt());
  //     });
  //   }
  // }, [protokitChain.block]);

  return (
    <GamePage
      gameConfig={game2048Config}
      image={CoverSVG}
      mobileImage={CoverSVG}
      defaultPage={'Game'}
    >
      <motion.div
        className={
          'flex justify-center items-center'
        }
        animate={'windowed'}
      >
        <Game2048Board
          newGame={newGame}
          move={move}
          addTile={addTile}
          gameStarted={gameStarted}
        ></Game2048Board>
      </motion.div>
    </GamePage>
  );
}
