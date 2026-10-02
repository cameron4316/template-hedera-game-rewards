import type { Hex, SerializedClaim } from "./claim";
import type { NetworkName } from "./constants";
import type { HcsReceipt } from "./hcs";

export type HealthResponse =
  | { configured: true; network: NetworkName; vault: Hex; topicId: string; tokenId: string; games: string[] }
  | { configured: false; problems: string[]; next: string };

export type AttestResponse = { claim: SerializedClaim; signature: Hex; hcs: HcsReceipt };

/** Plain-fetch client for POST /api/rewards/attest; any web game can call it. Throws the server's error message. */
export async function requestClaim(baseUrl: string, body: { gameId: string; player: string; result: unknown }) {
  const res = await fetch(`${baseUrl}/api/rewards/attest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Attestation failed with HTTP ${res.status}.`);
  return json as AttestResponse;
}
