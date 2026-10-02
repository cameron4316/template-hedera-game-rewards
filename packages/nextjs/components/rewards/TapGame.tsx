"use client";

import { useEffect, useRef, useState } from "react";
import { ROUND_MS } from "~~/lib/rewards/games/demo";

export type TapResult = { hits: number; durationMs: number };

const TARGET_PERCENT = 16;
const randomSpot = () => ({
  x: Math.random() * (100 - TARGET_PERCENT),
  y: Math.random() * (100 - TARGET_PERCENT),
});

/**
 * Tap-the-target demo game: hit the moving target as often as possible in 30 seconds.
 * Swap this component for your own game; the rewards flow only needs the result object.
 */
export const TapGame = ({ onFinish }: { onFinish: (result: TapResult) => void }) => {
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [hits, setHits] = useState(0);
  const [msLeft, setMsLeft] = useState(ROUND_MS);
  const [spot, setSpot] = useState({ x: 42, y: 42 });
  const startedAt = useRef(0);
  const hitsRef = useRef(0);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const elapsed = performance.now() - startedAt.current;
      if (elapsed < ROUND_MS) {
        setMsLeft(ROUND_MS - elapsed);
        return;
      }
      clearInterval(timer);
      setMsLeft(0);
      setPhase("done");
      onFinish({ hits: hitsRef.current, durationMs: Math.round(elapsed) });
    }, 100);
    return () => clearInterval(timer);
  }, [phase, onFinish]);

  const start = () => {
    hitsRef.current = 0;
    setHits(0);
    setMsLeft(ROUND_MS);
    setSpot(randomSpot());
    startedAt.current = performance.now();
    setPhase("playing");
  };

  const hit = () => {
    hitsRef.current += 1;
    setHits(hitsRef.current);
    setSpot(randomSpot());
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex justify-between text-sm font-medium">
        <span>
          Hits: <span className="font-bold tabular-nums">{hits}</span>
        </span>
        <span>
          Time: <span className="font-bold tabular-nums">{(msLeft / 1000).toFixed(1)}s</span>
        </span>
      </div>
      <progress className="progress progress-primary w-full" value={ROUND_MS - msLeft} max={ROUND_MS} />
      <div className="relative w-full aspect-square rounded-2xl bg-base-200 overflow-hidden select-none touch-manipulation">
        {phase === "playing" ? (
          <button
            type="button"
            aria-label="Target"
            onPointerDown={hit}
            className="absolute rounded-full bg-primary shadow-lg ring-4 ring-primary/30 active:scale-90 transition-transform"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${TARGET_PERCENT}%`,
              height: `${TARGET_PERCENT}%`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            {phase === "done" && <p className="text-2xl font-bold m-0">{hits} hits!</p>}
            <p className="m-0 text-base-content/70">Tap the target as many times as you can in 30 seconds.</p>
            <button type="button" className="btn btn-primary" onClick={start}>
              {phase === "done" ? "Play again" : "Start round"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
