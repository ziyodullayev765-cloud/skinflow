import clsx from "clsx";
import { ApiError, type ApiErrorCode } from "../lib/api";
import { useT, type I18nKey } from "../lib/i18n";
import { Icon, type IconName } from "./Icon";
import { Button } from "./ui";

const ICONS: Partial<Record<ApiErrorCode, IconName>> = {
  NETWORK: "wifiOff",
  INSUFFICIENT_COINS: "coin",
  RATE_LIMITED: "bolt",
  COOLDOWN: "bolt",
  INVALID_SESSION: "lock",
  UNAUTHORIZED: "lock",
  MAINTENANCE: "settings",
  CASE_UNAVAILABLE: "cases",
  BLOCKED: "lock",
};

const KNOWN = new Set<ApiErrorCode>([
  "NETWORK", "SERVER", "UNAUTHORIZED", "INVALID_SESSION", "INSUFFICIENT_COINS", "RATE_LIMITED", "COOLDOWN", "CASE_UNAVAILABLE", "MAINTENANCE", "NOT_FOUND", "BLOCKED",
]);

export function errorCode(err: unknown): ApiErrorCode {
  return err instanceof ApiError && KNOWN.has(err.code) ? err.code : "SERVER";
}

export function useErrorText() {
  const t = useT();
  return (err: unknown) => {
    const code = errorCode(err);
    return { title: t(`err.${code}.title` as I18nKey), body: t(`err.${code}.body` as I18nKey) };
  };
}

interface Props {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}

export function ErrorState({ error, onRetry, title, className, compact }: Props) {
  const t = useT();
  const text = useErrorText()(error);
  const code = errorCode(error);
  return (
    <div role="alert" className={clsx("flex flex-col items-center text-center", compact ? "px-4 py-6" : "px-6 py-14", className)}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger ring-1 ring-danger/20">
        <Icon name={ICONS[code] ?? "alert"} size={26} />
      </div>
      <p className="font-display text-base font-semibold">{title ?? text.title}</p>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{text.body}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <Icon name="refresh" size={18} />
          {t("err.retry")}
        </Button>
      )}
    </div>
  );
}
