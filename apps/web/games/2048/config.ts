import { createZkNoidGameConfig } from '@/lib/createConfig';
import { ZkNoidGameType } from '@/lib/platform/game_types';
import { Game2048 } from 'zknoid-chain-dev';
import Game2048Page from './Game2048Page';
import { ZkNoidGameFeature, ZkNoidGameGenre } from '@/lib/platform/game_tags';
import RandzuLobby from '@/games/randzu/components/RandzuLobby';
import { LogoMode } from '@/app/constants/games';

export const game2048Config = createZkNoidGameConfig({
  id: '2048',
  type: ZkNoidGameType.SinglePlayer,
  name: '2048 game',
  description:
    'The 2048 game is a simple and addictive puzzle game where players slide numbered tiles on a 4x4 grid to combine them and create a tile with the number 2048.',
  image: '/image/games/2048.svg',
  logoMode: LogoMode.CENTER,
  genre: ZkNoidGameGenre.BoardGames,
  features: [ZkNoidGameFeature.SinglePlayer],
  isReleased: true,
  releaseDate: new Date(2024, 0, 1),
  popularity: 50,
  author: 'Chomtana',
  rules:
    'Players merge tiles of the same value, doubling their numbers, and aim to reach the goal while managing space and avoiding a full grid.',
  runtimeModules: {
    Game2048,
  },
  page: Game2048Page,
});
