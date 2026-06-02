interface emailPropsTypes {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    handleEmailSubmit: (
        e: React.FormEvent<HTMLFormElement>
    ) => Promise<void>

}

import Link from "next/link";
import { HiOutlineArrowSmRight } from "react-icons/hi";

export default function AskEmailPage({ email, setEmail, handleEmailSubmit }: emailPropsTypes) {
    return (
        <>
            <div>
                <div className=" flex flex-col items-center gap-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-center text-nowrap" style={{ color: 'var(--color-text)' }}>Forgot your password?</h1>
                    <p className="font-light text-md text-center max-w-100" style={{ color: 'var(--color-text-muted)' }}>
                        Enter your email address and we&apos;ll send you a link to reset
                        your password.
                    </p>
                </div>

                <form
                    onSubmit={handleEmailSubmit}
                    className="flex flex-col gap-4 w-full mt-10">
                    <div className="w-full flex flex-col gap-2 mb-4">
                        <label htmlFor="email" className="font-bold" style={{ color: 'var(--color-text-muted)' }}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            name="email"
                            placeholder="name@company.com"
                            className="outline-0 px-4 py-2 rounded-xl"
                            style={{ backgroundColor: 'var(--color-highlight)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        />
                    </div>

                    <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>We will never share your email with anyone else.</p>

                    <button
                        type="submit"
                        className="theme-blue text-white font-bold flex items-center justify-center gap-2 w-full p-4 rounded-xl cursor-pointer transition-all duration-200 bg-blue-500 hover:bg-blue-600"
                    >
                        Send Reset Link <HiOutlineArrowSmRight /> 
                    </button>

                    <Link href="/login" className="text-center flex justify-center items-center gap-2 mt-4 transition-all duration-200 cursor-pointer hover:text-blue-400"><HiOutlineArrowSmRight className=" rotate-180" /> Return to Login</Link>
                </form>
            </div>
        </>
    )
}