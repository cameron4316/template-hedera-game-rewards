import type { Hex } from "./claim";
import type { NetworkName } from "./constants";
import {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";

export type Operator = { network: NetworkName; accountId: string; privateKey: string };

/** One line of the score log. The topic's submit key is the operator key, so only the attestor can write. */
export type ScoreMessage = { v: 1; gameId: string; player: Hex; score: number; amount: string; nonce: Hex };

export type HcsReceipt = { topicId: string; sequenceNumber: number; transactionId: string };

async function withClient<T>(operator: Operator, run: (client: Client, key: PrivateKey) => Promise<T>) {
  const key = PrivateKey.fromStringECDSA(operator.privateKey);
  const client = Client.forName(operator.network).setOperator(AccountId.fromString(operator.accountId), key);
  try {
    return await run(client, key);
  } finally {
    client.close();
  }
}

export const createScoreTopic = (operator: Operator) =>
  withClient(operator, async (client, key) => {
    const receipt = await (
      await new TopicCreateTransaction()
        .setTopicMemo("game-rewards score log")
        .setAdminKey(key.publicKey)
        .setSubmitKey(key.publicKey)
        .execute(client)
    ).getReceipt(client);
    return receipt.topicId!.toString();
  });

export const publishScore = (operator: Operator, topicId: string, message: ScoreMessage) =>
  withClient(operator, async (client): Promise<HcsReceipt> => {
    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(message))
      .execute(client);
    const receipt = await response.getReceipt(client);
    return {
      topicId,
      sequenceNumber: receipt.topicSequenceNumber!.toNumber(),
      transactionId: response.transactionId.toString(),
    };
  });
