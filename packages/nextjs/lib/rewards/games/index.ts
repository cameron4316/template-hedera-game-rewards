import { demoGame } from "./demo";
import type { GameDefinition } from "./types";

/** Every game the attestor signs for. Add yours here, then register it on-chain with `yarn deploy`. */
export const GAMES: GameDefinition[] = [demoGame];

export const findGame = (id: string) => GAMES.find(game => game.id === id);
