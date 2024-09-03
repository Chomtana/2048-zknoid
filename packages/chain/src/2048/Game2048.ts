import { state, runtimeMethod, runtimeModule } from '@proto-kit/module';
import type { Option } from '@proto-kit/protocol';
import { State, StateMap, assert } from '@proto-kit/protocol';
import {
  PublicKey,
  Struct,
  UInt64,
  Provable,
  Bool,
  UInt32,
  Poseidon,
  Field,
  Int64,
} from 'o1js';
import { MatchMaker } from '../engine/MatchMaker';
import type { QueueListItem } from '../engine/MatchMaker';
import { UInt64 as ProtoUInt64 } from '@proto-kit/library';
import { Lobby } from '../engine/LobbyManager';
import { Board } from './Board'

export { Board };

export class GameInfo extends Struct({
  player1: PublicKey,
  player2: PublicKey,
  currentMoveUser: PublicKey,
  lastMoveBlockHeight: UInt64,
  board1: Field,
  board2: Field,
  winner: PublicKey,
}) {}

@runtimeModule()
export class Game2048Logic extends MatchMaker {
  // Game ids start from 1
  @state() public games = StateMap.from<UInt64, GameInfo>(UInt64, GameInfo);

  @state() public gamesNum = State.from<UInt64>(UInt64);

  public override async initGame(lobby: Lobby, shouldUpdate: Bool): Promise<UInt64> {
    const currentGameId = lobby.id;

    // Setting active game if opponent found
    await this.games.set(
      Provable.if(shouldUpdate, currentGameId, UInt64.from(0)),
      new GameInfo({
        player1: lobby.players[0],
        player2: lobby.players[1],
        currentMoveUser: lobby.players[0],
        lastMoveBlockHeight: this.network.block.height,
        board1: Field(0),
        board2: Field(0),
        winner: PublicKey.empty(),
      }),
    );

    await this.gameFund.set(
      currentGameId,
      ProtoUInt64.from(lobby.participationFee).mul(2),
    );

    return await super.initGame(lobby, shouldUpdate);
  }

  @runtimeMethod()
  public async proveOpponentTimeout(gameId: UInt64): Promise<void> {
    await super.proveOpponentTimeout(gameId, true);
  }

  // @runtimeMethod()
  // async resetGame(sessionKey: PublicKey) {
  //   assert(this.transaction.sender.isSome, "No sender");

  //   const player = this.transaction.sender.value

  //   let boardOption = await this.board.get(player);
  //   let boardRaw = boardOption.orElse(Field(0));
  //   let board = new Board(boardRaw)

  //   let maxScoreOption = await this.maxScore.get(player);
  //   let maxScore = maxScoreOption.orElse(UInt32.zero);
  //   let maxScoreNew = Provable.if(
  //     board.score.greaterThan(maxScore),
  //     board.score,
  //     maxScore,
  //   )

  //   let gameCountOption = await this.gameCount.get(player);
  //   let gameCount = gameCountOption.orElse(UInt32.zero);
  //   let gameCountNew = Provable.if(
  //     boardRaw.equals(0n),
  //     gameCount,
  //     gameCount.add(1),
  //   )

  //   // update score and game count
  //   await this.maxScore.set(player, maxScoreNew)
  //   await this.gameCount.set(player, gameCountNew)

  //   // reset board
  //   await this.board.set(player, Field(0))

  //   // map session key
  //   await this.sessionKey.set(sessionKey, player)
  // }

  getBoardKnownGame(game: GameInfo): [Board, Board, Bool] {
    const isPlayer1 = game.currentMoveUser.equals(game.player1)

    // isOpponent <-> isPlayer1 then return board2
    const boardPlayerField = Provable.if(
      isPlayer1,
      game.board1,
      game.board2,
    )

    const boardOpField = Provable.if(
      isPlayer1,
      game.board2,
      game.board1,
    )

    let boardPlayer = new Board(boardPlayerField)
    let boardOp = new Board(boardOpField)

    assert(boardPlayer.ended.not(), "Game ended");
    assert(boardOp.ended.not(), "Game ended");

    return [boardPlayer, boardOp, isPlayer1]
  }

