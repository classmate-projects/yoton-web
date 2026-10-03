
interface SetPasswordPageType {
    password: string;
    setPassword: React.Dispatch<React.SetStateAction<string>>;
    confirmPassword: string;
    setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
    handleSubmitNewPassword: (
        e: React.FormEvent<HTMLFormElement>
    ) => Promise<void>
    setshowAskEmail: React.Dispatch<React.SetStateAction<boolean>>;
    error: string;
    isSaving: boolean;
}

import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";

export default function SetPasswordPage({
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    handleSubmitNewPassword,
    setshowAskEmail,
    error,
    isSaving,
}: SetPasswordPageType,) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    return (
        <div>
            <div className="mb-8">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <KeyRound size={22} />
                </div>
                <p className="text-sm font-semibold uppercase text-primary">
                    Create new password
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                    Update Password
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Choose a new password for your Yoton account. Use something
                    memorable and hard to guess.
                </p>
            </div>

            <form onSubmit={handleSubmitNewPassword} className="space-y-5">
                <div className="space-y-2">
                    <label
                        htmlFor="password"
                        className="required text-sm font-semibold text-foreground/90"
                    >
                        Password
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                            <LockKeyhole size={18} />
                        </span>
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="h-12 rounded-2xl border-border! bg-muted/40! pl-12! pr-12! text-base! text-foreground! placeholder:text-muted-foreground! focus-visible:bg-card!  focus-visible:ring-transparent!"
                            autoComplete="new-password"
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor="confirm_password"
                        className="required text-sm font-semibold text-foreground/90"
                    >
                        Confirm Password
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-muted-foreground">
                            <CheckCircle2 size={18} />
                        </span>
                        <input
                            id="confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="h-12 rounded-2xl border-border! bg-muted/40! pl-12! pr-12! text-base! text-foreground! placeholder:text-muted-foreground! focus-visible:bg-card!  focus-visible:ring-transparent!"
                            autoComplete="new-password"
                        />
                        <button type="button" tabIndex={-1} onClick={() => setShowConfirmPassword(s => !s)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showConfirmPassword ? <Eye size={17} /> : <EyeOff size={17} />}
                        </button>
                    </div>
                </div>

                <p className="min-h-6 text-center text-sm font-medium text-red-500">
                    {error}
                </p>

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setshowAskEmail(true)}
                        disabled={isSaving}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || !password || !confirmPassword || Boolean(error)}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Saving
                            </>
                        ) : (
                            "Save password"
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
