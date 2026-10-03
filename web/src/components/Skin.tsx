import clsx from "clsx";
import { motion } from "framer-motion";
import { memo, useRef, useState, type MouseEvent } from "react";
import { useT } from "../lib/i18n";
import { fmt } from "../lib/format";
import type { Rarity, Skin } from "../lib/types";
import { useReducedMotion } from "../store/settings";
import { Icon } from "./Icon";
import { CoinIcon } from "./ui";

export const SkinImage = memo(function SkinImage({ src, alt, className, eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={clsx(!className?.includes("absolute") && "relative", className)}>
      {!loaded && <div className="absolute inset-[18%] animate-pulse rounded-lg bg-white/[0.04]" aria-hidden />}
      <img
        src={failed ? "/assets/skins/placeholder.svg" : src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        className={clsx("h-full w-full object-contain transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
});

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  const t = useT();
  return (
    <span className={clsx(`rarity-${rarity}`, "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", className)} style={{ color: `rgb(var(--rc))`, background: "rgb(var(--rc) / 0.12)" }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "rgb(var(--rc))" }} />
      {t(`rarity.${rarity}`)}
    </span>
  );
}

interface CardProps {
  skin: Skin;
  quantity?: number;
  favorite?: boolean;
  locked?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

/** Inventory card. Tilt only on fine pointers (desktop); tap scale on touch. */
export const SkinCard = memo(function SkinCard({ skin, quantity, favorite, locked, onClick, compact }: CardProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const fine = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

  const onMove = (e: MouseEvent) => {
    if (!fine || reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -8, y: ((e.clientX - r.left) / r.width - 0.5) * 8 });
  };

  const high = skin.rarity === "rare" || skin.rarity === "epic" || skin.rarity === "legendary";

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      style={{ transform: fine ? `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` : undefined }}
      className={clsx(
        `rarity-${skin.rarity}`,
        "card group relative flex w-full flex-col overflow-hidden text-left transition-[box-shadow,border-color] duration-200 hover:border-white/15",
        skin.rarity === "rare" && !locked && "rarity-border-anim",
        locked && "opacity-55",
      )}
      aria-label={`${skin.weaponName} | ${skin.name}`}
    >
      <div className="rarity-glow absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
      {high && !locked && <div className="shine-sweep" />}
      <div className={clsx("relative", compact ? "aspect-[16/10]" : "aspect-[4/3]")}>
        <SkinImage src={skin.thumbnail || skin.image} alt="" className="absolute inset-[8%]" />
        {locked && (
          <div className="absolute inset-0 grid place-items-center">
            <Icon name="lock" size={22} className="text-muted" />
          </div>
        )}
        {quantity !== undefined && quantity > 1 && (
          <span className="absolute right-2 top-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white/90 backdrop-blur-sm">×{quantity}</span>
        )}
        {favorite && (
          <span className="absolute left-2 top-2 text-[#ff7fa8]">
            <Icon name="heart" size={15} filled />
          </span>
        )}
      </div>
      <div className="rarity-bar h-px w-full opacity-80" />
      <div className={clsx("relative flex flex-col gap-0.5", compact ? "px-2.5 py-2" : "px-3 py-2.5")}>
        <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted">{skin.weaponName}</span>
        <span className={clsx("truncate font-display font-semibold", compact ? "text-[13px]" : "text-sm")}>{skin.name}</span>
        {!compact && (
          <span className="mt-1 flex items-center justify-between text-xs">
            <span className="font-medium" style={{ color: "rgb(var(--rc))" }}>
              {/* rarity label kept short on cards */}
              <RarityDot rarity={skin.rarity} />
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums text-muted">
              <CoinIcon size={12} />
              {fmt(skin.virtualPrice)}
            </span>
          </span>
        )}
      </div>
    </motion.button>
  );
});

function RarityDot({ rarity }: { rarity: Rarity }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "rgb(var(--rc))" }} />
      {t(`rarity.${rarity}`)}
    </span>
  );
}
