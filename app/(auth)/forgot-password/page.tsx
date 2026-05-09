import Link from "next/link";
import { HiOutlineArrowSmRight } from "react-icons/hi";

export default function ForgotPasswordPage() {
  return (
    <div className="h-dvh w-full flex justify-center items-center" style={{backgroundColor: 'var(--color-bg)'}}>
      <div className="h-dvh sm:h-fit w-full max-w-150 px-4 sm:px-16 py-8 rounded-xl shadow-xl flex flex-col justify-center items-center card">
        <div className=" flex flex-col items-center gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-nowrap" style={{color: 'var(--color-text)'}}>Forgot your password?</h1>
          <p className="font-light text-md text-center max-w-100" style={{color: 'var(--color-text-muted)'}}>
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </p>
        </div>

        <form className="flex flex-col gap-4 items-center w-full mt-10">
          <div className="w-full flex flex-col gap-2 mb-4">
            <label htmlFor="email" className="text-sm font-bold" style={{color: 'var(--color-text-muted)'}}>
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="name@company.com"
              className="outline-0 p-4 rounded-xl"
              style={{backgroundColor: 'var(--color-highlight)', border: '1px solid var(--color-border)', color: 'var(--color-text)'}}
            />
          </div>
        </form>
          <p className="text-sm" style={{color: 'var(--color-text-muted)'}}>We will never share your email with anyone else.</p>

          <button className="theme-blue text-white font-bold flex items-center justify-center gap-2 w-full p-4 rounded-xl mt-10 cursor-pointer transition-all duration-200">Send Reset Link <HiOutlineArrowSmRight /> </button>

          <Link href="/login" className="text-center flex justify-center items-center gap-2 mt-4 transition-all duration-200 cursor-pointer" style={{color: 'var(--color-accent)'}} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent-hover)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-accent)'}>><HiOutlineArrowSmRight className=" rotate-180" /> Return to Login</Link>
      </div>
    </div>
  );
}
