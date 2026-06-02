interface emailPropsTypes {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    handleEmailSubmit: (
        e: React.FormEvent<HTMLFormElement>
    ) => Promise<void>

}

import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";

export default function AskEmailPage({ email, setEmail, handleEmailSubmit }: emailPropsTypes) {
    return (
        <div>
            <div className="mb-8">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck size={22} />
                </div>
                <p className="text-sm font-semibold uppercase text-primary">
                    Password recovery
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    Forgot your password?
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                    Enter your email address and we&apos;ll send you a secure reset
                    link to verify your account.
                </p>
            </div>

            <form
                onSubmit={handleEmailSubmit}
                className="space-y-5">
                <div className="space-y-2">
                    <label
                        htmlFor="email"
                        className="text-sm font-semibold text-slate-700"
                    >
                        Email Address
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400">
                            <Mail size={18} />
                        </span>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            name="email"
                            placeholder="name@company.com"
                            className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-12! pr-4 text-base text-slate-950 placeholder:text-slate-400 focus-visible:bg-white"
                            autoComplete="email"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-blue-500/20 transition-all hover:bg-primary/90 active:scale-[0.99]"
                >
                    Send reset link
                    <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </button>

                <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
                >
                    <ArrowLeft size={16} />
                    Return to login
                </Link>
            </form>
        </div>
    )
}
