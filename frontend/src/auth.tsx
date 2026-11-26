import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { storage } from "@/src/utils/storage";

export const TOKEN_KEY = "tealyze_auth_token";

export type Role = "caregiver" | "professional";

export type User = {
  id: string;
  role: Role;
  email: string;
  phone?: string;
  created_at?: string;
  // cuidador
  caregiver_name?: string;
  caregiver_cpf?: string;
  patient_id?: string | null;
  patient_name?: string;
  patient_cpf?: string;
  aq_score?: number | null;
  aq_answers?: number[] | null;
  aq_submitted_at?: string | null;
  // profissional
  name?: string;
  crp?: string;
  crp_verified?: boolean;
  specialty?: string;
  formation?: string;
  bio?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  teleconsulta?: boolean;
};

// --- Descoberta do endereço da API -------------------------------------

const DEFAULT_PORT = 3000;

function hostFromExpo(): string | null {
  const constants = Constants as any;
  const hostUri =
    constants?.expoConfig?.hostUri ||
    constants?.expoGoConfig?.debuggerHost ||
    constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    null;
  if (!hostUri || typeof hostUri !== "string") return null;
  const host = hostUri.split("/")[0].split(":")[0];
  return host || null;
}

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured && configured.trim()) return configured.trim().replace(/\/+$/, "");

  // Sem variável configurada: melhor esforço por plataforma.
  if (Platform.OS === "web") return `http://localhost:${DEFAULT_PORT}`;

  const host = hostFromExpo();
  if (host) return `http://${host}:${DEFAULT_PORT}`;

  // Emulador Android usa 10.0.2.2 para alcançar o "localhost" do host.
  if (Platform.OS === "android") return `http://10.0.2.2:${DEFAULT_PORT}`;
  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_URL = resolveApiUrl();

// --- Cliente HTTP -------------------------------------------------------

const REQUEST_TIMEOUT_MS = 20000;

function friendlyNetworkError(): Error {
  return new Error(
    `Não foi possível falar com o servidor (${API_URL}). ` +
      `Verifique se o backend está rodando e se EXPO_PUBLIC_API_URL aponta para ele.`
  );
}

/**
 * Mesma assinatura do `apiFetch` anterior: recebe caminho, token e options,
 * devolve o JSON já pronto e lança `Error(mensagem)` em caso de falha —
 * é a mensagem que as telas exibem ao usuário.
 */
export async function apiFetch(path: string, token: string | null, options: RequestInit = {}) {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") {
      throw new Error("O servidor demorou para responder. Tente novamente.");
    }
    throw friendlyNetworkError();
  }
  clearTimeout(timer);

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      (response.status === 401
        ? "Sessão expirada. Faça login novamente."
        : `Falha na operação (HTTP ${response.status})`);
    const error = new Error(detail) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return data;
}

// --- Contexto de autenticação -------------------------------------------

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUpCaregiver: (payload: any) => Promise<void>;
  signUpProfessional: (payload: any) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  const applyAuth = useCallback(async (t: string, u: User) => {
    tokenRef.current = t;
    setToken(t);
    setUser(u);
    await storage.secureSet(TOKEN_KEY, t);
  }, []);

  const clearAuth = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    tokenRef.current = null;
    setToken(null);
    setUser(null);
  }, []);

  /** Revalida o token guardado contra o servidor (GET /auth/me). */
  const refresh = useCallback(async () => {
    try {
      const t = await storage.secureGet(TOKEN_KEY, "");
      if (!t) {
        setLoading(false);
        return;
      }
      try {
        const u = await apiFetch("/auth/me", t as string);
        tokenRef.current = t as string;
        setToken(t as string);
        setUser(u as User);
      } catch (e: any) {
        // Token inválido/expirado -> desloga. Erro de rede -> mantém o token
        // para tentar de novo quando o servidor voltar.
        if (e?.status === 401 || e?.status === 403) {
          await clearAuth();
        } else {
          console.log("auth refresh: servidor indisponível", e?.message);
        }
      }
    } catch (e) {
      console.log("auth refresh error", e);
    } finally {
      setLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch("/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await applyAuth(data.token, data.user as User);
  };

  const signUpCaregiver = async (payload: any) => {
    const data = await apiFetch("/auth/register/caregiver", null, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await applyAuth(data.token, data.user as User);
  };

  const signUpProfessional = async (payload: any) => {
    const data = await apiFetch("/auth/register/professional", null, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await applyAuth(data.token, data.user as User);
  };

  const signOut = async () => {
    const current = tokenRef.current;
    if (current) {
      try {
        await apiFetch("/auth/logout", current, { method: "POST" });
      } catch {
        // Servidor fora do ar não deve impedir o logout local.
      }
    }
    await clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, signIn, signUpCaregiver, signUpProfessional, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
