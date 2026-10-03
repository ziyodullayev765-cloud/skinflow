import clsx from "clsx";
import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { fmt } from "../lib/format";
import { useTelegramBack } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { useMe, useOpenCase } from "../lib/queries";
import { playSound } from "../lib/sound";
import { haptic } from "../lib/telegram";
import type { GameCase, OpenResult, Rarity } from "../lib/types";
import { useReducedMotion } from "../store/settings";
import { Icon } from "./Icon";
import { RarityBadge, SkinImage } from "./Skin";
import { Button, CoinIcon } from "./ui";

type Phase = "charging" | "opening" | "spinning" | "result";

const ITEM_W = 120; // includes gap
const CARD_W = 112;

interface Props {
  kase: GameCase;
  onClose: () => void;
  onError: (e: ApiError) => void;
}

/**
 * Presentation only. The result, the reel contents and the new balance all
 * come from POST /api/cases/:id/open — the client never picks an item.
 */
export function CaseOpening({ kase, onClose, onError }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const me = useMe();
  const open = useOpenCase();
  const [phase, setPhase] = useState<Phase>("charging");
  const [result, setResult] = useState<OpenResult | null>(null);
  const [round, setRound] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const lastIdx = useRef(0);
  const skipRef = useRef<(() => void) | null>(null);

  useTelegramBack(() => {
    if (phase === "result") onClose();
  });

  const run = useCallback(async () => {
    setPhase("charging");
    setResult(null);
    x.set(0);
    lastIdx.current = 0;
    haptic.impact("medium");
    playSound("open");

    const minDelay = new Promise((r) => setTimeout(r, reduced ? 150 : 650));
    let res: OpenResult;
    try {
      [res] = await Promise.all([open.mutateAsync(kase.id), minDelay]);
    } catch (e) {
      haptic.notify("error");
      onError(e instanceof ApiError ? e : new ApiError("SERVER", String(e)));
      return;
    }
    setResult(res);
    if (reduced) {
      setPhase("result");
      return;
    }
    setPhase("opening");
    await new Promise((r) => setTimeout(r, 450));
    setPhase("spinning");
  }, [kase.id, open, onError, reduced, x]);

  // Guard so each round sends exactly one open request (StrictMode re-runs effects in dev).
  const startedRound = useRef(-1);
  useEffect(() => {
    if (startedRound.current === round) return;
    startedRound.current = round;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Spin the reel once it has rendered.
  useLayoutEffect(() => {
    if (phase !== "spinning" || !result || !track) return;
    const viewport = track.parentElement!.clientWidth;
    // Cosmetic stop offset inside the winning card (result is already fixed).
    const jitter = (Math.random() - 0.5) * (CARD_W * 0.6);
    const target = -(result.winIndex * ITEM_W + CARD_W / 2 - viewport / 2 + jitter);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setPhase("result");
    };
    const controls = animate(x, target, { duration: 5.6, ease: [0.06, 0.72, 0.12, 1], onComplete: finish });
    skipRef.current = () => {
      controls.stop();
      x.set(-(result.winIndex * ITEM_W + CARD_W / 2 - viewport / 2));
      finish();
    };
    return () => controls.stop();
  }, [phase, result, x, track]);

  // Tick sound + light haptic as each card passes the marker (throttled by index).
  useMotionValueEvent(x, "change", (v) => {
    if (phase !== "spinning" || !trackRef.current) return;
    const viewport = trackRef.current.parentElement!.clientWidth;
    const idx = Math.floor((-v + viewport / 2) / ITEM_W);
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      playSound("tick");
      haptic.select();
    }
  });

  useEffect(() => {
    if (phase !== "result" || !result) return;
    const rare = ["epic", "legendary"].includes(result.skin.rarity);
    haptic.notify(rare ? "success" : "success");
    if (rare) haptic.impact("heavy");
    playSound(result.skin.rarity === "legendary" || result.skin.rarity === "epic" ? "achievement" : "reveal");
  }, [phase, result]);

  const canAfford = (me.data?.coins ?? 0) >= kase.cost;

  return createPortal(
    <motion.div className="fixed inset-0 z-50 flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={kase.name}>
      <motion.div className="absolute inset-0 bg-[#050608]/95 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 40% at 50% 45%, ${kase.accent}22, transparent 70%)` }} />

      <div className="relative flex flex-1 flex-col items-center justify-center safe-top safe-bottom">
        <AnimatePresence mode="wait">
          {(phase === "charging" || phase === "opening") && (
            <motion.div key="case" className="flex flex-col items-center" exit={{ opacity: 0, scale: 1.2, transition: { duration: 0.25 } }}>
              <motion.img
                src={kase.image}
                alt=""
                className="w-48 drop-shadow-[0_30px_50px_rgba(0,0,0,0.7)]"
                initial={{ scale: 0.9 }}
                animate={
                  phase === "charging"
                    ? { scale: [1, 1.06, 1.04], rotate: [0, -1.5, 1.5, -1, 1, 0] }
                    : { scale: 1.12, y: -6, filter: "brightness(1.5)" }
                }
                transition={phase === "charging" ? { duration: 0.65, repeat: Infinity, repeatType: "mirror" } : { duration: 0.4 }}
              />
              <p className="mt-6 text-sm font-medium text-muted">{t("open.opening")}</p>
            </motion.div>
          )}

          {(phase === "spinning" || phase === "result") && result && (
            <motion.div key="reel" className="w-full" initial={{ opacity: 0, y: 16 }} animate={{ opacity: phase === "result" ? 0.25 : 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div className="relative mx-auto w-full max-w-3xl overflow-hidden py-3" style={{ maskImage: "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)" }}>
                <motion.div
                  ref={(el) => {
                    trackRef.current = el;
                    setTrack(el);
                  }}
                  className="flex gap-2 will-change-transform" style={{ x }}>
                  {result.reel.map((item, i) => (
                    <div key={i} className={clsx(`rarity-${item.rarity}`, "relative h-[132px] shrink-0 overflow-hidden rounded-2xl border hairline bg-surface")} style={{ width: CARD_W }}>
                      <div className="rarity-glow absolute inset-0" />
                      <SkinImage src={item.image} alt="" eager={Math.abs(i - result.winIndex) < 8} className="relative mx-auto mt-3 h-[68px] w-[92%]" />
                      <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: "rgb(var(--rc))" }} />
                      <p className="relative mt-2 truncate px-2 text-center text-[11px] font-semibold">{item.name}</p>
                      <p className="relative truncate px-2 text-center text-[10px] text-muted">{item.weaponName}</p>
                    </div>
                  ))}
                </motion.div>
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-white to-transparent shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
                <div className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-white" />
                <div className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[9px] border-x-transparent border-b-white" />
              </div>
              {phase === "spinning" && (
                <div className="mt-6 flex justify-center">
                  <button type="button" onClick={() => skipRef.current?.()} className="btn btn-ghost text-sm">
                    {t("open.skip")}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "result" && result && (
            <ResultCard
              key={result.openingId}
              result={result}
              canAgain={canAfford}
              cost={kase.cost}
              onDone={onClose}
              onAgain={() => setRound((r) => r + 1)}
              onView={() => {
                onClose();
                navigate(`/inventory/${result.skin.id}`);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body,
  );
}

function Burst({ rarity }: { rarity: Rarity }) {
  const n = rarity === "legendary" ? 18 : 12;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[38%]" aria-hidden>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2;
        const d = 110 + (i % 3) * 30;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: "rgb(var(--rc))", boxShadow: "0 0 8px rgb(var(--rc))" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
          />
        );
      })}
    </div>
  );
}

function ResultCard({ result, onDone, onAgain, onView, canAgain, cost }: { result: OpenResult; onDone: () => void; onAgain: () => void; onView: () => void; canAgain: boolean; cost: number }) {
  const t = useT();
  const { skin } = result;
  const r = skin.rarity;
  const premium = r === "legendary";

  return (
    <motion.div className={`rarity-${r} absolute inset-0 flex items-center justify-center px-5`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {premium && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[40%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 animate-spinSlow opacity-40"
          style={{ background: "repeating-conic-gradient(from 0deg, rgb(var(--rc) / 0.35) 0deg 8deg, transparent 8deg 24deg)", maskImage: "radial-gradient(circle, #000 20%, transparent 65%)" }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
      {(r === "epic" || r === "legendary") && <Burst rarity={r} />}

      <motion.div
        className={clsx("relative w-full max-w-sm overflow-hidden rounded-3xl border bg-surface p-5 text-center", r === "rare" && "rarity-border-anim")}
        style={{ borderColor: "rgb(var(--rc) / 0.35)", boxShadow: r === "common" ? undefined : "0 0 60px -12px rgb(var(--rc) / 0.55)" }}
        initial={premium ? { scale: 0.6, opacity: 0, rotateY: 90 } : { scale: 0.9, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0, y: 0 }}
        transition={premium ? { type: "spring", stiffness: 140, damping: 16, delay: 0.1 } : { type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className="rarity-glow pointer-events-none absolute inset-0" />
        {r !== "common" && <div className="shine-sweep" />}
        <div className="relative flex items-center justify-center gap-2">
          <RarityBadge rarity={r} />
          <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", result.isNew ? "bg-success/15 text-success" : "bg-white/5 text-muted")}>
            {result.isNew ? t("open.new") : t("open.duplicate", { count: result.quantity })}
          </span>
        </div>
        <motion.div className="relative mx-auto my-4 aspect-[16/10] w-full" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: premium ? 0.45 : 0.15, duration: 0.45 }}>
          <SkinImage src={skin.image} alt={`${skin.weaponName} ${skin.name}`} eager className="h-full w-full" />
        </motion.div>
        <p className="relative text-xs uppercase tracking-[0.14em] text-muted">{skin.weaponName}</p>
        <p className="relative mt-0.5 font-display text-2xl font-bold tracking-tight" style={{ color: r === "common" ? undefined : "rgb(var(--rc))" }}>
          {skin.name}
        </p>
        <p className="relative mt-2 flex items-center justify-center gap-1 text-sm text-muted">
          <CoinIcon size={13} /> {fmt(skin.virtualPrice)} · {skin.collection}
        </p>
        <p className="relative mt-3 flex items-center justify-center gap-1.5 text-xs text-success">
          <Icon name="check" size={14} /> {t("open.added")}
        </p>

        <div className="relative mt-5 grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={onView}>
            {t("open.view")}
          </Button>
          <Button onClick={onDone}>{t("open.done")}</Button>
        </div>
        <button type="button" disabled={!canAgain} onClick={onAgain} className="btn btn-ghost relative mt-1 w-full text-sm">
          <Icon name="refresh" size={16} />
          {t("open.again")} · <CoinIcon size={12} /> {fmt(cost)}
        </button>
      </motion.div>
    </motion.div>
  );
}
