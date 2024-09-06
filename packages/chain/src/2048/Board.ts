import {
  Field,
  Bool,
  UInt32,
  Provable,
} from 'o1js';

const BOARD_ROWS = 4
const BOARD_COLS = 4
const NUM_BITS = 5

export class Board {
  board: UInt32[][];
  ended: Bool;
  score: UInt32;

  constructor(serializedBoard: Field) {
    const bits = serializedBoard.toBits(BOARD_ROWS * BOARD_COLS * NUM_BITS + 33);
    let board = [];
    for (let i = 0; i < BOARD_ROWS; i++) {
      let row = [];
      for (let j = 0; j < BOARD_COLS; j++) {
        const pos = i * BOARD_COLS + j
        const numBits = bits.slice(pos * NUM_BITS, pos * NUM_BITS + NUM_BITS)
        row.push(new UInt32(this.combineBits(numBits)));
      }
      board.push(row);
    }
    this.ended = bits[BOARD_ROWS * BOARD_COLS * NUM_BITS]
    this.score = new UInt32(this.combineBits(bits.slice(BOARD_ROWS * BOARD_COLS * NUM_BITS + 1), 31))
    this.board = board;
  }

  combineBits(bits: Bool[], bitCount = NUM_BITS): UInt32 {
    let result = new UInt32(0)
    for (let i = 0; i < bitCount; i++) {
      result = result.add(
        Provable.if(
          bits[bitCount - i - 1],
          new UInt32(1 << i),
          UInt32.zero,
        )
      )
    }
    return result
  }

  numberToBits(num: UInt32, bitCount = NUM_BITS): Bool[] {
    let bits: Bool[] = [];
    for (let i = bitCount - 1; i >= 0; i--) {
      bits.push(num.greaterThanOrEqual(new UInt32(1 << i)))
      num = num.mod(1 << i)
    }
    return bits
  }

  // Support 1 - 17 which is the most number one can reach
  pow2(num: UInt32): UInt32 {
    let result = new UInt32(0)

    for (let i = 1; i < 18; i++) {
      result = result.add(
        Provable.if(
          new UInt32(i).equals(num),
          new UInt32(1 << i),
          UInt32.zero,
        )
      )
    }

    return result
  }

  serialize(): Field {
    let bits: Bool[] = [];
    for (let i = 0; i < BOARD_ROWS; i++) {
      for (let j = 0; j < BOARD_COLS; j++) {
        bits = bits.concat(
          this.numberToBits(this.board[i][j])
        )
      }
    }

    bits = bits.concat([
      this.ended,
      ...this.numberToBits(this.score, 31),
    ])

    return Field.fromBits(bits);
  }

  hasNextMove(): Bool {
    let has = new Bool(false);

    // check missing cell
    for (let i = 0; i < BOARD_ROWS; i++) {
      for (let j = 0; j < BOARD_COLS; j++) {
        let row = this.board[i][j];
        has = has.or(row.equals(UInt32.zero))
      }
    }

    // check adjacent rows
    for (let j = 0; j < BOARD_COLS; j++) {
      for (let i = 0; i < BOARD_ROWS - 1; i++) {
        let a = this.board[i][j]
        let b = this.board[i+1][j]
        has = has.or(a.equals(b))
      }
    }

    // check adjacent cols
    for (let i = 0; i < BOARD_ROWS; i++) {
      for (let j = 0; j < BOARD_COLS - 1; j++) {
        let a = this.board[i][j]
        let b = this.board[i][j+1]
        has = has.or(a.equals(b))
      }
    }

    return has
  }

  newTile(r: Field, c: Field, num: UInt32) {
    num.assertGreaterThan(new UInt32(0));

    for (let i = 0; i < BOARD_ROWS; i++) {
      for (let j = 0; j < BOARD_COLS; j++) {
        // is this the cell the player wants to play?
        const toUpdate = r.equals(new Field(i)).and(c.equals(new Field(j))).and(this.board[i][j].equals(UInt32.zero));

        // copy the board (or update if this is the cell the player wants to play)
        this.board[i][j] = Provable.if(
          toUpdate,
          new UInt32(num),
          this.board[i][j]
        );
      }
    }

    this.ended = this.hasNextMove().not()
  }

