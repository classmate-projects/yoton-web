"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import Image from "next/image";
import logo from "@/public/yoton_logo.png";

export default function LoginPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [emailOrUserName, setEmailOrUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrUserName, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");

      localStorage.setItem("yoton_user_detail", JSON.stringify({
        role: data.body.role,
        name: data.body.name,
        userId: data.body.userId,
      }));

      toast.success(`Welcome back, ${data.body.name}!`);
      router.push("/");
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-background p-6">
      <div className="w-full max-w-[400px] space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-card rounded-2xl shadow-sm border border-border">
            <Image src={logo} alt="Logo" width={48} height={48} />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign In</h1>
            <p className="text-sm text-muted-foreground">Enter your details to access your dashboard</p>
          </div>
        </div>

        <div className="card p-8 shadow-lg border-border">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={emailOrUserName}
                  onChange={(e) => setEmailOrUserName(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11 bg-muted/30"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium leading-none">Password</label>
                  <Link href="/forgot-password" title="Forgot Password" className="text-xs font-semibold text-primary hover:text-primary/80">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 bg-muted/30 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              disabled={loading || !password || !emailOrUserName}
              className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              type="submit"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Yoton Health. All rights reserved.
        </p>
      </div>
    </div>
  );
}
