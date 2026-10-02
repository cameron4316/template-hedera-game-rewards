import type { Hex } from "./claim";

const ENTITY_ID = /^0\.0\.(\d+)$/;

/** `0.0.N` → its long-zero EVM address (HTS tokens and contracts created by ID). */
export function entityIdToAddress(id: string): Hex {
  const num = id.match(ENTITY_ID)?.[1];
  if (!num) throw new Error(`"${id}" is not a Hedera entity ID. Use the 0.0.N form.`);
  return `0x${BigInt(num).toString(16).padStart(40, "0")}`;
}

/** Long-zero EVM address → `0.0.N`. Only valid for addresses created from an entity number, like HTS tokens. */
export const longZeroAddressToEntityId = (address: string) => `0.0.${BigInt(address)}`;

/** SDK transaction ID (`0.0.1@1700000000.000000001`) → mirror node form (`0.0.1-1700000000-000000001`). */
export const toMirrorTransactionId = (transactionId: string) =>
  transactionId.replace("@", "-").replace(/\.(?=\d+$)/, "-");

/** Raw 32-byte hex for an ECDSA key given as hex (with or without 0x) or DER hex. */
export const toRawEcdsaKey = (key: string): Hex => `0x${key.replace(/^0x/, "").slice(-64)}`;