  moveTile(c: [number, number], a: [number, number], breakLoop: Bool) {
    const curr = this.board[c[0]][c[1]]
    const adj = this.board[a[0]][a[1]]

    const currEmpty = curr.equals(UInt32.zero)
    const adjEmpty = adj.equals(UInt32.zero)
    const eq = curr.equals(adj)

    this.score = this.score.add(
      Provable.if(
        eq.and(currEmpty.not()).and(breakLoop.not()),
        this.pow2(this.board[a[0]][a[1]].add(UInt32.one)),
        UInt32.zero,
      )
    )

    this.board[a[0]][a[1]] = Provable.if(
      currEmpty.or(breakLoop),
      this.board[a[0]][a[1]],
      Provable.if(
        adjEmpty,
        this.board[c[0]][c[1]],
        Provable.if(
          eq,
          this.board[a[0]][a[1]].add(UInt32.one),
          this.board[a[0]][a[1]],
        )
      )
    )

    this.board[c[0]][c[1]] = Provable.if(
      currEmpty.or(breakLoop),
      this.board[c[0]][c[1]],
      Provable.if(
        adjEmpty.or(eq),
        UInt32.zero,
        this.board[c[0]][c[1]],
      )
    )

    // console.log(c, a, this.board[c[0]][c[1]].toString(), this.board[a[0]][a[1]].toString(), currEmpty.toString(), adjEmpty.toString(), eq.toString())

    return adjEmpty.not()
  }

  moveUp() {
    // Loop will be break if adj is not empty
    let breakLoop = new Bool(false);

    for (let j = 0; j < BOARD_COLS; j++) {
      for (let i = 1; i < BOARD_ROWS; i++) {
        const k = i;
        for (let m = k; m > 0; m--) {
          breakLoop = this.moveTile([m, j], [m-1, j], breakLoop)
        }
        breakLoop = new Bool(false)
      }
    }

    this.ended = this.hasNextMove().not()
  }

  moveDown() {
    // Loop will be break if adj is not empty
    let breakLoop = new Bool(false);

    for (let j = 0; j < BOARD_COLS; j++) {
      for (let i = BOARD_ROWS - 2; i >= 0; i--) {
        const k = i;
        for (let m = k; m < BOARD_ROWS - 1; m++) {
          breakLoop = this.moveTile([m, j], [m+1, j], breakLoop)
        }
        breakLoop = new Bool(false)
      }
    }

    this.ended = this.hasNextMove().not()
  }

  moveLeft() {
    // Loop will be break if adj is not empty
    let breakLoop = new Bool(false);

    for (let i = 0; i < BOARD_ROWS; i++) {
      for (let j = 1; j < BOARD_COLS; j++) {
        const k = j;
        for (let m = k; m > 0; m--) {
          breakLoop = this.moveTile([i, m], [i, m-1], breakLoop)
        }
        breakLoop = new Bool(false)
      }
    }

    this.ended = this.hasNextMove().not()
  }

  moveRight() {
    // Loop will be break if adj is not empty
    let breakLoop = new Bool(false);

    for (let i = 0; i < BOARD_ROWS; i++) {
      for (let j = BOARD_COLS - 2; j >= 0; j--) {
        const k = j;
        for (let m = k; m < BOARD_COLS - 1; m++) {
          breakLoop = this.moveTile([i, m], [i, m+1], breakLoop)
        }
        breakLoop = new Bool(false)
      }
    }

    this.ended = this.hasNextMove().not()
  }

  // Debugging functions

  printState() {
    for (let i = 0; i < BOARD_ROWS; i++) {
      let row = '| ';
      for (let j = 0; j < BOARD_COLS; j++) {
        let num = 1 << parseInt(this.board[i][j].toString())
        if (num == 1) num = 0
        let token = num.toString().padStart(4, ' ')
        row += token + ' | ';
      }
      row += ' |'
      console.log(row);
    }
    console.log('Score:', Number(this.score.toBigint()))
    console.log('---\n');
  }

  toArray(): number[][] {
    const result: number[][] = []
    for (let i = 0; i < BOARD_ROWS; i++) {
      const row: number[] = []
      for (let j = 0; j < BOARD_COLS; j++) {
        row.push(parseInt(this.board[i][j].toString()))
      }
      result.push(row)
    }
    return result
  }

  randomEmptyTile(): [number, number] {
    const emptyTiles: [number, number][] = []

    const tiles = this.toArray()

    for (let i = 0; i < BOARD_ROWS; i++) {
      for (let j = 0; j < BOARD_COLS; j++) {
        if (!tiles[i][j]) {
          emptyTiles.push([i, j])
        }
      }
    }

    if (emptyTiles.length == 0) return [-1, -1]

    return emptyTiles[Math.floor(Math.random() * emptyTiles.length)]
  }
}