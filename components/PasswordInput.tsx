import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  containerClassName?: string;
}

export default function PasswordInput({ containerClassName, className, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${containerClassName ?? ""}`}>
      <input
        {...props}
        type={show ? "text" : "password"}
        autoComplete={props.autoComplete ?? "new-password"}
        className={`pr-10 ${className ?? "h-10 w-full text-sm"}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  );
}
