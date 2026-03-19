"use client";

import { useState, useRef } from "react";

interface EmailFormProps {
  size?: "default" | "large";
}

type FormState = "idle" | "loading" | "success" | "error" | "duplicate";

export default function EmailForm({ size = "default" }: EmailFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setState("success");
        setEmail("");
      } else if (res.status === 409) {
        setState("duplicate");
      } else if (res.status === 429) {
        setState("error");
        setErrorMsg("Too many requests. Please try again in a moment.");
      } else {
        setState("error");
        setErrorMsg(data?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  const isLarge = size === "large";

  if (state === "success") {
    return (
      <div
        className={`flex items-start gap-3 rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-5 py-4 ${isLarge ? "max-w-lg" : "max-w-md"}`}
        role="alert"
      >
        <span className="mt-0.5 text-[#00d4aa] text-xl">✓</span>
        <div>
          <p className={`font-semibold text-[#00d4aa] ${isLarge ? "text-base" : "text-sm"}`}>
            Check your inbox!
          </p>
          <p className={`mt-0.5 text-[#8888aa] ${isLarge ? "text-sm" : "text-xs"}`}>
            We sent a confirmation link to your email. Click it to secure your spot.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={isLarge ? "w-full max-w-lg" : "w-full max-w-md"}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
          <label htmlFor={`email-input-${size}`} className="sr-only">
            Your email address
          </label>
          <input
            ref={inputRef}
            id={`email-input-${size}`}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state !== "idle") setState("idle");
            }}
            placeholder="your@email.com"
            disabled={state === "loading"}
            className={`flex-1 rounded-xl sm:rounded-r-none border border-[#1e1e2e] bg-[#12121a] text-[#f0f0f5] placeholder-[#4a4a6a] outline-none transition-all focus:border-[#00d4aa]/60 focus:ring-2 focus:ring-[#00d4aa]/20 disabled:opacity-60 ${isLarge ? "px-5 py-4 text-base" : "px-4 py-3 text-sm"}`}
            aria-describedby={`form-hint-${size}`}
          />
          <button
            type="submit"
            disabled={state === "loading" || !email.trim()}
            className={`whitespace-nowrap rounded-xl sm:rounded-l-none bg-[#00d4aa] font-semibold text-[#0a0a0f] transition-all hover:bg-[#00bfa0] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${isLarge ? "px-7 py-4 text-base" : "px-5 py-3 text-sm"}`}
          >
            {state === "loading" ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Joining…
              </span>
            ) : (
              "Get early access"
            )}
          </button>
        </div>
      </form>

      {/* Status messages */}
      {state === "duplicate" && (
        <p
          className="mt-2 text-xs text-[#00d4aa]"
          role="status"
          id={`form-hint-${size}`}
        >
          You&apos;re already on the list! Check your inbox for the confirmation email.
        </p>
      )}
      {state === "error" && (
        <p
          className="mt-2 text-xs text-red-400"
          role="alert"
          id={`form-hint-${size}`}
        >
          {errorMsg}
        </p>
      )}
      {state === "idle" && (
        <p
          className="mt-2 text-xs text-[#4a4a6a]"
          id={`form-hint-${size}`}
        >
          No spam. Just your waitlist confirmation, then updates when we launch.
        </p>
      )}
    </div>
  );
}
