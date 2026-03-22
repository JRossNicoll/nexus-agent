import { useQuery } from "@tanstack/react-query";

const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:18799";

async function gw<T>(path: string): Promise<T> {
  const r = await fetch(`${GW}${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}

// ── stale times (ms) ────────────────────────────────────────
export const STALE = {
  chat:     30_000,   // 30 s
  memory:   180_000,  // 3 min
  skills:   120_000,  // 2 min
  activity: 20_000,   // 20 s
  settings: 600_000,  // 10 min
} as const;

// ── hooks ───────────────────────────────────────────────────

export function useMemories(search: string) {
  return useQuery({
    queryKey: ["memories", search],
    queryFn: () => {
      const url = search
        ? `/api/v1/memories/search?q=${encodeURIComponent(search)}&limit=50`
        : `/api/v1/memories?limit=50`;
      return gw<any[]>(url).catch(() => gw<any>(`/api/v1/memories?q=${encodeURIComponent(search)}&limit=50`).then(d => Array.isArray(d) ? d : d.memories ?? []));
    },
    staleTime: STALE.memory,
    placeholderData: (prev: any) => prev,
  });
}

export function useMemoryHealth() {
  return useQuery({
    queryKey: ["memoryHealth"],
    queryFn: () => gw<any>("/api/v1/memory/health"),
    staleTime: STALE.memory,
  });
}

export function useMemoryClusters() {
  return useQuery({
    queryKey: ["memoryClusters"],
    queryFn: () => gw<any>("/api/v1/memory/clusters").then(d => Array.isArray(d) ? d : d.clusters ?? []),
    staleTime: STALE.memory,
  });
}

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => gw<any[]>("/api/v1/skills").then(d => Array.isArray(d) ? d : []),
    staleTime: STALE.skills,
  });
}

export function useActivities(filter: string) {
  return useQuery({
    queryKey: ["activities", filter],
    queryFn: () => gw<any>("/api/v1/activity?limit=50").then(d => Array.isArray(d) ? d : d.activities ?? []),
    staleTime: STALE.activity,
    placeholderData: (prev: any) => prev,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => gw<any>("/health"),
    staleTime: STALE.settings,
  });
}

export function useProviderSettings() {
  return useQuery({
    queryKey: ["providerSettings"],
    queryFn: () => gw<any>("/api/v1/settings/provider"),
    staleTime: STALE.settings,
  });
}

export function useOnboardingStatus() {
  return useQuery({
    queryKey: ["onboardingStatus"],
    queryFn: () => gw<any>("/api/onboarding/status"),
    staleTime: STALE.settings,
  });
}

// First-message flag
export function useFirstMessageFlag() {
  return useQuery({
    queryKey: ["firstMessageFlag"],
    queryFn: () => gw<{ firstMessage: boolean }>("/api/v1/first-message-flag"),
    staleTime: 5_000,
  });
}
