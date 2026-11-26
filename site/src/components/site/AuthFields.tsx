import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export const authInputClass = "h-12 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none transition focus:border-forest focus:ring-2 focus:ring-sage/40";

export function AuthField({ id, label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string | undefined }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input id={id} className={authInputClass} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function PasswordField({ id, label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string | undefined }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} className={`${authInputClass} pr-12`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />
        <button type="button" onClick={() => setShow((value) => !value)} className="absolute right-1 top-1 grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-sand" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}