  async getBoard(gameId: UInt64): Promise<[GameInfo, Board, Board, Bool]> {
    const sessionSender = await this.sessions.get(this.transaction.sender.value);
    const sender = Provable.if(
      sessionSender.isSome,
      sessionSender.value,
      this.transaction.sender.value,
    );

    const game = await this.games.get(gameId);
    assert(game.isSome, 'Invalid game id');
    assert(game.value.currentMoveUser.equals(sender), `Not your move`);
    assert(game.value.winner.equals(PublicKey.empty()), `Game finished`);

    const [boardPlayer, boardOp, isPlayer1] = this.getBoardKnownGame(game.value);

    return [game.value, boardPlayer, boardOp, isPlayer1]
  }

  async handleGameReward(gameId: UInt64, game: GameInfo) {
    const board1Ended = game.board1.toBits(4 * 4 * 5 + 1)[4 * 4 * 5]
    const board2Ended = game.board1.toBits(4 * 4 * 5 + 1)[4 * 4 * 5]

    game.winner = Provable.if(
      board1Ended,
      game.player2,
      Provable.if(
        board2Ended,
        game.player1,
        PublicKey.empty(),
      ),
    );

    const winnerShare = ProtoUInt64.from(
      Provable.if<ProtoUInt64>(
        game.winner.equals(PublicKey.empty()),
        ProtoUInt64,
        ProtoUInt64.from(0),
        ProtoUInt64.from(1),
      ),
    );

    await this.acquireFunds(
      gameId,
      game.winner,
      PublicKey.empty(),
      winnerShare,
      ProtoUInt64.from(0),
      ProtoUInt64.from(1),
    );
  }

  async commitGameState(gameId: UInt64, game: GameInfo, boardPlayer: Board, boardOp: Board, isPlayer1: Bool) {
    game.board1 = Provable.if(
      isPlayer1,
      boardPlayer.serialize(),
      boardOp.serialize(),
    )

    game.board2 = Provable.if(
      isPlayer1,
      boardOp.serialize(),
      boardPlayer.serialize(),
    )

    game.currentMoveUser = Provable.if(
      isPlayer1,
      game.player2,
      game.player1,
    );

    game.lastMoveBlockHeight = this.network.block.height;

    await this.games.set(gameId, game);
  }

  @runtimeMethod()
  async moveUp(gameId: UInt64, r: Field, c: Field) {
    const [game, boardPlayer, boardOp, isPlayer1] = await this.getBoard(gameId)

    boardPlayer.moveUp()
    boardOp.newTile(r, c, UInt32.one)

    await this.commitGameState(gameId, game, boardPlayer, boardOp, isPlayer1)
  }

  @runtimeMethod()
  async moveDown(gameId: UInt64, r: Field, c: Field) {
    const [game, boardPlayer, boardOp, isPlayer1] = await this.getBoard(gameId)

    boardPlayer.moveDown()
    boardOp.newTile(r, c, UInt32.one)

    await this.commitGameState(gameId, game, boardPlayer, boardOp, isPlayer1)
  }

  @runtimeMethod()
  async moveLeft(gameId: UInt64, r: Field, c: Field) {
    const [game, boardPlayer, boardOp, isPlayer1] = await this.getBoard(gameId)

    boardPlayer.moveLeft()
    boardOp.newTile(r, c, UInt32.one)

    await this.commitGameState(gameId, game, boardPlayer, boardOp, isPlayer1)
  }

  @runtimeMethod()
  async moveRight(gameId: UInt64, r: Field, c: Field) {
    const [game, boardPlayer, boardOp, isPlayer1] = await this.getBoard(gameId)

    boardPlayer.moveRight()
    boardOp.newTile(r, c, UInt32.one)

    await this.commitGameState(gameId, game, boardPlayer, boardOp, isPlayer1)
  }

  // @runtimeMethod()
  // public async makeMove(
  //   gameId: UInt64,
  //   newField: RandzuField,
  //   winWitness: WinWitness,
  // ): Promise<void> {
  //   const sessionSender = await this.sessions.get(this.transaction.sender.value);
  //   const sender = Provable.if(
  //     sessionSender.isSome,
  //     sessionSender.value,
  //     this.transaction.sender.value,
  //   );

