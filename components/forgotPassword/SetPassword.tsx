
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

import { ArrowLeft, CheckCircle2, KeyRound, Loader2, LockKeyhole } from "lucide-react";

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


    return (
        <div>
            <div className="mb-8">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <KeyRound size={22} />
                </div>
                <p className="text-sm font-semibold uppercase text-primary">
                    Create new password
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    Update Password
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                    Choose a new password for your Yoton account. Use something
                    memorable and hard to guess.
                </p>
            </div>

            <form onSubmit={handleSubmitNewPassword} className="space-y-5">
                <div className="space-y-2">
                    <label
                        htmlFor="password"
                        className="required text-sm font-semibold text-slate-700"
                    >
                        Password
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400">
                            <LockKeyhole size={18} />
                        </span>
                        <input
                            id="password"
                            type="password"
                            placeholder="Enter new password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-12! pr-4 text-base text-slate-950 placeholder:text-slate-400 focus-visible:bg-white"
                            autoComplete="new-password"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor="confirm_password"
                        className="required text-sm font-semibold text-slate-700"
                    >
                        Confirm Password
                    </label>
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400">
                            <CheckCircle2 size={18} />
                        </span>
                        <input
                            id="confirm_password"
                            type="password"
                            placeholder="Confirm new password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-12! pr-4 text-base text-slate-950 placeholder:text-slate-400 focus-visible:bg-white"
                            autoComplete="new-password"
                        />
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
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || !password || !confirmPassword || Boolean(error)}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-blue-500/20 transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
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
