"use client";

import React, { useState } from "react";
import { useAuth, type Role } from "./AuthContext";
import Icon from "@/components/editorial/Icon";

export default function LoginPage() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const success = login(name, role, password);
    if (!success) {
      setError("Invalid password credential for this role.");
    }
  };

  const handleRoleSelect = (selectedRole: Role) => {
    setRole(selectedRole);
    setError("");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font-sans)",
      transition: "background-color 0.25s ease"
    }}>
      <div style={{
        background: "var(--surface)",
        border: "2px solid var(--text)",
        borderRadius: "var(--radius-lg)",
        padding: "40px",
        boxShadow: "8px 8px 0px var(--text)",
        maxWidth: "460px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
        {/* Header Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="MOID Logo" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.02em"
          }}>
            <span style={{ color: "var(--secondary)" }}>Dispo</span>
            <span style={{ color: "var(--accent)" }}>safe</span>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 800,
            margin: 0,
            lineHeight: 1.1,
            color: "var(--text)"
          }}>
            Access Cockpit OS
          </h1>
          <p style={{
            fontSize: 13,
            color: "var(--text-2)",
            lineHeight: 1.4,
            margin: 0
          }}>
            Sign in with credentials to access your manufacturing role.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Name Field */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.04em" }}>
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Swamiji"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid var(--border-strong)",
                background: "var(--surface-2)",
                color: "var(--text)",
                borderRadius: "var(--radius-md)"
              }}
            />
          </div>

          {/* Role Selection */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.04em" }}>
              Role Selection
            </label>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8
            }}>
              {(["owner", "gm", "supervisor", "data-entry"] as const).map((r) => {
                const isSelected = role === r;
                let roleLabel = "";
                if (r === "owner") roleLabel = "Owner";
                if (r === "gm") roleLabel = "General Manager";
                if (r === "supervisor") roleLabel = "Supervisor";
                if (r === "data-entry") roleLabel = "Data Entry";

                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleSelect(r)}
                    style={{
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: "var(--radius-sm)",
                      border: isSelected ? "2px solid var(--text)" : "1.5px solid var(--border)",
                      background: isSelected ? "var(--accent-weak)" : "var(--surface-2)",
                      color: isSelected ? "var(--accent)" : "var(--text)",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {roleLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Password Field */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.04em" }}>
              Password Credential
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid var(--border-strong)",
                background: "var(--surface-2)",
                color: "var(--text)",
                borderRadius: "var(--radius-md)"
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 12px",
              background: "var(--critical-weak)",
              border: "1.5px solid var(--critical)",
              borderRadius: "var(--radius-sm)",
              color: "var(--critical)",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <Icon name="alert" size={14} style={{ color: "var(--critical)" }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            style={{
              background: "var(--accent)",
              color: "#FFFFFF",
              border: "2px solid var(--text)",
              borderRadius: "var(--radius-md)",
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "4px 4px 0 var(--text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "transform 0.1s ease, box-shadow 0.1s ease"
            }}
          >
            Authenticate & Open Cockpit
          </button>
        </form>

        {/* Credentials cheat-sheet */}
        <div style={{
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          background: "var(--surface-2)",
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-3)"
          }}>
            Hardcoded Credentials Cheat Sheet
          </span>
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 12px",
            fontSize: 11.5,
            fontFamily: "var(--font-mono)",
            color: "var(--text-2)"
          }}>
            <span style={{ fontWeight: 600 }}>Owner:</span>
            <span>password: <strong style={{ color: "var(--text)" }}>owner123</strong></span>

            <span style={{ fontWeight: 600 }}>GM:</span>
            <span>password: <strong style={{ color: "var(--text)" }}>gm123</strong></span>

            <span style={{ fontWeight: 600 }}>Supervisor:</span>
            <span>password: <strong style={{ color: "var(--text)" }}>super123</strong></span>

            <span style={{ fontWeight: 600 }}>Data Entry:</span>
            <span>password: <strong style={{ color: "var(--text)" }}>data123</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
