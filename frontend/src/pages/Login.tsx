import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { getActiveSubdomain, getApiBase, resolveAssetUrl } from "../utils/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login, isLoggingIn } = useAuth();

  const activeSubdomain = getActiveSubdomain();
  const { data: workspaceData } = useQuery<any>({
    queryKey: ["public_workspace", activeSubdomain],
    queryFn: async () => {
      if (!activeSubdomain) return null;
      const res = await fetch(`${getApiBase()}/auth/workspace`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activeSubdomain,
  });

  const org = workspaceData?.org || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas text-ink px-6">
      <div className="w-full max-w-sm font-sans">
        <div className="text-center mb-10">
          <span className="font-serif italic text-4xl tracking-tight text-ink block mb-2 flex justify-center">
            {org?.logoUrl ? (
              <img src={resolveAssetUrl(org.logoUrl)} alt={org.name} className="h-10 max-w-[200px] object-contain" />
            ) : (
              org?.name || "Aura"
            )}
          </span>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
            Support desk authentication
          </p>
        </div>

        <div className="bg-canvas ring-1 ring-black/10 rounded-2xl p-8 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-danger/5 ring-1 ring-danger/20 rounded-xl text-xs text-danger font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                Email Address
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-surface ring-1 ring-black/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all placeholder:text-muted-foreground/50"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                Password
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface ring-1 ring-black/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-black/20 focus:bg-canvas transition-all placeholder:text-muted-foreground/50"
              />
            </label>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-brand-primary text-brand-secondary py-3 px-4 rounded-lg text-sm font-medium transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {isLoggingIn ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-8 leading-relaxed max-w-[28ch] mx-auto font-serif italic">
          "A calm mind brings inner strength and self-confidence, so that's very important for good health."
        </p>
      </div>
    </div>
  );
}
