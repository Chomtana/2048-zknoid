import { runtimeModule, state, runtimeMethod, RuntimeModule } from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Balance, Balances as BaseBalances, TokenId } from "@proto-kit/library";
import { Field, Provable, PublicKey, UInt32 } from "o1js";
import { Board } from "./Board";

export { Board }

interface Game2048Config {}

@runtimeModule()
export class Game2048 extends RuntimeModule<Game2048Config> {
  @state() public board = StateMap.from<PublicKey, Field>(PublicKey, Field);
  @state() public maxScore = StateMap.from<PublicKey, UInt32>(PublicKey, UInt32);
  @state() public gameCount = StateMap.from<PublicKey, UInt32>(PublicKey, UInt32);
  @state() public sessionKey = StateMap.from<PublicKey, PublicKey>(PublicKey, PublicKey);

  @runtimeMethod()
  async resetGame(sessionKey: PublicKey) {
    assert(this.transaction.sender.isSome, "No sender");

    const player = this.transaction.sender.value

    let boardOption = await this.board.get(player);
    let boardRaw = boardOption.orElse(Field(0));
    let board = new Board(boardRaw)

    let maxScoreOption = await this.maxScore.get(player);
    let maxScore = maxScoreOption.orElse(UInt32.zero);
    let maxScoreNew = Provable.if(
      board.score.greaterThan(maxScore),
      board.score,
      maxScore,
    )

    let gameCountOption = await this.gameCount.get(player);
    let gameCount = gameCountOption.orElse(UInt32.zero);
    let gameCountNew = Provable.if(
      boardRaw.equals(0n),
      gameCount,
      gameCount.add(1),
    )

    // update score and game count
    await this.maxScore.set(player, maxScoreNew)
    await this.gameCount.set(player, gameCountNew)

    // reset board
    await this.board.set(player, Field(0))

    // map session key
    await this.sessionKey.set(sessionKey, player)
  }

  async getBoard(): Promise<[Board, PublicKey]> {
    assert(this.transaction.sender.isSome, "No sender");

    const player = await this.sessionKey.get(this.transaction.sender.value)
    assert(player.isSome, "No associated player");

    let boardOption = await this.board.get(player.value);
    assert(boardOption.isSome, "Game is not initialized");

    let board = new Board(boardOption.value)

    assert(board.ended.not(), "Game ended");

    return [board, player.value]
  }

  @runtimeMethod()
  async addTile(
    r: Field,
    c: Field,
  ) {
    const [board, player] = await this.getBoard()

    board.newTile(r, c, UInt32.one)

    await this.board.set(player, board.serialize())
  }

  @runtimeMethod()
  async moveUp() {
    const [board, player] = await this.getBoard()

    board.moveUp()

    await this.board.set(player, board.serialize())
  }

  @runtimeMethod()
  async moveDown() {
    const [board, player] = await this.getBoard()

    board.moveDown()

    await this.board.set(player, board.serialize())
  }

  @runtimeMethod()
  async moveLeft() {
    const [board, player] = await this.getBoard()

    board.moveLeft()

    await this.board.set(player, board.serialize())
  }

  @runtimeMethod()
  async moveRight() {
    const [board, player] = await this.getBoard()

    board.moveRight()

    await this.board.set(player, board.serialize())
  }
}