  //   const game = await this.games.get(gameId);
  //   assert(game.isSome, 'Invalid game id');
  //   assert(game.value.currentMoveUser.equals(sender), `Not your move`);
  //   assert(game.value.winner.equals(PublicKey.empty()), `Game finished`);

  //   winWitness.assertCorrect();

  //   const winProposed = Bool.and(
  //     winWitness.directionX.equals(UInt32.from(0)),
  //     winWitness.directionY.equals(UInt32.from(0)),
  //   ).not();

  //   const currentUserId = Provable.if(
  //     game.value.currentMoveUser.equals(game.value.player1),
  //     UInt32.from(1),
  //     UInt32.from(2),
  //   );

  //   const addedCellsNum = UInt64.from(0);
  //   for (let i = 0; i < RANDZU_FIELD_SIZE; i++) {
  //     for (let j = 0; j < RANDZU_FIELD_SIZE; j++) {
  //       const currentFieldCell = game.value.field.value[i][j];
  //       const nextFieldCell = newField.value[i][j];

  //       assert(
  //         Bool.or(
  //           currentFieldCell.equals(UInt32.from(0)),
  //           currentFieldCell.equals(nextFieldCell),
  //         ),
  //         `Modified filled cell at ${i}, ${j}`,
  //       );

  //       addedCellsNum.add(
  //         Provable.if(
  //           currentFieldCell.equals(nextFieldCell),
  //           UInt64.from(0),
  //           UInt64.from(1),
  //         ),
  //       );

  //       assert(
  //         addedCellsNum.lessThanOrEqual(UInt64.from(1)),
  //         `Exactly one cell should be added. Error at ${i}, ${j}`,
  //       );
  //       assert(
  //         Provable.if(
  //           currentFieldCell.equals(nextFieldCell),
  //           Bool(true),
  //           nextFieldCell.equals(currentUserId),
  //         ),
  //         'Added opponent`s color',
  //       );

  //       for (let wi = 0; wi < CELLS_LINE_TO_WIN; wi++) {
  //         const winPosX = winWitness.directionX
  //           .mul(UInt32.from(wi))
  //           .add(winWitness.x);
  //         const winPosY = winWitness.directionY
  //           .mul(UInt32.from(wi))
  //           .add(winWitness.y);
  //         assert(
  //           Bool.or(
  //             winProposed.not(),
  //             Provable.if(
  //               Bool.and(
  //                 winPosX.equals(UInt32.from(i)),
  //                 winPosY.equals(UInt32.from(j)),
  //               ),
  //               nextFieldCell.equals(currentUserId),
  //               Bool(true),
  //             ),
  //           ),
  //           'Win not proved',
  //         );
  //       }
  //     }
  //   }

  //   game.value.winner = Provable.if(
  //     winProposed,
  //     game.value.currentMoveUser,
  //     PublicKey.empty(),
  //   );

  //   const winnerShare = ProtoUInt64.from(
  //     Provable.if<ProtoUInt64>(
  //       winProposed,
  //       ProtoUInt64,
  //       ProtoUInt64.from(1),
  //       ProtoUInt64.from(0),
  //     ),
  //   );

  //   await this.acquireFunds(
  //     gameId,
  //     game.value.winner,
  //     PublicKey.empty(),
  //     winnerShare,
  //     ProtoUInt64.from(0),
  //     ProtoUInt64.from(1),
  //   );

  //   game.value.field = newField;
  //   game.value.currentMoveUser = Provable.if(
  //     game.value.currentMoveUser.equals(game.value.player1),
  //     game.value.player2,
  //     game.value.player1,
  //   );
  //   game.value.lastMoveBlockHeight = this.network.block.height;
  //   await this.games.set(gameId, game.value);

  //   // Removing active game for players if game ended
  //   await this.activeGameId.set(
  //     Provable.if(winProposed, game.value.player2, PublicKey.empty()),
  //     UInt64.from(0),
  //   );
  //   await this.activeGameId.set(
  //     Provable.if(winProposed, game.value.player1, PublicKey.empty()),
  //     UInt64.from(0),
  //   );

  //   await this._onLobbyEnd(gameId, winProposed);
  // }
}
