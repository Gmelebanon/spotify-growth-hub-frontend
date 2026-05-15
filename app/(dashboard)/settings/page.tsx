"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getAccounts } from "@/lib/api/accounts";
import { useActiveAccountStore } from "@/lib/store/activeAccount";
import {
  addUser,
  changePassword,
  getCurrentUser,
  getUsers,
  logoutUser,
} from "@/lib/simpleAuth";

type SectionCardProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function SectionCard({ title, defaultOpen = true, children }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <span className={`text-sm text-zinc-400 ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
      </button>

      {open && <div className="border-t border-zinc-800 px-6 py-6">{children}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();

  const activeAccountId = useActiveAccountStore((s) => s.activeAccountId);
  const setActiveAccountId = useActiveAccountStore((s) => s.setActiveAccountId);

  const [currentUser, setCurrentUser] = useState("");
  const [users, setUsers] = useState<{ username: string; password: string }[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setUsers(getUsers());
  }, []);

  const handleChangePassword = () => {
    const result = changePassword(currentUser, currentPassword, newPassword);
    alert(result.message);

    if (result.success) {
      setCurrentPassword("");
      setNewPassword("");
      setUsers(getUsers());
    }
  };

  const handleAddUser = () => {
    const result = addUser(newUsername, newUserPassword);
    alert(result.message);

    if (result.success) {
      setNewUsername("");
      setNewUserPassword("");
      setUsers(getUsers());
    }
  };

  const handleLogoutAll = () => {
    logoutUser();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-zinc-500">
          System controls, account connection settings, and platform information.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Current Account
        </div>

        <select
          value={activeAccountId ?? ""}
          onChange={(e) => setActiveAccountId(Number(e.target.value))}
          className="mt-3 h-12 w-full max-w-[320px] rounded-xl border border-zinc-800 bg-black px-4 text-sm text-white outline-none focus:border-green-500"
        >
          <option value="">Select account</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.display_name || `Account ${acc.id}`}
            </option>
          ))}
        </select>

        <div className="mt-2 text-sm text-zinc-500">
          {activeAccountId ? `Account ID: ${activeAccountId}` : "No account selected"}
        </div>
      </div>

      <div className="space-y-6">
        <SectionCard title="Security">
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <h3 className="text-lg font-semibold">Current website user</h3>
              <p className="mt-1 text-sm text-zinc-500">{currentUser || "Not detected"}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <h3 className="mb-4 text-lg font-semibold">Change password</h3>

              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-green-500"
              />

              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mb-4 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-green-500"
              />

              <button
                onClick={handleChangePassword}
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400"
              >
                Save New Password
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <h3 className="mb-4 text-lg font-semibold">Add new website user</h3>

              <input
                type="text"
                placeholder="New username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-green-500"
              />

              <input
                type="password"
                placeholder="New user password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="mb-4 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-green-500"
              />

              <button
                onClick={handleAddUser}
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400"
              >
                Add User
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <h3 className="text-lg font-semibold">Website users</h3>
              <div className="mt-3 space-y-2">
                {users.map((user) => (
                  <div
                    key={user.username}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300"
                  >
                    {user.username}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleLogoutAll}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
            >
              Logout All
            </button>
          </div>
        </SectionCard>

        <SectionCard title="About / System">
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <div className="text-sm font-medium text-zinc-300">App version</div>
              <div className="mt-1 text-sm text-zinc-500">Nerd Engine V1.3 051026</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <div className="text-sm font-medium text-zinc-300">Developer</div>
              <div className="mt-1 text-sm text-zinc-500">wissam@wissamdesigns.com</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <div className="text-sm font-medium text-zinc-300">Support</div>
              <div className="mt-1 text-sm text-zinc-500">wissam@wissamdesigns.com</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}