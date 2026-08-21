interface emailPropsTypes {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    handleEmailSubmit: (
        e: React.FormEvent<HTMLFormElement>
    ) => Promise<void>
    isSending: boolean;

}

import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";

export default function AskEmailPage({ email, setEmail, handleEmailSubmit, isSending }: emailPropsTypes) {
    return (
        <div>
            <div className="mb-8">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck size={22} />
                </div>
                <p className="text-sm font-semibold uppercase text-primary">
                    Password recovery
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                    Forgot your password?
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
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
                        className="text-sm font-semibold text-foreground/90"
                    >
                        Email Address
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                            <Mail size={18} />
                        </span>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            name="email"
                            placeholder="name@company.com"
                            className="h-12 rounded-2xl border-border! bg-muted/40! pl-12! pr-4 text-base! text-foreground! placeholder:text-muted-foreground! focus-visible:bg-card!  focus-visible:ring-transparent!"
                            autoComplete="email"
                            required
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSending || !email}
                    className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                    {isSending ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                        </>
                    ) : (
                        <>
                            Change Password
                            <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                        </>
                    )}
                </button>

                <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                    <ArrowLeft size={16} />
                    Return to login
                </Link>
            </form>
        </div>
    )
}
