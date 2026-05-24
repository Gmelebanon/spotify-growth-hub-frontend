"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import {
  addUser,
  getCurrentUser,
  getUsers,
  logoutUser,
} from "@/lib/simpleAuth";

type Role = "admin" | "viewer";
type ModalMode = "create" | "password" | null;

type AccountRow = {
  id?: number | string;
  display_name?: string | null;
  name?: string | null;
  lastSynced?: string | null;
  last_synced_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  freshness?: string | null;
};

type SettingsUser = {
  id?: string;
  username: string;
  displayName?: string | null;
  role: Role;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SettingsSummary = {
  success?: boolean;
  platformHealth?: number;
  warnings?: number;
  connectedAccounts?: number;
  expiredAccounts?: number;
  syncSuccessRate?: number;
  lastDataPush?: string | null;
  lastDataPushFreshness?: string | null;
  lastDataPushSource?: string | null;
  lastSync?: string | null;
  lastSyncFreshness?: string | null;
  lastSyncSource?: string | null;
  accounts?: AccountRow[];
};

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://spotify-growth-hub-backend.onrender.com";
const MASTER_USERNAME = "gmelebanon";

function formatDateTime(value?: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(value?: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isMasterUser(user?: Pick<SettingsUser, "username"> | null) {
  return (user?.username || "").trim().toLowerCase() === MASTER_USERNAME;
}

function formatDateOnly(value?: string | null) {
  if (!value) return "Not synced yet";

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    return `${Number(dateOnlyMatch[3])}/${Number(dateOnlyMatch[2])}/${dateOnlyMatch[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function normalizeAccount(account: AccountRow): AccountRow {
  const lastSynced =
    account.lastSynced || account.last_synced_at || account.updated_at || null;

  return {
    ...account,
    name:
      account.display_name ||
      account.name ||
      (account.id ? `Account ${account.id}` : "Spotify Account"),
    lastSynced,
    status: account.status || "Connected",
    freshness: account.freshness || timeAgo(lastSynced),
  };
}

async function fetchSettingsSummary(): Promise<SettingsSummary> {
  const response = await fetch(`${API_BASE_URL}/api/settings/summary?ts=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function fetchDatabaseUsers(): Promise<SettingsUser[]> {
  const response = await fetch(`${API_BASE_URL}/api/settings/users?ts=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  return Array.isArray(payload?.users) ? payload.users : [];
}

async function createDatabaseUser(payload: {
  username: string;
  password: string;
  role: Role;
  displayName?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/settings/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function updateDatabaseUser(
  userId: string,
  payload: Partial<{
    username: string;
    password: string;
    role: Role;
    isActive: boolean;
    displayName: string;
  }>,
) {
  const response = await fetch(`${API_BASE_URL}/api/settings/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function deleteDatabaseUser(userId: string) {
  const response = await fetch(`${API_BASE_URL}/api/settings/users/${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}


type LocalUsersStore = {
  key: string;
  value: unknown;
  users: Record<string, unknown>[];
  mode: "array" | "object-users";
};

const LOCAL_USERS_STORAGE_KEYS = [
  "spotify-growth-hub-users",
  "spotify_growth_hub_users",
  "simpleAuthUsers",
  "simple-auth-users",
  "nerd-engine-users",
  "app-users",
  "users",
];

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeLocalUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getUsernameFromLocalRecord(record: Record<string, unknown>) {
  return String(record.username || record.name || record.user || record.login || "").trim();
}

function getLocalUsersCandidateKeys() {
  if (!isBrowser()) return LOCAL_USERS_STORAGE_KEYS;

  const keys = new Set(LOCAL_USERS_STORAGE_KEYS);
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("user") || lowerKey.includes("auth")) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

function parseLocalUsersStore(key: string): LocalUsersStore | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw);

    if (Array.isArray(value)) {
      const users = value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && Boolean(getUsernameFromLocalRecord(item as Record<string, unknown>)),
      );

      return users.length ? { key, value, users, mode: "array" } : null;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const usersValue = record.users;

      if (Array.isArray(usersValue)) {
        const users = usersValue.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object" && Boolean(getUsernameFromLocalRecord(item as Record<string, unknown>)),
        );

        return users.length ? { key, value, users, mode: "object-users" } : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function findLocalUsersStore() {
  for (const key of getLocalUsersCandidateKeys()) {
    const parsed = parseLocalUsersStore(key);
    if (parsed) return parsed;
  }

  return null;
}

function writeLocalUsersStore(store: LocalUsersStore, users: Record<string, unknown>[]) {
  if (!isBrowser()) return false;

  if (store.mode === "array") {
    window.localStorage.setItem(store.key, JSON.stringify(users));
    return true;
  }

  if (store.value && typeof store.value === "object") {
    const nextValue = { ...(store.value as Record<string, unknown>), users };
    window.localStorage.setItem(store.key, JSON.stringify(nextValue));
    return true;
  }

  return false;
}

function getLocalUserRecord(username: string) {
  const store = findLocalUsersStore();
  if (!store) return null;

  const normalized = normalizeLocalUsername(username);
  return (
    store.users.find((user) => normalizeLocalUsername(getUsernameFromLocalRecord(user)) === normalized) || null
  );
}

function updateLocalUser(username: string, updates: Record<string, unknown>) {
  const store = findLocalUsersStore();
  if (!store) return false;

  const normalized = normalizeLocalUsername(username);
  let changed = false;

  const users = store.users.map((user) => {
    if (normalizeLocalUsername(getUsernameFromLocalRecord(user)) !== normalized) return user;
    changed = true;
    return {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!changed) return false;
  return writeLocalUsersStore(store, users);
}

function deleteLocalUser(username: string) {
  if (normalizeLocalUsername(username) === MASTER_USERNAME) return false;

  const store = findLocalUsersStore();
  if (!store) return false;

  const normalized = normalizeLocalUsername(username);
  const users = store.users.filter(
    (user) => normalizeLocalUsername(getUsernameFromLocalRecord(user)) !== normalized,
  );

  if (users.length === store.users.length) return false;
  return writeLocalUsersStore(store, users);
}

function changeLocalUserPassword(username: string, password: string) {
  return updateLocalUser(username, {
    password,
    passwordHash: password,
    pass: password,
  });
}

function SectionCard({ title, eyebrow, defaultOpen = true, children }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-zinc-900/60"
      >
        <div>
          {eyebrow ? (
            <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 bg-black text-green-400 transition-transform ${open ? "rotate-180 border-green-500/50 bg-green-500/10" : ""}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
            <path
              d="M5 8l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? <div className="border-t border-zinc-800/80 p-5">{children}</div> : null}
    </section>
  );
}

function MiniStatCard({
  label,
  value,
  detail,
  isGood = true,
}: {
  label: string;
  value: string | number;
  detail: string;
  isGood?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">{label}</div>
        <span
          className={`mt-1 h-2 w-2 rounded-full ${isGood ? "bg-green-400" : "bg-amber-400"}`}
        />
      </div>
      <div className="mt-3 text-xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{detail}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{children}</label>;
}

function inputClass(disabled = false) {
  return `h-10 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white outline-none focus:border-green-500 ${
    disabled ? "cursor-not-allowed opacity-50" : ""
  }`;
}

function selectClass(disabled = false) {
  return `${inputClass(disabled)} appearance-none bg-[linear-gradient(45deg,transparent_50%,#22c55e_50%),linear-gradient(135deg,#22c55e_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-18px)_17px,calc(100%-13px)_17px] bg-no-repeat pr-9`;
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 hover:border-green-500/60 hover:text-white"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState("");
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [databaseUsersConnected, setDatabaseUsersConnected] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersMessage, setUsersMessage] = useState("");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<SettingsUser | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("viewer");
  const [passwordValue, setPasswordValue] = useState("");

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const summaryQuery = useQuery({
    queryKey: ["settings-summary"],
    queryFn: fetchSettingsSummary,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const fallbackAccounts = useMemo(
    () => ((accountsQuery.data ?? []) as AccountRow[]).map(normalizeAccount),
    [accountsQuery.data],
  );

  const summary = summaryQuery.data;
  const accounts = useMemo(() => {
    if (summary?.accounts?.length) return summary.accounts.map(normalizeAccount);
    return fallbackAccounts;
  }, [summary?.accounts, fallbackAccounts]);

  const currentUserRecord = users.find(
    (user) => user.username.toLowerCase() === currentUser.toLowerCase(),
  );
  const currentRole: Role = currentUser.toLowerCase() === MASTER_USERNAME ? "admin" : currentUserRecord?.role || "admin";
  const canControl = currentRole === "admin";

  const connectedAccounts = summary?.connectedAccounts ?? accounts.length;
  const expiredAccounts = summary?.expiredAccounts ?? 0;
  const platformHealth = summary?.platformHealth ?? (expiredAccounts === 0 ? 100 : 90);
  const syncSuccessRate = summary?.syncSuccessRate ?? (connectedAccounts > 0 ? 100 : 0);
  const lastSync = summary?.lastSync ?? summary?.lastDataPush ?? null;
  const lastSyncFreshness = summary?.lastSyncFreshness || summary?.lastDataPushFreshness || timeAgo(lastSync);

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
    setPasswordValue("");
  };

  const openCreateModal = () => {
    setNewUsername("");
    setNewDisplayName("");
    setNewUserPassword("");
    setNewUserRole("viewer");
    setModalMode("create");
  };

  const openPasswordModal = (user: SettingsUser) => {
    setSelectedUser(user);
    setPasswordValue("");
    setModalMode("password");
  };

  const reloadUsers = async () => {
    setUsersLoading(true);
    setUsersMessage("");

    try {
      const databaseUsers = await fetchDatabaseUsers();
      setUsers(databaseUsers);
      setDatabaseUsersConnected(true);
    } catch {
      const localUsers = getUsers().map((user, index) => {
        const localRecord = getLocalUserRecord(user.username) || {};
        const username = String(user.username || "");
        const storedRole = String(localRecord.role || (isMasterUser({ username }) ? "admin" : "viewer")).toLowerCase();
        const role: Role = storedRole === "admin" ? "admin" : "viewer";

        return {
          id: `local-${index}`,
          username,
          displayName: String(localRecord.displayName || localRecord.display_name || user.username || ""),
          role,
          isActive: localRecord.isActive === false || localRecord.is_active === false ? false : true,
        };
      });
      setUsers(localUsers);
      setDatabaseUsersConnected(false);
      setUsersMessage("Database users endpoint is not connected yet. Showing local users.");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    reloadUsers();
  }, []);

  const handleAddUser = async () => {
    if (!canControl) return;

    if (!newUsername.trim() || !newUserPassword.trim()) {
      alert("Username and password are required.");
      return;
    }

    if (databaseUsersConnected) {
      try {
        await createDatabaseUser({
          username: newUsername.trim(),
          displayName: newDisplayName.trim() || newUsername.trim(),
          password: newUserPassword,
          role: newUserRole,
        });
        closeModal();
        setUsersMessage("User created in database.");
        await reloadUsers();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Could not create user");
      }
      return;
    }

    const result = addUser(newUsername, newUserPassword);
    alert(result.message);

    if (result.success) {
      updateLocalUser(newUsername.trim(), {
        role: newUserRole,
        displayName: newDisplayName.trim() || newUsername.trim(),
        display_name: newDisplayName.trim() || newUsername.trim(),
        isActive: true,
        is_active: true,
      });
      closeModal();
      await reloadUsers();
    }
  };

  const handlePasswordChange = async () => {
    if (!canControl || !selectedUser) return;
    if (!passwordValue.trim()) {
      alert("New password is required.");
      return;
    }

    if (!databaseUsersConnected || !selectedUser.id) {
      const changed = changeLocalUserPassword(selectedUser.username, passwordValue);
      if (!changed) {
        alert("Could not find this local user in browser storage. Connect the Settings backend route to edit database users.");
        return;
      }

      closeModal();
      setUsersMessage(`Password updated locally for ${selectedUser.username}.`);
      await reloadUsers();
      return;
    }

    try {
      await updateDatabaseUser(selectedUser.id, { password: passwordValue });
      closeModal();
      setUsersMessage(`Password updated for ${selectedUser.username}.`);
      await reloadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update password");
    }
  };

  const handleRoleChange = async (user: SettingsUser, role: Role) => {
    if (!canControl || isMasterUser(user)) return;

    if (!databaseUsersConnected || !user.id) {
      const changed = updateLocalUser(user.username, { role });
      if (!changed) {
        alert("Could not update this local user. Connect the Settings backend route to edit database users.");
        return;
      }
      await reloadUsers();
      return;
    }

    try {
      await updateDatabaseUser(user.id, { role });
      await reloadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update role");
    }
  };

  const handleActiveChange = async (user: SettingsUser) => {
    if (!canControl || isMasterUser(user)) return;

    if (!databaseUsersConnected || !user.id) {
      const changed = updateLocalUser(user.username, {
        isActive: !user.isActive,
        is_active: !user.isActive,
      });
      if (!changed) {
        alert("Could not update this local user. Connect the Settings backend route to edit database users.");
        return;
      }
      await reloadUsers();
      return;
    }

    try {
      await updateDatabaseUser(user.id, { isActive: !user.isActive });
      await reloadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not update user");
    }
  };

  const handleDeleteUser = async (user: SettingsUser) => {
    if (!canControl || isMasterUser(user)) return;

    const confirmed = window.confirm(`Delete user ${user.username}? This cannot be undone.`);
    if (!confirmed) return;

    if (!databaseUsersConnected || !user.id) {
      const deleted = deleteLocalUser(user.username);
      if (!deleted) {
        alert("Could not delete this local user. Connect the Settings backend route to edit database users.");
        return;
      }
      setUsersMessage(`Deleted local user ${user.username}.`);
      await reloadUsers();
      return;
    }

    try {
      await deleteDatabaseUser(user.id);
      setUsersMessage(`Deleted ${user.username}.`);
      await reloadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not delete user");
    }
  };

  const handleLogout = () => {
    logoutUser();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-black px-5 py-6 text-white md:px-8 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Database-backed controls, roles, sync status, and platform health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            Role: <span className="font-semibold text-green-400">{currentRole}</span>
          </div>
          <button
            type="button"
            onClick={() => summaryQuery.refetch()}
            className="h-9 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300 hover:border-green-500/60 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <MiniStatCard
          label="Platform Health"
          value={`${platformHealth}%`}
          detail={`${summary?.warnings ?? 0} warnings detected`}
          isGood={platformHealth >= 95}
        />
        <MiniStatCard
          label="Connected Accounts"
          value={connectedAccounts}
          detail={`${connectedAccounts} ready / ${expiredAccounts} expired`}
          isGood={expiredAccounts === 0}
        />
        <MiniStatCard
          label="Sync Success Rate"
          value={`${syncSuccessRate}%`}
          detail="Based on active connections"
          isGood={syncSuccessRate >= 95}
        />
        <MiniStatCard
          label="Last Sync"
          value={lastSync ? formatDateOnly(lastSync) : "Not synced yet"}
          detail={lastSync ? `${lastSyncFreshness} from follower_history` : "from follower_history"}
          isGood={Boolean(lastSync)}
        />
      </div>

      <div className="space-y-4">
        <SectionCard title="Account Sync Status" eyebrow="Database health">
          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <div className="grid grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr] border-b border-zinc-800 bg-zinc-900/40 px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              <div>Account</div>
              <div>Last Synced</div>
              <div>Status</div>
              <div>Freshness</div>
            </div>
            {accounts.length ? (
              accounts.map((account) => (
                <div
                  key={String(account.id)}
                  className="grid grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr] border-b border-zinc-900 px-4 py-3 text-sm last:border-b-0"
                >
                  <div className="font-semibold text-white">{account.name}</div>
                  <div className="text-zinc-300">{formatDateOnly(account.lastSynced)}</div>
                  <div className="text-green-400">{account.status || "Connected"}</div>
                  <div className="text-zinc-500">{account.freshness || timeAgo(account.lastSynced)}</div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-zinc-500">No connected accounts found.</div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Users & Permissions" eyebrow="Admin / Viewer">
          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Website users</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Source: {databaseUsersConnected ? "Supabase app_users" : "Local fallback"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={!canControl}
                  className="h-8 rounded-lg bg-green-500 px-3 text-xs font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={reloadUsers}
                  className="h-8 rounded-lg border border-zinc-800 px-3 text-xs text-zinc-300 hover:border-green-500/60"
                >
                  Reload
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-8 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  Logout
                </button>
              </div>
            </div>

            {usersMessage ? <p className="mt-3 text-xs text-zinc-500">{usersMessage}</p> : null}

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
              <div className="grid grid-cols-[1.15fr_0.6fr_0.45fr_0.5fr_1fr] bg-zinc-900/50 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <div>User</div>
                <div>Role</div>
                <div>Password</div>
                <div>Status</div>
                <div>Control</div>
              </div>

              {usersLoading ? (
                <div className="px-3 py-5 text-sm text-zinc-500">Loading users...</div>
              ) : users.length ? (
                users.map((user) => {
                  const masterUser = isMasterUser(user);
                  const roleDisabled = !canControl || masterUser;
                  const passwordDisabled = !canControl;
                  const controlDisabled = !canControl || masterUser;

                  return (
                    <div
                      key={user.id || user.username}
                      className="grid grid-cols-[1.15fr_0.6fr_0.45fr_0.5fr_1fr] items-center gap-3 border-t border-zinc-900 px-3 py-3 text-sm"
                    >
                    <div>
                      <div className="font-semibold text-white">{user.displayName || user.username}</div>
                      <div className="text-xs text-zinc-500">{user.username}</div>
                    </div>

                    <select
                      value={masterUser ? "admin" : user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                      disabled={roleDisabled}
                      className={`${selectClass(roleDisabled)} h-8 max-w-[120px] text-xs`}
                      title={masterUser ? "Master account role is locked" : undefined}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => openPasswordModal(user)}
                      disabled={passwordDisabled}
                      className="h-7 max-w-[120px] rounded-lg border border-zinc-800 px-2 text-[11px] text-zinc-300 hover:border-green-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Change password
                    </button>

                    <div className={user.isActive ? "text-green-400" : "text-zinc-500"}>
                      {user.isActive ? "Active" : "Disabled"}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleActiveChange(user)}
                        disabled={controlDisabled}
                        title={masterUser ? "Master account cannot be disabled" : undefined}
                        className="h-8 rounded-lg border border-zinc-800 px-2 text-xs text-zinc-300 hover:border-amber-500/60 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user)}
                        disabled={controlDisabled}
                        title={masterUser ? "Master account cannot be deleted" : undefined}
                        className="h-8 rounded-lg border border-red-500/40 bg-red-500/10 px-2 text-xs text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="px-3 py-5 text-sm text-zinc-500">No users yet.</div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="About / System" eyebrow="App info" defaultOpen={false}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="text-xs font-medium text-zinc-300">App version</div>
              <div className="mt-1 text-xs text-zinc-500">Nerd Engine V2 240526</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="text-xs font-medium text-zinc-300">Design and Development</div>
              <a
                href="https://wissamdesigns.com"
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-xs text-green-400 hover:text-green-300"
              >
                wissamdesigns.com
              </a>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-black p-4">
              <div className="text-xs font-medium text-zinc-300">Support</div>
              <a
                href="mailto:wissam@wissamdesigns.com"
                className="mt-1 block text-xs text-green-400 hover:text-green-300"
              >
                wissam@wissamdesigns.com
              </a>
            </div>
          </div>
        </SectionCard>
      </div>

      {modalMode === "create" ? (
        <Modal title="Create User" onClose={closeModal}>
          <div className="space-y-3">
            <div>
              <FieldLabel>Username</FieldLabel>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                disabled={!canControl}
                className={inputClass(!canControl)}
                placeholder="username"
              />
            </div>
            <div>
              <FieldLabel>Display Name</FieldLabel>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                disabled={!canControl}
                className={inputClass(!canControl)}
                placeholder="optional"
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                disabled={!canControl}
                className={inputClass(!canControl)}
                placeholder="password"
              />
            </div>
            <div>
              <FieldLabel>Role</FieldLabel>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as Role)}
                disabled={!canControl}
                className={selectClass(!canControl)}
              >
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleAddUser}
              disabled={!canControl}
              className="mt-2 h-10 w-full rounded-xl bg-green-500 text-sm font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create User
            </button>
          </div>
        </Modal>
      ) : null}

      {modalMode === "password" && selectedUser ? (
        <Modal title={`Change password — ${selectedUser.username}`} onClose={closeModal}>
          <div className="space-y-3">
            <div>
              <FieldLabel>New Password</FieldLabel>
              <input
                type="password"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                disabled={!canControl}
                className={inputClass(!canControl)}
                placeholder="new password"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handlePasswordChange}
              disabled={!canControl}
              className="mt-2 h-10 w-full rounded-xl bg-green-500 text-sm font-semibold text-black hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save Password
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
