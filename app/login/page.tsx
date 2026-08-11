"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("That's not it — try again.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Internal Use Only</h1>
        <p style={styles.sub}>Enter the passcode to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Passcode"
          autoFocus
          style={styles.input}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button onClick={submit} disabled={loading || !password} style={{ ...styles.btn, opacity: loading || !password ? 0.6 : 1 }}>
          {loading ? "Checking…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070A", fontFamily: "sans-serif" },
  card: { width: 320, padding: 32, background: "#141B22", border: "1px solid #232D38", borderRadius: 16, textAlign: "center" },
  title: { color: "#ECF2F5", fontSize: 18, margin: "0 0 8px" },
  sub: { color: "#7C8A99", fontSize: 13, margin: "0 0 20px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #232D38", background: "#0C1116", color: "#ECF2F5", outline: "none", marginBottom: 12, boxSizing: "border-box", fontSize: 14 },
  error: { color: "#F2897E", fontSize: 12, margin: "0 0 12px" },
  btn: { width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#2DD4BF", color: "#08201B", fontWeight: 700, cursor: "pointer", fontSize: 14 },
};
