"use client";

import * as React from "react";
import { DRAW_EVENT_TYPES } from "@/lib/draw";

// ============================================================
// Public Guest-Draw form — faithful React port of the approved
// Veloria Grand design. Talks to POST /api/draw/entries (the server
// is authoritative). NO admin/staff features live here — those are at
// /admin/draw behind login.
// ============================================================

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

// Client-side validation mirrors the server; the server still decides.
const DEFAULT_MSG = {
  name: "Please enter your name.",
  phone: "Enter a valid 10-digit mobile number.",
  host: "Please tell us the host's name.",
  etype: "Please choose the event type.",
  edate: "Please pick the event date.",
} as const;

type FieldKey = keyof typeof DEFAULT_MSG;

// Map server field names → our local field keys.
const SERVER_FIELD: Record<string, FieldKey | "consent"> = {
  guest_name: "name",
  phone: "phone",
  host_name: "host",
  event_type: "etype",
  event_date: "edate",
  consent_whatsapp: "consent",
};

const GENERIC_ERROR = "Couldn't submit — check your connection.";

function todayISO(): string {
  const d = new Date();
  // Local calendar date, formatted YYYY-MM-DD.
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function DrawForm() {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [host, setHost] = React.useState("");
  const [etype, setEtype] = React.useState("");
  const [edate, setEdate] = React.useState("");
  const [consent, setConsent] = React.useState(false); // unticked by default

  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [consentErr, setConsentErr] = React.useState(false);

  const [view, setView] = React.useState<"form" | "success">("form");
  const [entryCode, setEntryCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [netError, setNetError] = React.useState<string | null>(null);

  const [src, setSrc] = React.useState<"qr" | "tablet">("qr");

  // Default the date to today + read ?src= — client-only to avoid hydration drift.
  React.useEffect(() => {
    setEdate(todayISO());
    const s = new URLSearchParams(window.location.search).get("src");
    if (s === "tablet" || s === "qr") setSrc(s);
  }, []);

  function validate(): boolean {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) e.name = DEFAULT_MSG.name;
    if (!INDIAN_MOBILE_RE.test(phone.trim())) e.phone = DEFAULT_MSG.phone;
    if (!host.trim()) e.host = DEFAULT_MSG.host;
    if (!etype) e.etype = DEFAULT_MSG.etype;
    if (!edate) e.edate = DEFAULT_MSG.edate;
    setErrors(e);
    const consentOk = consent;
    setConsentErr(!consentOk);
    return Object.keys(e).length === 0 && consentOk;
  }

  function applyServerFieldError(field: string | undefined, msg: string) {
    const key = field ? SERVER_FIELD[field] : undefined;
    if (key === "consent") {
      setConsentErr(true);
      setErrors({});
      return;
    }
    if (key) {
      setConsentErr(false);
      setErrors({ [key]: msg });
      return;
    }
    // Unknown field — surface generically so the guest still sees something.
    setNetError(msg || GENERIC_ERROR);
  }

  // The actual POST. Reused by the Retry button, so a flaky Wi-Fi failure
  // never loses the guest's typed data.
  async function doSubmit() {
    setSubmitting(true);
    setNetError(null);
    try {
      const res = await fetch(`/api/draw/entries?src=${encodeURIComponent(src)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name.trim(),
          phone: phone.trim(),
          host_name: host.trim(),
          event_type: etype,
          event_date: edate,
          consent_whatsapp: consent,
        }),
      });

      if (res.status === 201) {
        const data = await res.json(); // throws on non-JSON → caught below
        if (!data?.entry_code) throw new Error("missing entry_code");
        setEntryCode(String(data.entry_code));
        setView("success");
        setSubmitting(false);
        window.scrollTo(0, 0);
        return;
      }

      if (res.status === 422 || res.status === 409) {
        const data = await res.json();
        applyServerFieldError(data?.field, data?.error);
        setSubmitting(false);
        return;
      }

      if (res.status === 429) {
        let data: { error?: string } | null = null;
        try {
          data = await res.json();
        } catch {
          /* keep null */
        }
        setNetError(data?.error || "Too many requests. Please try again in a little while.");
        setSubmitting(false);
        return;
      }

      // 5xx / anything else → treat as a transient failure (offline-tolerant).
      throw new Error(`unexpected status ${res.status}`);
    } catch {
      // Network error, non-JSON body, or 5xx: keep the form + typed data,
      // show a retryable inline banner, re-enable the button.
      setNetError(GENERIC_ERROR);
      setSubmitting(false);
    }
  }

  function onSubmit() {
    setNetError(null);
    if (!validate()) return;
    void doSubmit();
  }

  function enterAnother() {
    setName("");
    setPhone("");
    setHost("");
    setEtype("");
    setConsent(false);
    setErrors({});
    setConsentErr(false);
    setNetError(null);
    setEntryCode("");
    setEdate(todayISO());
    setView("form");
    window.scrollTo(0, 0);
  }

  return (
    <div className="vgd-root">
      <div className="meander" aria-hidden="true" />
      <div className="wrap">
        {view === "form" ? (
          <div id="formView">
            <div className="monogram">VG</div>
            <h1>Veloria Grand</h1>
            <div className="tag">Monthly Guest Draw</div>
            <div className="rule" aria-hidden="true" />
            <p className="intro">
              You celebrated with us today — enter our monthly draw for a gift hamper. One
              entry per guest per event. No purchase or review required.
            </p>

            <div className={`field${errors.name ? " invalid" : ""}`}>
              <label htmlFor="name">Your name</label>
              <input
                type="text"
                id="name"
                autoComplete="name"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="err">{errors.name || DEFAULT_MSG.name}</div>
            </div>

            <div className={`field${errors.phone ? " invalid" : ""}`}>
              <label htmlFor="phone">Mobile number</label>
              <input
                type="tel"
                id="phone"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="err">{errors.phone || DEFAULT_MSG.phone}</div>
            </div>

            <div className={`field${errors.host ? " invalid" : ""}`}>
              <label htmlFor="host">Host name (whose event did you attend?)</label>
              <input
                type="text"
                id="host"
                placeholder="e.g. Sharma family"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
              <div className="err">{errors.host || DEFAULT_MSG.host}</div>
            </div>

            <div className={`field${errors.etype ? " invalid" : ""}`}>
              <label htmlFor="etype">Event type</label>
              <select id="etype" value={etype} onChange={(e) => setEtype(e.target.value)}>
                <option value="">Select event type</option>
                {DRAW_EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="err">{errors.etype || DEFAULT_MSG.etype}</div>
            </div>

            <div className={`field${errors.edate ? " invalid" : ""}`}>
              <label htmlFor="edate">Event date</label>
              <input
                type="date"
                id="edate"
                value={edate}
                onChange={(e) => setEdate(e.target.value)}
              />
              <div className="err">{errors.edate || DEFAULT_MSG.edate}</div>
            </div>

            <div className="consent">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I agree that Veloria Grand may contact me on WhatsApp about the draw result and
                future offers. I can opt out anytime.
              </span>
            </div>
            {consentErr ? (
              <div className="err" id="consentErr" style={{ display: "block", margin: "-14px 0 14px" }}>
                Please tick the consent box to enter.
              </div>
            ) : null}

            {netError ? (
              <div className="neterr" role="alert">
                <span>{netError}</span>
                <button type="button" className="retry" onClick={() => void doSubmit()} disabled={submitting}>
                  Retry
                </button>
              </div>
            ) : null}

            <button className="primary" id="submitBtn" onClick={onSubmit} disabled={submitting}>
              {submitting ? "Entering…" : "Enter the draw"}
            </button>
            <p className="fine">
              Winner drawn on the 1st of every month and announced on our Instagram. Draw entry
              is free — no purchase or review required. Your details stay with Veloria Grand and
              are stored in this shared entry register.
            </p>
          </div>
        ) : (
          <div className="success" style={{ display: "block" }}>
            <div className="monogram">VG</div>
            <h2>You&apos;re in the draw</h2>
            <p>
              Thank you for celebrating at Veloria Grand. If your name is drawn, we&apos;ll
              message you on WhatsApp.
            </p>
            <div className="entryno">Entry No. {entryCode}</div>
            <p style={{ marginTop: 26 }}>
              <button className="primary" onClick={enterAnother} style={{ maxWidth: 280 }}>
                Enter another guest
              </button>
            </p>
          </div>
        )}
      </div>
      <div className="meander" aria-hidden="true" style={{ marginTop: "auto" }} />

      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@400;500&display=swap");

        .vgd-root {
          --ivory: #f7f3ea;
          --ink: #1e2a24;
          --gold: #b08d3e;
          --gold-soft: #d9c08a;
          --green-deep: #24382f;
          --error: #8c3b2e;
          /* Break out of the public layout's centered, padded <main> so the
             design is full-bleed as intended. */
          width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-top: -3rem;
          margin-bottom: -3rem;
          min-height: 100vh;
          background: var(--ivory);
          color: var(--ink);
          font-family: "Jost", sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .vgd-root :global(*) {
          box-sizing: border-box;
        }

        /* Greek-key meander band — the brand signature */
        .meander {
          width: 100%;
          height: 26px;
          background: var(--green-deep);
          background-image: repeating-linear-gradient(
            90deg,
            transparent 0 4px,
            var(--gold) 4px 6px,
            transparent 6px 10px,
            var(--gold) 10px 12px,
            transparent 12px 16px,
            var(--gold) 16px 18px,
            transparent 18px 26px
          );
          background-size: 26px 12px;
          background-position: center;
          background-repeat: repeat-x;
        }
        .wrap {
          width: 100%;
          max-width: 480px;
          padding: 28px 22px 48px;
        }
        .monogram {
          width: 74px;
          height: 74px;
          border: 2px solid var(--gold);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
          font-family: "Cinzel", serif;
          font-size: 26px;
          color: var(--green-deep);
          letter-spacing: 2px;
          position: relative;
        }
        .monogram::after {
          content: "";
          position: absolute;
          inset: 5px;
          border: 1px solid var(--gold-soft);
          border-radius: 50%;
        }
        h1 {
          font-family: "Cinzel", serif;
          font-weight: 600;
          font-size: 22px;
          text-align: center;
          letter-spacing: 3px;
          color: var(--green-deep);
          text-transform: uppercase;
        }
        .tag {
          font-family: "Cormorant Garamond", serif;
          font-style: italic;
          font-size: 18px;
          text-align: center;
          color: var(--gold);
          margin: 6px 0 4px;
        }
        .rule {
          width: 56px;
          height: 1px;
          background: var(--gold);
          margin: 16px auto 22px;
          position: relative;
        }
        .rule::before,
        .rule::after {
          content: "";
          position: absolute;
          top: -2px;
          width: 5px;
          height: 5px;
          background: var(--gold);
          transform: rotate(45deg);
        }
        .rule::before {
          left: -10px;
        }
        .rule::after {
          right: -10px;
        }
        .intro {
          font-family: "Cormorant Garamond", serif;
          font-size: 17px;
          line-height: 1.5;
          text-align: center;
          color: var(--ink);
          margin-bottom: 26px;
        }
        label {
          display: block;
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--green-deep);
          margin: 0 0 6px;
          font-weight: 500;
        }
        .field {
          margin-bottom: 18px;
        }
        input[type="text"],
        input[type="tel"],
        input[type="date"],
        select {
          width: 100%;
          padding: 13px 14px;
          font-family: "Jost", sans-serif;
          font-size: 16px;
          color: var(--ink);
          background: #fff;
          border: 1px solid #cdc4ae;
          border-radius: 2px;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
        }
        input:focus,
        select:focus {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px rgba(176, 141, 62, 0.18);
        }
        select {
          background-image: linear-gradient(45deg, transparent 50%, var(--gold) 50%),
            linear-gradient(135deg, var(--gold) 50%, transparent 50%);
          background-position: calc(100% - 20px) 50%, calc(100% - 15px) 50%;
          background-size: 5px 5px;
          background-repeat: no-repeat;
        }
        .consent {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin: 4px 0 22px;
        }
        .consent input {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: var(--gold);
        }
        .consent span {
          font-size: 13px;
          line-height: 1.45;
          color: #4a5a50;
        }
        button.primary {
          width: 100%;
          padding: 15px;
          background: var(--green-deep);
          color: var(--ivory);
          font-family: "Cinzel", serif;
          font-size: 14px;
          letter-spacing: 3px;
          text-transform: uppercase;
          border: none;
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.2s;
        }
        button.primary:hover {
          background: #2f4a3e;
        }
        button.primary:focus-visible {
          outline: 3px solid var(--gold);
          outline-offset: 2px;
        }
        button.primary:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .err {
          color: var(--error);
          font-size: 13px;
          margin-top: 5px;
          display: none;
        }
        .field.invalid .err {
          display: block;
        }
        .field.invalid input,
        .field.invalid select {
          border-color: var(--error);
        }
        .fine {
          font-size: 11.5px;
          color: #7a8078;
          text-align: center;
          line-height: 1.5;
          margin-top: 18px;
        }
        /* Offline / transient failure banner — never lose typed data. */
        .neterr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #fbeee9;
          border: 1px solid var(--error);
          border-radius: 2px;
          padding: 11px 13px;
          margin-bottom: 16px;
          font-size: 13px;
          color: var(--error);
        }
        .neterr .retry {
          flex: none;
          padding: 7px 14px;
          font-family: "Jost", sans-serif;
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          background: var(--error);
          color: #fff;
          border: none;
          border-radius: 2px;
          cursor: pointer;
        }
        .neterr .retry:disabled {
          opacity: 0.55;
          cursor: wait;
        }
        .neterr .retry:focus-visible {
          outline: 3px solid var(--gold);
          outline-offset: 2px;
        }
        /* Success state */
        .success {
          text-align: center;
          padding-top: 14px;
        }
        .success .monogram {
          width: 88px;
          height: 88px;
          font-size: 30px;
        }
        .success h2 {
          font-family: "Cinzel", serif;
          font-size: 20px;
          letter-spacing: 2px;
          color: var(--green-deep);
          margin-bottom: 10px;
        }
        .success p {
          font-family: "Cormorant Garamond", serif;
          font-size: 18px;
          line-height: 1.5;
          max-width: 320px;
          margin: 0 auto 8px;
        }
        .entryno {
          font-family: "Jost", sans-serif;
          font-size: 13px;
          letter-spacing: 2px;
          color: var(--gold);
          text-transform: uppercase;
          margin-top: 14px;
        }
        @media (prefers-reduced-motion: no-preference) {
          .wrap > :global(div) {
            animation: rise 0.5s ease both;
          }
          @keyframes rise {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }
        }
      `}</style>
    </div>
  );
}
