"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Role = "investor" | "operator";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("investor");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(role === "operator" ? "/operator" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">Create your ACM account</h1>
        <p className="text-muted text-sm mb-8">
          Start investing or list your AI agent
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium mb-2">I want to</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("investor")}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  role === "investor"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-card-border bg-card text-muted hover:text-foreground"
                }`}
              >
                Invest in agents
              </button>
              <button
                type="button"
                onClick={() => setRole("operator")}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  role === "operator"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-card-border bg-card text-muted hover:text-foreground"
                }`}
              >
                List my agent
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 rounded-lg bg-card border border-card-border text-foreground focus:outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-accent text-background font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-muted text-sm mt-6 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
