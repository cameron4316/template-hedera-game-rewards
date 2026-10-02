"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { ConfigStatus } from "~~/components/rewards/ConfigStatus";
import { Leaderboard } from "~~/components/rewards/Leaderboard";

const FLOW = [
  ["Play", "Finish a 30-second round. The game posts its result to the attestor API."],
  ["Attest", "The attestor validates the result, signs an EIP-712 claim and logs the score to an HCS topic."],
  ["Claim", "Your wallet sends the claim to RewardVault, which mints ARCADE through the HTS system contract."],
  ["Cash out", "Swap ARCADE for HBAR on SaucerSwap V1 whenever you like."],
] as const;

const Home: NextPage = () => (
  <div className="flex flex-col items-center grow">
    <div className="hedera-gradient dark:bg-none dark:bg-hedera-charcoal w-full px-4 py-12">
      <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-4">
        <h1 className="m-0 text-3xl sm:text-4xl font-bold text-white">Game Rewards on Hedera</h1>
        <p className="m-0 text-white/80">
          A drop-in rewards module: rounds are attested by a server, rewards are minted as HTS tokens by a vault
          contract, scores are logged to HCS, and players cash out on SaucerSwap.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/play" className="btn btn-primary">
            Play a round
          </Link>
          <Link href="/rewards" className="btn btn-outline bg-base-100/90">
            My rewards
          </Link>
        </div>
      </div>
    </div>

    <div className="w-full max-w-4xl mx-auto px-4 pt-8 pb-28 grid gap-6 md:grid-cols-2">
      <section className="card bg-base-100 shadow-md">
        <div className="card-body p-5 gap-3">
          <h2 className="card-title m-0">Status</h2>
          <ConfigStatus />
        </div>
      </section>

      <section className="card bg-base-100 shadow-md">
        <div className="card-body p-5 gap-3">
          <h2 className="card-title m-0">Leaderboard</h2>
          <Leaderboard />
        </div>
      </section>

      <section className="card bg-base-100 shadow-md md:col-span-2">
        <div className="card-body p-5 gap-3">
          <h2 className="card-title m-0">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-2 m-0 p-0 list-none">
            {FLOW.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="badge badge-primary shrink-0">{i + 1}</span>
                <span className="text-sm">
                  <span className="font-semibold">{title}.</span> {text}
                </span>
              </li>
            ))}
          </ol>
          <p className="m-0 text-xs text-base-content/60">
            Testnet by default. Free to play; rewards come only from completing rounds. Not financial or legal advice.
          </p>
        </div>
      </section>
    </div>
  </div>
);

export default Home;
