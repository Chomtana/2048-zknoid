import { AppChain, TestingAppChain } from '@proto-kit/sdk';
import { Field, Int64, PrivateKey, PublicKey, UInt64 } from 'o1js';
import { log } from '@proto-kit/common';
import { Pickles } from 'o1js/dist/node/snarky';
import { Balances, Game2048Logic } from '../src';

log.setLevel('ERROR');

describe('game hub', () => {
  it('Two players basic case', async () => {
    const appChain = TestingAppChain.fromRuntime({
      Game2048Logic,
      Balances,
    });

    appChain.configurePartial({
      Runtime: {
        Game2048Logic: {},
        Balances: {
          totalSupply: UInt64.from(10000),
        },
      },
    });

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();

    const bobPrivateKey = PrivateKey.random();
    const bob = bobPrivateKey.toPublicKey();

    await appChain.start();

    const game2048 = appChain.runtime.resolve('Game2048Logic');

    console.log('Finding match');
    // Find match
    {
      appChain.setSigner(alicePrivateKey);
      const tx1 = await appChain.transaction(alice, async () => {
        game2048.register(alice, UInt64.zero);
      });
      await tx1.sign();
      await tx1.send();

      let block = await appChain.produceBlock();
      console.log(block?.transactions[0])
      expect(block?.transactions[0].status.toBoolean()).toBeTruthy();

      appChain.setSigner(bobPrivateKey);
      const tx2 = await appChain.transaction(bob, async () => {
        game2048.register(bob, UInt64.zero);
      });
      await tx2.sign();
      await tx2.send();

      block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBeTruthy();

      let aliceGameId =
        await appChain.query.runtime.Game2048Logic.activeGameId.get(alice);
      let bobGameId =
        await appChain.query.runtime.Game2048Logic.activeGameId.get(bob);

      console.log(aliceGameId?.toString());
      expect(aliceGameId!.equals(bobGameId!)).toBeTruthy();
    }
  }, 100000);
});
