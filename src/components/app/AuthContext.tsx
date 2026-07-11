"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import LoginPage from "./LoginPage";

export type Role = "owner" | "gm" | "supervisor" | "data-entry";

export interface User {
  name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  login: (name: string, role: Role, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_PASSWORDS: Record<Role, string> = {
  owner: "owner123",
  gm: "gm123",
  supervisor: "super123",
  "data-entry": "data123",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Read user from localStorage on mount
    try {
      const stored = localStorage.getItem("disposafe_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load user from localStorage", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (name: string, role: Role, password: string): boolean => {
    const expectedPassword = ROLE_PASSWORDS[role];
    if (expectedPassword && password === expectedPassword) {
      const newUser: User = { name: name.trim() || getDefaultName(role), role };
      setUser(newUser);
      try {
        localStorage.setItem("disposafe_user", JSON.stringify(newUser));
      } catch (e) {
        console.error("Failed to save user to localStorage", e);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("disposafe_user");
    } catch (e) {
      console.error("Failed to remove user from localStorage", e);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-sans)",
        gap: 16
      }}>
        {/* Simple elegant pulse loader */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "2px solid var(--accent)",
          animation: "pulse-ring-auth 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite"
        }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
          INITIALIZING COCKPIT OS...
        </span>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse-ring-auth {
            0% { transform: scale(0.95); opacity: 0.8; }
            50% { transform: scale(1.05); opacity: 0.4; }
            100% { transform: scale(0.95); opacity: 0.8; }
          }
        ` }} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

function getDefaultName(role: Role): string {
  switch (role) {
    case "owner": return "Owner";
    case "gm": return "Swamiji";
    case "supervisor": return "Supervisor";
    case "data-entry": return "Operator";
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function isNavKeyAllowed(role: Role | undefined, key: string): boolean {
  if (!role) return false;
  if (role === "owner" || role === "gm") return true;
  if (role === "supervisor") {
    // "only the dashboard, workbook, all the defects, spc control chart, Ask moid, nothing else"
    // Allowed keys:
    // dashboard: Dashboard (/)
    // workbooks: Workbooks (/workbooks)
    // defect: Defect Analysis (/defect-analysis)
    // spc: SPC & Control Charts (/spc)
    // ask: Ask MOID (/chat)
    const allowed = ["dashboard", "workbooks", "defect", "spc", "ask"];
    return allowed.includes(key);
  }
  if (role === "data-entry") {
    // "data entry user has only data entry and staging and review acess nothin else not even settings"
    // Allowed keys:
    // data-entry: Data Entry (/data-entry)
    // staging: Staging & Review (/staging)
    const allowed = ["data-entry", "staging"];
    return allowed.includes(key);
  }
  return false;
}

export function displayRole(role: Role | undefined): string {
  switch (role) {
    case "owner": return "Owner";
    case "gm": return "General Manager";
    case "supervisor": return "Supervisor";
    case "data-entry": return "Data Entry";
    default: return "";
  }
}

export function getFirstAllowedRoute(role: Role): string {
  if (role === "data-entry") return "/data-entry";
  return "/";
}
