import { Icon } from "../components/Icon";
import { Page, TopBar } from "../components/TopBar";
import { Toggle } from "../components/ui";
import { useTelegramBack } from "../lib/hooks";
import { LANGUAGES, useT } from "../lib/i18n";
import { useSetLanguage } from "../lib/queries";
import { haptic } from "../lib/telegram";
import { useSettings } from "../store/settings";
import { useSession } from "../store/session";
import { isTelegram } from "../lib/telegram";

export default function Settings() {
  const t = useT();
  const s = useSettings();
  const setLang = useSetLanguage();
  const logout = useSession((x) => x.logout);
  useTelegramBack();

  return (
    <>
      <TopBar back title={t("settings.title")} />
      <Page className="space-y-6">
        <section>
          <p className="label mb-2 px-1">{t("settings.language")}</p>
          <div className="card grid grid-cols-3 gap-1.5 p-1.5" role="radiogroup" aria-label={t("settings.language")}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={s.language === l.code}
                onClick={() => {
                  haptic.select();
                  s.set({ language: l.code, languageChosen: true });
                  setLang.mutate(l.code);
                }}
                className={`min-h-[44px] rounded-xl text-sm font-medium transition-colors ${s.language === l.code ? "bg-accent/15 text-fg ring-1 ring-accent/40" : "text-muted hover:text-fg"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card divide-y divide-white/[0.06]">
          <Toggle icon="sound" label={t("settings.sound")} checked={s.sound} onChange={(v) => s.set({ sound: v })} />
          <Toggle icon="sparkle" label={t("settings.animation")} checked={s.animations} onChange={(v) => s.set({ animations: v })} />
          <Toggle icon="vibrate" label={t("settings.haptics")} checked={s.haptics} onChange={(v) => s.set({ haptics: v })} />
          <Toggle icon="moon" label={t("settings.dark")} checked={s.darkTheme} onChange={(v) => s.set({ darkTheme: v })} />
          <Toggle icon="motion" label={t("settings.reducedMotion")} checked={s.reducedMotion} onChange={(v) => s.set({ reducedMotion: v })} />
        </section>

        <section className="card flex gap-3 p-4">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-muted">{t("settings.about")}</p>
        </section>

        {!isTelegram() && (
          <button type="button" onClick={logout} className="btn btn-ghost w-full text-sm">
            <Icon name="logout" size={18} />
            Sign out
          </button>
        )}
        <p className="text-center text-[11px] text-muted/70">SkinFlow v1.0.0</p>
      </Page>
    </>
  );
}
