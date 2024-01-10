'use client';
import {
  Brick,
  Bricks,
  Tick,
  loadGameContext,
  BRICK_HALF_WIDTH,
  MAX_BRICKS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  DEFAULT_BALL_LOCATION_X,
  DEFAULT_BALL_LOCATION_Y,
  TICK_PERIOD,
  DEFAULT_BALL_SPEED_X,
  DEFAULT_BALL_SPEED_Y,
  IntPoint,
  DEFAULT_PLATFORM_SPEED,
  GameContext,
  ACCELERATION,
} from 'zknoid-chain-dev';
import { useEffect, useRef, useState } from 'react';
import { Int64, UInt64, Bool } from 'o1js';
import { Ball, Cart, IBrick } from '@/lib/types';

export interface ITick {
  action: number;
  momentum: number;
}

interface IGameViewProps {
  gameId: number;
  onWin: (ticks: ITick[]) => void;
  onLost: (ticks: ITick[]) => void;
  setScore: (score: number) => void;
  setTicksAmount: (ticksAmount: number) => void;
  level: Bricks;
  debug: boolean;
}

interface IContractBrick {
  pos: IntPoint;
  value: UInt64;
}

interface IContractBrickPorted {
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
}

export const GameView = (props: IGameViewProps) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ctx, setContext] = useState<
    CanvasRenderingContext2D | null | undefined
  >(null);
  const [win, setWin] = useState(false);
  const [lost, setLost] = useState(false);

  let [winable, setWinable] = useState(true);

  let ticksCache: ITick[] = [];
  let bricksLeft: number = 0;

  // const [ticks, setTicks] = useState<number[]>([]);

  let lastUpdateTime = Date.now();
  const tickPeriod = TICK_PERIOD;

  let gameContext: GameContext; // For updating contractBall position

  let ball: Ball;
  let contractBall: Ball;
  let cart: Cart;
  let prevCartPos: number;
  let contractCart: Cart;
  let bricks: IBrick[] = [];
  let contractBricks: IBrick[] = [];
  let stopped: boolean = false;
  const debugMode = props.debug;

  const debugModeRef = useRef(debugMode);

  let ballTrace: [number, number][] = [];
  let contractBallTrace: [number, number][] = [];

  useEffect(() => {
    if (props.gameId > 0) startGame();
  }, [props.gameId]);

  useEffect(() => {
    debugModeRef.current = debugMode;
  }, [debugMode]);

  useEffect(() => {
    const ctx = canvas!.current?.getContext('2d');
    setContext(ctx);
  }, [canvas]);

  let lastTime: number | undefined;

  const gameLoop = (time: number) => {
    if (stopped) return;

    if (lastTime === undefined) lastTime = time;

    const elapsed = time - lastTime;

    lastTime = time;

    ctx!.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT + 10);
    moveCart(elapsed);
    moveBall(elapsed);

    drawBall();
    drawBricks();

    drawCart();

    if (debugModeRef.current) {
      drawContractBall();
      drawContractBricks();
      drawContractCart();
      drawBallsTraces();
    }

    if (Date.now() - lastUpdateTime > tickPeriod) {
      pushTick(Math.round(cart.x - prevCartPos), cart.hitMomentum);
      prevCartPos = cart.x;
      // ticksCache.push(1);
      // setTicks([...ticksCache, 1]);
      lastUpdateTime = Date.now();
    }

    requestAnimationFrame(gameLoop);
  };

  const moveCart = (elapsed: number) => {
    cart.dx += (cart.ddx * elapsed) / TICK_PERIOD;
    if (cart.dx > 0) {
      cart.dx = Math.min(cart.dx, DEFAULT_PLATFORM_SPEED);
    } else {
      cart.dx = Math.max(cart.dx, -DEFAULT_PLATFORM_SPEED);
    }
    cart.x += (cart.dx * elapsed) / TICK_PERIOD;

    if (cart.x > FIELD_WIDTH - cart.w) {
      cart.x = FIELD_WIDTH - cart.w;
    }

    if (cart.x < 0) {
      cart.x = 0;
    }
  };

  const moveBall = (elapsed: number) => {
    ball.x += (ball.dx * elapsed) / TICK_PERIOD;
    ball.y += (ball.dy * elapsed) / TICK_PERIOD;

    const leftBump = ball.x - ball.radius < 0;
    const rightBump = ball.x - FIELD_WIDTH > 0;
    const topBump = ball.y < 0;
    let bottomBump = ball.y - FIELD_HEIGHT > 0; // Undo bump if hiy cart

    if (leftBump) {
      ball.x *= -1;
    }

    if (rightBump) {
      ball.x = FIELD_WIDTH - (ball.x - FIELD_WIDTH);
    }

    if (rightBump) {
      ball.x = FIELD_WIDTH - (ball.x - FIELD_WIDTH);
    }

    if (leftBump || rightBump) {
      ball.dx *= -1;
    }

    if (topBump) {
      ball.y *= 1;
      ball.dy *= -1;
    }

    if (
      ball.x - ball.radius > cart.x &&
      ball.x + ball.radius < cart.x + cart.w &&
      ball.y > cart.y
    ) {
      ball.y = 2 * cart.y - ball.y;
      ball.dy *= -1;
      cart.hitMomentum = Math.round(cart.dx / 10);
      ball.dx += cart.hitMomentum;
      bottomBump = false;
    }

    if (bottomBump) {
      return onLost();
    }

    ballTrace.push([ball.x, ball.y]);

    const bricksNum = gameContext.bricks.bricks
      .map((brick: IContractBrick) => {
        return {
          value: +brick.value.toString(),
        } as IContractBrickPorted;
      })
      .filter((brick: IContractBrickPorted) => brick.value > 1).length;

    if (bricksNum == 0) {
      stopped = true;
      return onWin();
    }

    bricks.forEach((brick) => {
      if (brick.value > 1) {
        if (
          ball.x - ball.radius > brick.x &&
          ball.x + ball.radius < brick.x + brick.w &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.h
        ) {
          let leftBorder = brick.x;
          let rightBorder = brick.x + brick.w;
          let topBorder = brick.y;
          let bottomBorder = brick.y + brick.h;

          let leftBorderDist = Math.abs(ball.x - leftBorder);
          let rightBorderDist = Math.abs(ball.x - rightBorder);
          let topBorderDist = Math.abs(ball.y - topBorder);
          let bottomBorderDist = Math.abs(ball.y - bottomBorder);

          let minVerticalDist = Math.min(topBorderDist, bottomBorderDist);
          let minHorizontalDist = Math.min(leftBorderDist, rightBorderDist);

          if (minHorizontalDist < minVerticalDist) {
            if (leftBorderDist < rightBorderDist) {
              ball.x = 2 * leftBorder - ball.x;
            } else {
              ball.x = 2 * rightBorder - ball.x;
            }
            ball.dx *= -1;
          } else {
            if (topBorderDist < bottomBorderDist) {
              ball.y = 2 * topBorder - ball.y;
            } else {
              ball.y = 2 * bottomBorder - ball.y;
            }
            ball.dy *= -1;
          }

          brick.value = 1;
          bricksLeft -= 1;
        }
      }
    });
  };

  const drawBall = () => {
    ctx!.beginPath();
    ctx!.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx!.fillStyle = 'black';
    ctx!.fill();
    ctx!.closePath();
  };

  const drawContractBall = () => {
    ctx!.beginPath();
    ctx!.arc(
      contractBall.x,
      contractBall.y,
      contractBall.radius,
      0,
      Math.PI * 2,
    );
    ctx!.strokeStyle = 'red';
    ctx!.stroke();
    ctx!.closePath();
  };

  const drawBricks = () => {
    bricks.forEach((brick) => {
      ctx!.beginPath();
      ctx!.rect(brick.x, brick.y, brick.w, brick.h);
      ctx!.fillStyle = brick.value > 1 ? '#0095dd' : 'transparent';
      ctx!.fill();
      ctx!.closePath();
    });
  };

  const drawContractBricks = () => {
    ctx!.strokeStyle = 'red';
    ctx!.setLineDash([5, 5]);

    contractBricks.forEach((brick) => {
      ctx!.beginPath();
      ctx!.rect(brick.x, brick.y, brick.w, brick.h);
      ctx!.stroke();
      ctx!.closePath();
    });
    ctx!.setLineDash([]);
  };

  const drawCart = () => {
    ctx!.beginPath();
    ctx!.rect(cart.x, cart.y, cart.w, cart.h);
    ctx!.fillStyle = 'red';
    ctx!.fill();
    ctx!.closePath();
  };

  const drawContractCart = () => {
    ctx!.setLineDash([5, 5]);
    ctx!.beginPath();
    ctx!.rect(contractCart.x, contractCart.y, contractCart.w, contractCart.h);
    ctx!.strokeStyle = 'green';
    ctx!.stroke();
    ctx!.closePath();
    ctx!.setLineDash([]);
  };

  const drawBallsTraces = () => {
    const prevLineWidth = ctx!.lineWidth;
    ctx!.lineWidth = 0.3;
    ctx!.setLineDash([5, 5]);

    // Ball trace
    ctx!.beginPath();
    ctx!.strokeStyle = 'black';
    if (ballTrace.length > 0) {
      ctx!.moveTo(ballTrace[0][0], ballTrace[0][1]);
    }
    for (const point of ballTrace.slice(1)) {
      ctx!.lineTo(point[0], point[1]);
    }
    ctx!.stroke();
    ctx!.closePath();

    // Contract ball trace
    ctx!.beginPath();
    ctx!.strokeStyle = 'red';
    if (contractBallTrace.length > 0) {
      ctx!.moveTo(contractBallTrace[0][0], contractBallTrace[0][1]);
    }
    for (const point of contractBallTrace) {
      ctx!.lineTo(point[0], point[1]);
    }
    ctx!.stroke();
    ctx!.closePath();

    ctx!.lineWidth = prevLineWidth;
    ctx!.setLineDash([]);
  };

  const keyDown = (e: KeyboardEvent) => {
    if (e.key === 'Right' || e.key === 'ArrowRight') {
      // if (
      //   Date.now() - lastUpdateTime >
      //   tickPeriod
      //   // ticksCache[ticksCache.length - 1] != 2
      // ) {
      //   // pushTick(DEFAULT_PLATFORM_SPEED);
      //   // ticksCache.push(2);
      //   //   setTicks([...ticksCache, 2]);
      //   lastUpdateTime = Date.now();
      // }

      cart.ddx = ACCELERATION;
    } else if (e.key === 'Left' || e.key === 'ArrowLeft') {
      // if (
      //   Date.now() - lastUpdateTime >
      //   tickPeriod
      //   // ticksCache[ticksCache.length - 1] != 0
      // ) {
      //   // pushTick(-DEFAULT_PLATFORM_SPEED);
      //   // ticksCache.push(0);
      //   //   setTicks([...ticksCache, 0]);
      //   lastUpdateTime = Date.now();
      // }

      cart.ddx = -ACCELERATION;
    }
  };

  const keyUp = (e: KeyboardEvent) => {
    if (
      e.key === 'Right' ||
      e.key === 'ArrowRight' ||
      e.key === 'Left' ||
      e.key === 'ArrowLeft'
    ) {
      cart.ddx = 0;
      cart.dx = 0;
    }
  };

  const startGame = () => {
    setLost(false);
    setWin(false);
    lastTime = undefined;
    stopped = false;
    bricksLeft = props.level.bricks.length;

    ball = {
      x: DEFAULT_BALL_LOCATION_X,
      y: DEFAULT_BALL_LOCATION_Y,
      dx: DEFAULT_BALL_SPEED_X,
      dy: DEFAULT_BALL_SPEED_Y,
      radius: 3,
    };

    console.log(ball);

    cart = {
      x: FIELD_WIDTH / 2,
      y: FIELD_HEIGHT,
      w: 100,
      h: 10,
      dx: 0,
      ddx: 0,
      hitMomentum: 0,
    };
    prevCartPos = cart.x;

    const commonBrick = {
      w: 30,
      h: 30,
      gap: 20,
    };

    for (let i = 0; i < bricks.length; i++) {}

    console.log('Level bricks', props.level.bricks);

    for (let i = 0; i < props.level.bricks.length; i++) {
      const brickValue = props.level.bricks[i].value * 1;
      if (brickValue > 0)
        bricks[i] = {
          x: props.level.bricks[i].pos.x * 1,
          y: props.level.bricks[i].pos.y * 1,
          value: brickValue,
          ...commonBrick,
        };
    }

    console.log(' bricks', bricks);

    /// Contract context init
    //@ts-ignore
    const contractBricks: Bricks = new Bricks({
      bricks: [...new Array(MAX_BRICKS)].map(
        (elem) =>
          //@ts-ignore
          new Brick({
            pos: {
              x: Int64.from(0),
              y: Int64.from(0),
            },
            value: UInt64.from(1),
          }),
      ),
    });

    for (let i = 0; i < Math.min(props.level.bricks.length, MAX_BRICKS); i++) {
      //@ts-ignore
      contractBricks.bricks[i] = new Brick({
        pos: {
          x: Int64.from(bricks[i].x),
          y: Int64.from(bricks[i].y),
        },
        value: UInt64.from(bricks[i].value),
      });
    }

    gameContext = loadGameContext(contractBricks, new Bool(false));
    contractBall = {
      x: gameContext.ball.position.x * 1,
      y: gameContext.ball.position.y * 1,
      dx: 0,
      dy: 0,
      radius: 3,
    };

    contractCart = {
      ...cart,
      x: gameContext.platform.position * 1,
    };

    if (
      ball.x - ball.radius > cart.x &&
      ball.x + ball.radius < cart.x + cart.w &&
      ball.y + ball.radius > cart.y
    ) {
      ball.dy = -ball.dy;
    }

    requestAnimationFrame(gameLoop);

    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);
  };
  const onWin = async () => {
    stopped = true;

    props.onWin(ticksCache);
    return;
  };

  const onLost = async () => {
    stopped = true;

    props.onLost(ticksCache);
    return;

    // client.start();
    // const gameHub = client.runtime.resolve('GameHub');
    // const sender = PublicKey.fromBase58(address);

    // const tx1 = await client.transaction(sender, () => {
    //     gameHub.addGameResult(sender, GameRecordProof.fromJSON(DUMMY_PROOF));
    // });

    // await tx1.sign();
    // await tx1.send();

    // const sender = PublicKey.fromBase58(address);

    // const tx = await client.transaction(sender, () => {
    //   balances.addBalance(sender, UInt64.from(1000));
    // });
  };

  const getCollisionPoint = (
    pos: [number, number],
    speed: [number, number],
  ): [number, number] => {
    let overflowPoint = [pos[0] + speed[0], pos[1] + speed[1]];
    let t: number = 1;
    if (overflowPoint[0] > FIELD_WIDTH) {
      t = (FIELD_WIDTH - pos[0]) / speed[0];
    }

    if (overflowPoint[0] < 0) {
      t = -pos[0] / speed[0];
    }

    if (overflowPoint[1] > FIELD_HEIGHT) {
      t = (FIELD_HEIGHT - pos[1]) / speed[1];
    }

    if (overflowPoint[1] < 0) {
      t = -pos[1] / speed[1];
    }

    return [pos[0] + speed[0] * t, pos[1] + speed[1] * t];
  };

  const sync = () => {
    ball.x = contractBall.x;
    ball.y = contractBall.y;
    ball.dx = contractBall.dx;
    ball.dy = contractBall.dy;

    cart.x = contractCart.x;
  };

  //  #TODO: refactor
  const pushTick = (action: number, momentum: number) => {
    action = Math.min(action, DEFAULT_PLATFORM_SPEED);
    action = Math.max(action, -DEFAULT_PLATFORM_SPEED);
    ticksCache.push({ action, momentum });
    if (!debugModeRef.current) {
      // Is not in debug mode - just process tick
      gameContext.processTick(
        //@ts-ignore
        new Tick({
          action: Int64.from(action),
          momentum: Int64.from(momentum),
        }),
      );
      let [x, y] = [
        gameContext.ball.position.x * 1,
        gameContext.ball.position.y * 1,
      ];
      contractBall.x = x;
      contractBall.y = y;
      contractBall.dx = gameContext.ball.speed.x * 1;
      contractBall.dy = gameContext.ball.speed.y * 1;
      contractBallTrace = [];
    } else {
      let prevPos: [number, number] =
        contractBallTrace.length > 0
          ? contractBallTrace[contractBallTrace.length - 1]
          : [gameContext.ball.position.x * 1, gameContext.ball.position.y * 1];

      let prevSpeed: [number, number] = [
        gameContext.ball.speed.x * 1,
        gameContext.ball.speed.y * 1,
      ];
      gameContext.processTick(
        //@ts-ignore
        new Tick({
          action: Int64.from(action),
          momentum: Int64.from(momentum),
        }),
      );
      let [x, y] = [
        gameContext.ball.position.x * 1,
        gameContext.ball.position.y * 1,
      ];
      contractBall.x = x;
      contractBall.y = y;
      contractBall.dx = gameContext.ball.speed.x * 1;
      contractBall.dy = gameContext.ball.speed.y * 1;

      let newSpeed = [
        gameContext.ball.speed.x * 1,
        gameContext.ball.speed.y * 1,
      ];

      // Should add additional point to points, because collision point is ommited
      // #TODO: Change calculation for brick collision. For now works only with border collisions, but works bad for brick collision.
      if (prevSpeed[0] == -newSpeed[0] || prevSpeed[1] == -newSpeed[1]) {
        contractBallTrace.push(getCollisionPoint(prevPos, prevSpeed));
      }

      contractBallTrace.push([x, y]);

      contractBricks = gameContext.bricks.bricks
        .map((brick: IContractBrick) => {
          let x = brick.pos.x * 1;
          let y = brick.pos.y * 1;
          return {
            x,
            y,
            w: 2 * BRICK_HALF_WIDTH,
            h: 2 * BRICK_HALF_WIDTH,
            value: +brick.value.toString(),
          } as IContractBrickPorted;
        })
        .filter((brick: IContractBrickPorted) => brick.value > 1);

      contractCart = {
        ...cart,
        x: gameContext.platform.position * 1,
      };
    }

    props.setTicksAmount(ticksCache.length);
    props.setScore(gameContext.score * 1);
    if (!gameContext.winable.toBoolean()) {
      setWinable(false);
    }

    sync();
  };

  return (
    <canvas
      id="canvas"
      width={`${FIELD_WIDTH}`}
      height={`${FIELD_HEIGHT + 10}`}
      ref={canvas}
      className={winable ? 'border border-black' : 'border border-red-500'}
    ></canvas>
  );
};
