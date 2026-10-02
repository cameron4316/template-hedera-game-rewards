import { NextResponse } from "next/server";
import { rewardsConfig } from "../_config";
import type { AttestResponse } from "~~/lib/rewards/api";
import { AttestError, AttestRequest, attest } from "~~/lib/rewards/attest";
import { serializeClaim } from "~~/lib/rewards/claim";
import { findGame } from "~~/lib/rewards/games";
import { publishScore } from "~~/lib/rewards/hcs";
import { registrationProblems } from "~~/lib/rewards/registration";

export const runtime = "nodejs";

/** POST { gameId, player, result } → { claim, signature, hcs }. The player's wallet then sends claim() to the vault. */
export async function POST(request: Request) {
  const result = rewardsConfig();
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Rewards are not configured. Missing: ${result.missing.join(", ")}. Run yarn setup, then yarn deploy.`,
        missing: result.missing,
      },
      { status: 503 },
    );
  }
  const { config } = result;

  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Send a JSON body: { gameId, player, result }." }, { status: 400 });
  }

  try {
    const request = body as AttestRequest;
    const game = typeof request.gameId === "string" ? findGame(request.gameId) : undefined;
    const [problem] = game ? await registrationProblems(config, [game]) : [];
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });

    const { claim, signature, hcs } = await attest(request, {
      config,
      publishScore: message => publishScore(config.operator, config.topicId, message),
    });
    return NextResponse.json<AttestResponse>({ claim: serializeClaim(claim), signature, hcs });
  } catch (error) {
    if (error instanceof AttestError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[api/rewards/attest]", error);
    return NextResponse.json(
      { error: "Could not sign or log the claim. Check the server log, then run yarn doctor." },
      { status: 502 },
    );
  }
}
