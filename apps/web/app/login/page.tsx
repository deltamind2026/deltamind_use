
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (isSignup && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setError("Supabase configuration is missing.");
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        const { data, error: signupError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

        if (signupError) throw signupError;

        if (data.session) {
          router.push("/dashboard/portfolio");
          router.refresh();
        } else {
          setMessage(
            "Check your email for a confirmation link before signing in."
          );
        }
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError) throw loginError;

        router.push("/dashboard/portfolio");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    padding: "13px 14px",
    borderRadius: 8,
    border: "1px solid #334155",
    backgroundColor: "#111c32",
    color: "#f8fafc",
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "#030819",
      color: "#e5e7eb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#0c1428",
        padding: 32,
        border: "1px solid #1e293b",
        borderRadius: 16,
      }}>
        <h1 style={{
          textAlign: "center",
          fontSize: 32,
          marginBottom: 8,
        }}>
          Delta<span style={{ color: "#3b82f6" }}>Mind</span>
        </h1>

        <p style={{
          color: "#94a3b8",
          textAlign: "center",
          marginBottom: 28,
        }}>
          {isSignup ? "Create your account" : "Welcome back"}
        </p>

        <form onSubmit={handleSubmit}
          style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 7 }}>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={fieldStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            Password
            <input
              type="password"
              autoComplete={
                isSignup ? "new-password" : "current-password"
              }
              required
              minLength={isSignup ? 6 : undefined}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={fieldStyle}
            />
          </label>

          {error && (
            <p role="alert" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}

          {message && (
            <p role="status" style={{ color: "#4ade80" }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#2563eb",
              border: "none",
              padding: 14,
              borderRadius: 8,
              color: "white",
              fontSize: 15,
              fontWeight: "bold",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Please wait..."
              : isSignup ? "Create Account" : "Sign In"}
          </button>
        </form>

        <p style={{
          textAlign: "center",
          color: "#94a3b8",
          marginTop: 24,
        }}>
          {isSignup ? "Already have an account?" : "New to DeltaMind?"}
          {" "}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError("");
              setMessage("");
            }}
            style={{
              color: "#60a5fa",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isSignup ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </main>
  );
}