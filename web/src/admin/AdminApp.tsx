import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { Skeleton, Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { initData, isTelegram } from "../lib/telegram";
import { adminApi, setAdminUnauthorized, setCsrf } from "./api";
import { Field, Input, Notice, ROLE_UZ } from "./components/kit";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Users = lazy(() => import("./pages/Users"));
const Cases = lazy(() => import("./pages/Cases"));
const Skins = lazy(() => import("./pages/Skins"));
const InventoryPage = lazy(() => import("./pages/Inventory"));
const Openings = lazy(() => import("./pages/Openings"));
const Missions = lazy(() => import("./pages/Missions"));
const Rewards = lazy(() => import("./pages/Rewards"));
const PromoCodes = lazy(() => import("./pages/PromoCodes"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Logs = lazy(() => import("./pages/Logs"));

export interface AdminMe {
  id: number;
  username: string;
  role: "owner" | "admin" | "viewer";
}

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/admin", label: "Boshqaruv paneli", icon: "dashboard" },
  { to: "/admin/users", label: "Foydalanuvchilar", icon: "users" },
  { to: "/admin/cases", label: "Keyslar", icon: "cases" },
  { to: "/admin/skins", label: "Skinlar", icon: "skins" },
  { to: "/admin/inventory", label: "Inventar", icon: "inventory" },
  { to: "/admin/openings", label: "Ochilishlar", icon: "history" },
  { to: "/admin/missions", label: "Vazifalar", icon: "missions" },
  { to: "/admin/rewards", label: "Mukofotlar", icon: "gift" },
  { to: "/admin/promo", label: "Promokodlar", icon: "sparkle" },
  { to: "/admin/settings", label: "Sozlamalar", icon: "settings" },
  { to: "/admin/logs", label: "Loglar", icon: "list" },
];

function Login({ onDone }: { onDone: (me: AdminMe) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tgId, setTgId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const triedTg = useRef(false);

  // Inside the admin bot's Mini App: sign in with signed Telegram initData.
  useEffect(() => {
    if (triedTg.current || !isTelegram()) return;
    triedTg.current = true;
    setBusy(true);
    adminApi
      .post<{ admin: AdminMe; csrfToken: string }>("/login/telegram", { initData: initData() })
      .then((r) => {
        setCsrf(r.csrfToken);
        onDone(r.admin);
      })
      .catch((e: ApiError) => {
        setError(e.message);
        const id = (e.details as { telegramId?: number } | undefined)?.telegramId;
        if (id) setTgId(id);
      })
      .finally(() => setBusy(false));
  }, [onDone]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi.post<{ admin: AdminMe; csrfToken: string }>("/login", { username, password });
      setCsrf(r.csrfToken);
      onDone(r.admin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kirishda xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative w-full max-w-sm p-6" aria-label="Admin kirishi">
        <div className="mb-6 flex items-center gap-3">
          <img src="/assets/icons/app.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="font-display text-lg font-bold">SkinFlow Admin</h1>
            <p className="text-xs text-muted">Yopiq hudud</p>
          </div>
        </div>
        {error && (
          <div className="mb-4">
            <Notice tone="error">
              {error}
              {tgId && (
                <span className="mt-1 block text-xs text-fg/80">
                  Telegram ID'ingiz: <b className="select-all">{tgId}</b> — uni qo'shing: <code>ADMIN_TELEGRAM_IDS</code>.
                </span>
              )}
            </Notice>
          </div>
        )}
        {isTelegram() && busy ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <Spinner /> Telegram orqali kirilmoqda…
          </div>
        ) : (
          <div className="space-y-3.5">
            <Field label="Login yoki email">
              <Input autoComplete="login" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={120} autoFocus />
            </Field>
            <Field label="Parol">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={200} />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy ? <Spinner /> : "Kirish"}
            </button>
          </div>
        )}
      </motion.form>
    </div>
  );
}

function Sidebar({ collapsed, onCollapse, onNavigate, me, onLogout }: { collapsed: boolean; onCollapse?: () => void; onNavigate?: () => void; me: AdminMe; onLogout: () => void }) {
  const { pathname } = useLocation();
  const active = NAV.slice().reverse().find((n) => (n.to === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(n.to)))?.to;
  return (
    <div className="flex h-full flex-col">
      <div className={clsx("flex h-16 items-center gap-3 px-4", collapsed && "justify-center px-0")}>
        <img src="/assets/icons/app.svg" alt="" className="h-8 w-8 shrink-0" />
        {!collapsed && <span className="font-display text-[15px] font-bold">SkinFlow Admin</span>}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2" aria-label="Admin">
        {NAV.map((n) => {
          const isActive = active === n.to;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/admin"}
              onClick={onNavigate}
              title={collapsed ? n.label : undefined}
              className={clsx("relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", isActive ? "text-fg" : "text-muted hover:bg-white/[0.03] hover:text-fg", collapsed && "justify-center px-0")}
            >
              {isActive && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl bg-accent/12 ring-1 ring-accent/25" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              {isActive && <motion.span layoutId="admin-nav-bar" className="absolute left-0 top-2.5 h-6 w-[3px] rounded-r-full bg-accent" />}
              <Icon name={n.icon} size={19} className={clsx("relative", isActive && "text-accent")} />
              {!collapsed && <span className="relative">{n.label}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t hairline p-2.5">
        {!collapsed && (
          <div className="mb-1 px-3 py-2 text-xs">
            <p className="truncate font-semibold">{me.username}</p>
            <p className="text-muted">{ROLE_UZ[me.role] ?? me.role}</p>
          </div>
        )}
        <div className={clsx("flex gap-1", collapsed && "flex-col items-center")}>
          <button type="button" onClick={onLogout} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm text-muted hover:bg-white/[0.03] hover:text-fg" title="Chiqish">
            <Icon name="logout" size={18} />
            {!collapsed && "Chiqish"}
          </button>
          {onCollapse && (
            <button type="button" onClick={onCollapse} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-white/[0.03] hover:text-fg" aria-label={collapsed ? "Menyuni yoyish" : "Menyuni yig'ish"}>
              <Icon name="collapse" size={18} className={clsx("transition-transform", collapsed && "rotate-180")} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Shell({ me, onLogout }: { me: AdminMe; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sf-admin-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sf-admin-collapsed", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <div className="min-h-screen bg-bg">
      <motion.aside
        className="fixed inset-y-0 left-0 z-30 hidden border-r hairline bg-surface lg:block"
        animate={{ width: collapsed ? 76 : 248 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
      >
        <Sidebar collapsed={collapsed} onCollapse={toggle} me={me} onLogout={onLogout} />
      </motion.aside>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[264px] border-r hairline bg-surface safe-top" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", stiffness: 420, damping: 40 }}>
              <Sidebar collapsed={false} onNavigate={() => setDrawer(false)} me={me} onLogout={onLogout} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className={clsx("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
        <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-b hairline px-4 lg:hidden safe-top">
          <button type="button" onClick={() => setDrawer(true)} className="-ml-2 grid h-11 w-11 place-items-center rounded-xl text-muted" aria-label="Menyuni ochish">
            <Icon name="menu" size={22} />
          </button>
          <span className="font-display font-semibold">SkinFlow Admin</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            }
          >
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="cases" element={<Cases me={me} />} />
              <Route path="skins" element={<Skins me={me} />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="openings" element={<Openings />} />
              <Route path="missions" element={<Missions me={me} />} />
              <Route path="rewards" element={<Rewards />} />
              <Route path="promo" element={<PromoCodes me={me} />} />
              <Route path="settings" element={<SettingsPage me={me} />} />
              <Route path="logs" element={<Logs />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function AdminRoot() {
  const qc = useQueryClient();
  const [me, setMe] = useState<AdminMe | null>(null);
  const session = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      try {
        const r = await adminApi.get<{ admin: AdminMe; csrfToken: string }>("/me");
        setCsrf(r.csrfToken);
        return r.admin;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    document.title = "SkinFlow Admin";
    try {
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();
    } catch {
      /* not in Telegram */
    }
    setAdminUnauthorized(() => {
      setMe(null);
      qc.setQueryData(["admin", "me"], null);
    });
    return () => setAdminUnauthorized(null);
  }, [qc]);

  useEffect(() => {
    if (session.data !== undefined) setMe(session.data);
  }, [session.data]);

  if (session.isLoading) return <div className="grid min-h-screen place-items-center"><Spinner className="text-muted" /></div>;
  if (session.isError)
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <Notice tone="error">Serverga ulanib bo'lmadi. <button className="underline" onClick={() => void session.refetch()}>Qayta urinish</button></Notice>
      </div>
    );
  if (!me) return <Login onDone={(m) => setMe(m)} />;
  return (
    <Shell
      me={me}
      onLogout={async () => {
        await adminApi.post("/logout").catch(() => undefined);
        qc.clear();
        setMe(null);
      }}
    />
  );
}

const adminQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 } },
});

export default function AdminApp() {
  return (
    <QueryClientProvider client={adminQueryClient}>
      <AdminRoot />
    </QueryClientProvider>
  );
}
