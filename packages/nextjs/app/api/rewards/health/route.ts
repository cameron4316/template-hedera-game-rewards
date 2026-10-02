import { NextResponse } from "next/server";
import { rewardsConfig } from "../_config";
import type { HealthResponse } from "~~/lib/rewards/api";
import { GAMES } from "~~/lib/rewards/games";
import { registrationProblems } from "~~/lib/rewards/registration";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = rewardsConfig();
  if (!result.ok) {
    return NextResponse.json<HealthResponse>({
      configured: false,
      problems: result.missing.map(item => `Missing ${item}`),
      next: "yarn setup, then yarn deploy",
    });
  }
  const { config } = result;
  const problems = await registrationProblems(config, GAMES).catch(error => [
    `Could not read the vault over JSON-RPC (${error instanceof Error ? error.message : error}). Run yarn doctor.`,
  ]);
  if (problems.length > 0)
    return NextResponse.json<HealthResponse>({ configured: false, problems, next: "yarn deploy" });

  const { network, vault, topicId, tokenId, routerId } = config;
  return NextResponse.json<HealthResponse>({
    configured: true,
    network,
    vault,
    topicId,
    tokenId,
    routerId,
    games: GAMES.map(game => game.id),
  });
}
