"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { confirmTotpSetup, disableTotp, startTotpSetup } from "./actions";

export function TwoStepPanel({ enabledAt }: { enabledAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string; setupToken: string } | null>(null);
  const [code, setCode] = useState("");
  const [turningOff, setTurningOff] = useState(false);

  const codeInput = (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      placeholder="123456"
      value={code}
      onChange={(e) => setCode(e.target.value)}
      className="w-36 rounded-md border border-zinc-300 px-3 py-2 text-lg tracking-[0.3em]"
    />
  );

  if (enabledAt) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-zinc-900">Two-step sign-in is on</div>
            <div className="text-sm text-zinc-500">
              Since {new Date(enabledAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. You&apos;ll be asked for a code from your authenticator app each time you sign in.
            </div>
          </div>
          {!turningOff && (
            <button type="button" className={buttonStyles("secondary", "sm")} onClick={() => setTurningOff(true)}>
              Turn off
            </button>
          )}
        </div>
        {turningOff && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const r = await disableTotp(code);
                if (r.error) setError(r.error);
                else {
                  setTurningOff(false);
                  setCode("");
                  router.refresh();
                }
              });
            }}
          >
            <span className="text-sm text-zinc-600">Enter a current code to turn it off:</span>
            {codeInput}
            <button type="submit" disabled={pending} className={buttonStyles("primary", "sm")}>
              {pending ? "…" : "Turn off"}
            </button>
          </form>
        )}
        {error && <p className="text-sm text-[var(--danger-soft-text)]">{error}</p>}
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <div className="font-semibold text-zinc-900">Two-step sign-in is off</div>
          <div className="text-sm text-zinc-500">
            Add a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others) to your password, so a stolen password alone can&apos;t get into this account.
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          className={buttonStyles("primary", "sm", "self-start")}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await startTotpSetup();
              if ("error" in r) setError(r.error);
              else setSetup(r);
            });
          }}
        >
          {pending ? "…" : "Set up two-step sign-in"}
        </button>
        {error && <p className="text-sm text-[var(--danger-soft-text)]">{error}</p>}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await confirmTotpSetup(setup.setupToken, code);
          if (r.error) setError(r.error);
          else {
            setSetup(null);
            setCode("");
            router.refresh();
          }
        });
      }}
    >
      <div>
        <div className="font-semibold text-zinc-900">1. Scan this with your authenticator app</div>
        <div className="mt-3 flex flex-wrap items-center gap-5">
          <div className="h-[200px] w-[200px] rounded-lg border border-zinc-200 bg-white" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
          <div className="text-sm text-zinc-600">
            Can&apos;t scan it? Add an account by hand with this key:
            <code className="mt-1 block break-all rounded bg-zinc-100 px-2 py-1 font-mono text-[13px] tracking-wider text-zinc-900">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
          </div>
        </div>
      </div>
      <div>
        <div className="font-semibold text-zinc-900">2. Enter the 6-digit code it shows</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {codeInput}
          <button type="submit" disabled={pending} className={buttonStyles("primary", "sm")}>
            {pending ? "…" : "Turn on"}
          </button>
          <button type="button" className={buttonStyles("ghost", "sm")} onClick={() => { setSetup(null); setCode(""); setError(null); }}>
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-[var(--danger-soft-text)]">{error}</p>}
    </form>
  );
}
