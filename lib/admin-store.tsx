"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AdminData } from "./admin-types";
import { api, type ApiResponse } from "./api";

type Access = "loading" | "signed_out" | "ok" | "error";
type AdminAction = { type: string } & Record<string, unknown>;

interface AdminStore {
  access: Access;
  data: AdminData | null;
  error: string | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Send one Super Admin action, then reload the data so every screen shows the result. */
  act: <T = object>(action: AdminAction) => Promise<ApiResponse<T>>;
  toast: string | null;
  notify: (message: string) => void;
}

const AdminContext = createContext<AdminStore | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<Access>("loading");
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    const result = await api<{ data: AdminData }>("/api/admin/data");
    if (result.ok) {
      setData(result.data);
      setError(null);
      setAccess("ok");
    } else if (result.status === 401 || result.status === 403) {
      setData(null);
      setAccess("signed_out");
    } else {
      setError(result.error);
      setAccess((current) => (current === "ok" ? "ok" : "error"));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const store = useMemo<AdminStore>(
    () => ({
      access,
      data,
      error,
      refresh,
      toast,
      notify,
      async signIn(email, password, remember) {
        const result = await api("/api/auth/login", { portal: "admin", email, password, remember });
        if (!result.ok) return { ok: false, code: result.code, message: result.error };
        await refresh();
        return { ok: true };
      },
      async signOut() {
        await api("/api/auth/logout", { portal: "admin" });
        setData(null);
        setAccess("signed_out");
      },
      async act<T = object>(action: AdminAction) {
        const result = await api<T>("/api/admin/actions", action);
        if (result.ok) await refresh();
        else if (result.status === 401 || result.status === 403) {
          setData(null);
          setAccess("signed_out");
        }
        return result;
      },
    }),
    [access, data, error, refresh, toast, notify],
  );

  return <AdminContext.Provider value={store}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const store = useContext(AdminContext);
  if (!store) throw new Error("useAdmin must be used inside <AdminProvider>");
  return store;
}

/** For pages inside the signed-in admin area, where the data is always present. */
export function useAdminData() {
  const { data } = useAdmin();
  if (!data) throw new Error("Admin data is not loaded");
  return data;
}
