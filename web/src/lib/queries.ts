import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { CollectionInfo, GameCase, InventoryItem, Me, Mission, OpenResult, Opening, Profile } from "./types";

export const qk = {
  me: ["me"] as const,
  cases: ["cases"] as const,
  case: (id: number) => ["case", id] as const,
  inventory: ["inventory"] as const,
  item: (skinId: number) => ["inventory", skinId] as const,
  missions: ["missions"] as const,
  openings: ["openings"] as const,
  profile: ["profile"] as const,
  collections: ["collections"] as const,
};

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: ({ signal }) => api.get<{ user: Me }>("/api/me", signal).then((r) => r.user) });

export const useCases = () =>
  useQuery({
    queryKey: qk.cases,
    queryFn: ({ signal }) => api.get<{ cases: GameCase[]; casesEnabled: boolean }>("/api/cases", signal),
    staleTime: 60_000,
  });

export const useCase = (id: number) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.case(id),
    queryFn: ({ signal }) => api.get<{ case: GameCase }>(`/api/cases/${id}`, signal).then((r) => r.case),
    initialData: () => qc.getQueryData<{ cases: GameCase[] }>(qk.cases)?.cases.find((c) => c.id === id),
    staleTime: 60_000,
  });
};

export const useInventory = () =>
  useQuery({ queryKey: qk.inventory, queryFn: ({ signal }) => api.get<{ items: InventoryItem[] }>("/api/inventory", signal).then((r) => r.items) });

export const useInventoryItem = (skinId: number) => {
  const qc = useQueryClient();
  return useQuery<InventoryItem>({
    queryKey: qk.item(skinId),
    queryFn: ({ signal }) => api.get<{ item: InventoryItem }>(`/api/inventory/${skinId}`, signal).then((r) => r.item),
    placeholderData: () => qc.getQueryData<InventoryItem[]>(qk.inventory)?.find((i) => i.skin.id === skinId),
    staleTime: 0,
  });
};

export const useMissions = () =>
  useQuery({ queryKey: qk.missions, queryFn: ({ signal }) => api.get<{ missions: Mission[] }>("/api/missions", signal).then((r) => r.missions) });

export const useProfile = () => useQuery({ queryKey: qk.profile, queryFn: ({ signal }) => api.get<Profile>("/api/profile", signal) });

export const useCollections = () =>
  useQuery({
    queryKey: qk.collections,
    queryFn: ({ signal }) => api.get<{ collections: CollectionInfo[] }>("/api/collections", signal).then((r) => r.collections),
  });

export const useOpenings = (limit = 20) =>
  useInfiniteQuery({
    queryKey: [...qk.openings, limit],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.get<{ openings: Opening[]; nextCursor: number | null }>(`/api/openings?limit=${limit}${pageParam ? `&before=${pageParam}` : ""}`, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

function setBalance(qc: ReturnType<typeof useQueryClient>, balance: number, patch: Partial<Me> = {}) {
  qc.setQueryData<Me>(qk.me, (m) => (m ? { ...m, coins: balance, ...patch } : m));
}

export function useOpenCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: number) => api.post<OpenResult>(`/api/cases/${caseId}/open`),
    onSuccess: (r) => {
      // Balance is updated from the server response only.
      qc.setQueryData<Me>(qk.me, (m) => (m ? { ...m, coins: r.balance, xp: r.xp, level: r.level, totalOpenings: m.totalOpenings + 1 } : m));
    },
    onSettled: () => {
      // Refresh dependent views in the background once the reveal has started.
      setTimeout(() => {
        void qc.invalidateQueries({ queryKey: qk.inventory });
        void qc.invalidateQueries({ queryKey: qk.missions });
        void qc.invalidateQueries({ queryKey: qk.openings });
        void qc.invalidateQueries({ queryKey: qk.profile });
        void qc.invalidateQueries({ queryKey: qk.collections });
        void qc.invalidateQueries({ queryKey: qk.me });
      }, 400);
    },
  });
}

export function useClaimDaily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ amount: number; balance: number }>("/api/daily-reward"),
    onSuccess: (r) => {
      qc.setQueryData<Me>(qk.me, (m) => (m ? { ...m, coins: r.balance, daily: { ...m.daily, claimed: true } } : m));
      void qc.invalidateQueries({ queryKey: qk.missions });
    },
    onError: () => void qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useClaimMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<{ reward: number; balance: number }>(`/api/missions/${id}/claim`),
    onSuccess: (r, id) => {
      setBalance(qc, r.balance);
      qc.setQueryData<Mission[]>(qk.missions, (ms) => ms?.map((m) => (m.id === id ? { ...m, claimed: true } : m)));
      void qc.invalidateQueries({ queryKey: qk.profile });
    },
    onError: () => void qc.invalidateQueries({ queryKey: qk.missions }),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skinId, favorite }: { skinId: number; favorite: boolean }) =>
      api.post<{ favorite: boolean }>(`/api/inventory/${skinId}/favorite`, { favorite }),
    onMutate: ({ skinId, favorite }) => {
      qc.setQueryData<InventoryItem[]>(qk.inventory, (items) => items?.map((i) => (i.skin.id === skinId ? { ...i, favorite } : i)));
      qc.setQueryData<InventoryItem>(qk.item(skinId), (i) => (i ? { ...i, favorite } : i));
    },
    onSettled: (_d, _e, { skinId }) => {
      void qc.invalidateQueries({ queryKey: qk.item(skinId) });
      void qc.invalidateQueries({ queryKey: qk.missions });
      void qc.invalidateQueries({ queryKey: qk.profile });
    },
  });
}

export function useSetLanguage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (language: string) => api.patch<{ user: Me }>("/api/me", { language }),
    onSuccess: (r) => qc.setQueryData(qk.me, r.user),
  });
}
