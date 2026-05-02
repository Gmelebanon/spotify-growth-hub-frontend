import { create } from "zustand"
import { persist } from "zustand/middleware"

type ActiveAccountStore = {
  activeAccountId: number | null
  setActiveAccountId: (id: number) => void
}

export const useActiveAccountStore = create<ActiveAccountStore>()(
  persist(
    (set) => ({
      activeAccountId: null,
      setActiveAccountId: (id) => set({ activeAccountId: id }),
    }),
    {
      name: "active-account",
    }
  )
)