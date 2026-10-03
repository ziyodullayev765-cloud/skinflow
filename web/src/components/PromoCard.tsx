import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import { useT } from "../lib/i18n";
import { useRedeemPromo } from "../lib/queries";
import { playSound } from "../lib/sound";
import { haptic } from "../lib/telegram";
import { useToasts } from "../store/ui";
import { Icon } from "./Icon";
import { Spinner } from "./ui";

export function PromoCard() {
  const t = useT();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const redeem = useRedeemPromo();
  const push = useToasts((s) => s.push);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 3) return;
    setError(null);
    redeem.mutate(c, {
      onSuccess: (r) => {
        haptic.notify("success");
        playSound("achievement");
        push(t("promo.done", { amount: r.reward }), "success");
        setCode("");
      },
      onError: (err) => {
        haptic.notify("error");
        setError(err instanceof ApiError ? err.message : "Error");
      },
    });
  };

  return (
    <form onSubmit={submit} className="card p-3.5" aria-label={t("promo.title")}>
      <div className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <Icon name="gift" size={18} className="text-accent" />
        {t("promo.title")}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1 uppercase tracking-wider"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32))}
          placeholder={t("promo.placeholder")}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("promo.placeholder")}
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={code.trim().length < 3 || redeem.isPending}>
          {redeem.isPending ? <Spinner /> : t("promo.redeem")}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </form>
  );
}
