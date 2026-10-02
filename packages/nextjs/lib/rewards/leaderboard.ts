import type { NetworkName } from "./constants";
import type { ScoreMessage } from "./hcs";
import { mirrorGet } from "./mirror";

export type LeaderboardEntry = { player: string; bestScore: number; rounds: number; lastPlayed: string };

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Decodes one HCS score message (UTF-8 JSON). Returns null for anything that is not a v1 score line. */
export function parseScoreMessage(text: string): ScoreMessage | null {
  try {
    const m = JSON.parse(text) as Partial<ScoreMessage>;
    const valid =
      m.v === 1 &&
      typeof m.gameId === "string" &&
      typeof m.player === "string" &&
      HEX_ADDRESS.test(m.player) &&
      Number.isInteger(m.score) &&
      typeof m.amount === "string" &&
      typeof m.nonce === "string";
    return valid ? (m as ScoreMessage) : null;
  } catch {
    return null;
  }
}

/** Best score per player for one game, highest first. Input is consensus-ordered `{ text, timestamp }` pairs. */
export function rankScores(messages: { text: string; timestamp: string }[], gameId: string, limit = 10) {
  const byPlayer = new Map<string, LeaderboardEntry>();
  for (const { text, timestamp } of messages) {
    const score = parseScoreMessage(text);
    if (!score || score.gameId !== gameId) continue;
    const player = score.player.toLowerCase();
    const entry = byPlayer.get(player) ?? { player: score.player, bestScore: 0, rounds: 0, lastPlayed: timestamp };
    entry.bestScore = Math.max(entry.bestScore, score.score);
    entry.rounds += 1;
    if (timestamp > entry.lastPlayed) entry.lastPlayed = timestamp;
    byPlayer.set(player, entry);
  }
  return [...byPlayer.values()]
    .sort((a, b) => b.bestScore - a.bestScore || a.lastPlayed.localeCompare(b.lastPlayed))
    .slice(0, limit);
}

type MirrorTopicMessages = { messages: { message: string; consensus_timestamp: string }[] };

/** Reads the latest 100 messages of the score topic from the mirror node and ranks them. */
export async function fetchLeaderboard(network: NetworkName, topicId: string, gameId: string) {
  const { messages } = await mirrorGet<MirrorTopicMessages>(
    network,
    `/topics/${topicId}/messages?limit=100&order=desc`,
  );
  const decoder = new TextDecoder();
  return rankScores(
    messages.map(m => ({
      text: decoder.decode(Uint8Array.from(atob(m.message), c => c.charCodeAt(0))),
      timestamp: m.consensus_timestamp,
    })),
    gameId,
  );
}
