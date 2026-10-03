import { MotionConfig } from "framer-motion";
import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { ErrorState } from "./components/ErrorState";
import { Icon } from "./components/Icon";
import { PageSkeleton } from "./components/PageSkeleton";
import { Toasts } from "./components/Toasts";
import { Button } from "./components/ui";
import { useT } from "./lib/i18n";
import { useMe, useMissions } from "./lib/queries";
import { setHapticsEnabled, setTelegramColors } from "./lib/telegram";
import { useSession } from "./store/session";
import { useSettings, useReducedMotion } from "./store/settings";
import Home from "./pages/Home";

const Cases = lazy(() => import("./pages/Cases"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const Inventory = lazy(() => import("./pages/Inventory"));
const SkinDetail = lazy(() => import("./pages/SkinDetail"));
const Collections = lazy(() => import("./pages/Collections"));
const Missions = lazy(() => import("./pages/Missions"));
const Profile = lazy(() => import("./pages/Profile"));
const History = lazy(() => import("./pages/History"));
const Settings = lazy(() => import("./pages/Settings"));

function useApplyPreferences() {
  const { darkTheme, haptics, language, set, languageChosen } = useSettings();
  const reduced = useReducedMotion();
  const me = useMe();
  useEffect(() => {
    const theme = darkTheme ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", darkTheme ? "#0b0c0f" : "#f2f3f7");
    setTelegramColors(theme);
  }, [darkTheme]);
  useEffect(() => setHapticsEnabled(haptics), [haptics]);
  const intensity = useSession((x) => x.config?.animationIntensity);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduced);
    document.documentElement.classList.toggle("anim-low", intensity === "low");
  }, [reduced, intensity]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  // First launch: adopt the Telegram account's language once.
  useEffect(() => {
    if (!languageChosen && me.data?.language) set({ language: me.data.language, languageChosen: true });
  }, [languageChosen, me.data?.language, set]);
}

function Shell() {
  useApplyPreferences();
  const reduced = useReducedMotion();
  const location = useLocation();
  const missions = useMissions();
  const claimable = missions.data?.filter((m) => m.completed && !m.claimed).length ?? 0;
  const hideNav = /^\/cases\/\d+/.test(location.pathname);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
      <div className="relative mx-auto min-h-screen w-full overflow-x-hidden" style={{ paddingBottom: hideNav ? 0 : "calc(76px + env(safe-area-inset-bottom))" }}>
        <Suspense fallback={<PageSkeleton variant={location.pathname.startsWith("/inventory") ? "grid" : location.pathname === "/" ? "home" : "list"} />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/:skinId" element={<SkinDetail />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/missions" element={<Missions />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/history" element={<History />} />
            <Route path="/profile/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </div>
      {!hideNav && <BottomNav badge={claimable} />}
      <Toasts />
    </MotionConfig>
  );
}

function Gate() {
  const t = useT();
  const { status, error, bootstrap, loginAsGuest, config } = useSession();

  useEffect(() => {
    if (status === "idle") void bootstrap();
  }, [status, bootstrap]);

  if (status === "idle" || status === "loading") return <PageSkeleton />;
  if (status === "error") {
    return (
      <div className="grid min-h-screen place-items-center">
        <ErrorState error={error} onRetry={() => void bootstrap()} />
      </div>
    );
  }
  if (status === "needs-telegram") {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden px-6">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative w-full max-w-sm text-center">
          <img src="/assets/icons/app.svg" alt="" className="mx-auto mb-6 h-16 w-16" />
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("auth.welcome")}</h1>
          <p className="mt-2 text-sm text-muted">{t("auth.body")}</p>
          <div className="mt-8 flex flex-col gap-3">
            {config?.botUsername && (
              <a className="btn btn-primary" href={`https://t.me/${config.botUsername}`} target="_blank" rel="noopener noreferrer">
                <Icon name="telegram" size={18} />
                {t("auth.openInTelegram")}
              </a>
            )}
            {config?.guestLogin && (
              <Button variant={config?.botUsername ? "secondary" : "primary"} onClick={() => void loginAsGuest()}>
                <Icon name="sparkle" size={18} />
                {t("auth.continueGuest")}
              </Button>
            )}
          </div>
          <p className="mt-8 text-xs leading-relaxed text-muted/80">{t("settings.about")}</p>
        </div>
      </div>
    );
  }
  return <Shell />;
}

export function UserApp() {
  return <Gate />;
}
