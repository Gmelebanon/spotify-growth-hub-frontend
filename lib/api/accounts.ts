import { get, post, API_BASE } from "./client";

export type SpotifyAccount = {
  id: number;
  spotify_user_id: string;
  display_name: string;
  email?: string | null;
  expires_at?: string | null;
  token_expired?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AccountStatusResponse = {
  id: number;
  token_expired: boolean;
  expires_at?: string | null;
};

export type AccountSyncResponse = {
  account_id: number;
  synced?: number;
  total?: number;
  count?: number;
  created?: number;
  updated?: number;
  limit?: number;
  offset?: number;
  message?: string;
  detail?: string;
  [key: string]: unknown;
};

export type SyncAllAccountsResponse = {
  ok: number;
  failed: number;
  total: number;
  results: Array<{
    accountId: number;
    accountName: string;
    ok: boolean;
    data?: AccountSyncResponse;
    error?: string;
  }>;
};

function withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms / 1000} seconds`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function getAccounts(): Promise<SpotifyAccount[]> {
  const response = await get<SpotifyAccount[] | { items?: SpotifyAccount[] }>(
    "/api/accounts",
  );

  if (Array.isArray(response)) {
    return response;
  }

  if (response && Array.isArray(response.items)) {
    return response.items;
  }

  return [];
}

export async function getAccountStatus(
  id: number,
): Promise<AccountStatusResponse> {
  return get<AccountStatusResponse>(`/api/accounts/${id}/status`);
}

export async function refreshAccountToken(id: number) {
  return post(`/api/accounts/${id}/refresh`);
}

export function triggerLogin() {
  window.location.href = `${API_BASE}/api/auth/login`;
}

export async function syncAccountPlaylists(
  accountId: number,
  params?: { limit?: number; offset?: number; timeoutMs?: number },
): Promise<AccountSyncResponse> {
  const limit = params?.limit ?? 500;
  const offset = params?.offset ?? 0;
  const timeoutMs = params?.timeoutMs ?? 30000;

  return withTimeout(
    post<AccountSyncResponse>(
      `/api/accounts/${accountId}/playlists/sync?limit=${limit}&offset=${offset}`,
    ),
    timeoutMs,
  );
}

export async function syncAllAccountPlaylists(params?: {
  limit?: number;
  offset?: number;
  timeoutMs?: number;
}): Promise<SyncAllAccountsResponse> {
  const accounts = await getAccounts();

  const settled = await Promise.all(
    accounts.map(async (account) => {
      try {
        const data = await syncAccountPlaylists(account.id, params);

        return {
          accountId: account.id,
          accountName: account.display_name || `Account ${account.id}`,
          ok: true,
          data,
        };
      } catch (error) {
        return {
          accountId: account.id,
          accountName: account.display_name || `Account ${account.id}`,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown sync error",
        };
      }
    }),
  );

  const ok = settled.filter((item) => item.ok).length;
  const failed = settled.length - ok;

  return {
    ok,
    failed,
    total: settled.length,
    results: settled,
  };
}