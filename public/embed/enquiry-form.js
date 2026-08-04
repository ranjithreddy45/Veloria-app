/* =============================================================================
 * Veloria Grand — embeddable enquiry form
 * -----------------------------------------------------------------------------
 * Drops a styled enquiry form into any website and posts it straight into the
 * CRM (Contact + Lead, with UTM/gclid attribution and owner assignment).
 *
 * USAGE — paste this where the form should appear:
 *
 *   <div id="veloria-enquiry"></div>
 *   <script src="https://app.theveloriagrand.com/embed/enquiry-form.js" defer></script>
 *
 * Options (all optional) via data- attributes on the div:
 *   data-title      heading text            (default: "Enquire about your event")
 *   data-subtitle   supporting line
 *   data-eyebrow    small uppercase label   (default: "Veloria Grand")
 *   data-accent     brand colour            (default: emerald #006742)
 *   data-gold       accent metal            (default: #b88513)
 *   data-events     comma-separated types
 *   data-thanks     success heading
 *   data-theme      "light" (default) or "dark" for placing on a dark hero
 *   data-endpoint   override the API base   (for staging)
 *
 * WHY A SCRIPT AND NOT AN IFRAME: the app sends `X-Frame-Options: SAMEORIGIN`
 * on every route, so an iframe embed is blocked by the browser on any other
 * domain. A script that renders real DOM in the host page has no such problem,
 * inherits nothing from the host's CSS (everything is scoped + reset), and lets
 * the form auto-size naturally instead of needing postMessage height plumbing.
 *
 * NO WEBFONT IS LOADED. A luxury serif is wanted for the heading, but pulling
 * one from Google Fonts adds a third-party request that a host site's
 * Content-Security-Policy may block outright — the form would then silently
 * render in the fallback anyway. A high-quality system serif stack gets the same
 * editorial feel with zero network cost and zero CSP risk.
 * ========================================================================== */
(function () {
  "use strict";

  var MOUNT_ID = "veloria-enquiry";
  var mount = document.getElementById(MOUNT_ID);
  if (!mount) {
    // Fail loudly in the console but never throw — a broken embed must not take
    // the host page's other scripts down with it.
    console.warn('[Veloria] No <div id="' + MOUNT_ID + '"></div> found on the page.');
    return;
  }
  if (mount.getAttribute("data-veloria-ready") === "1") return; // double-include guard
  mount.setAttribute("data-veloria-ready", "1");

  var d = mount.dataset || {};
  // Derive the API base from this script's own src, so the snippet works
  // unchanged on staging without anyone editing the endpoint.
  var thisScript =
    document.currentScript || document.querySelector('script[src*="enquiry-form.js"]');
  var base =
    d.endpoint ||
    (thisScript && thisScript.src
      ? thisScript.src.replace(/\/embed\/enquiry-form\.js.*$/, "")
      : "");
  var ENDPOINT = base + "/api/landing-lead";

  var ACCENT = d.accent || "#006742"; // brand emerald
  var GOLD = d.gold || "#b88513"; // the second metal, used as a hairline only
  var DARK = (d.theme || "light").toLowerCase() === "dark";
  var EVENTS = (d.events || "Wedding,Reception,Engagement,Birthday,Corporate,Other")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var GUESTS = ["Under 100", "100–200", "200–300", "300–500", "500+", "Not sure yet"];

  var SERIF =
    "ui-serif,'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";
  var SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

  // Theme-dependent surfaces, kept in one place so dark mode is a real variant
  // rather than a pile of overrides.
  var C = DARK
    ? { card: "#15171a", cardTo: "#101215", bd: "rgba(255,255,255,.12)", ink: "#f4f4f5",
        sub: "rgba(244,244,245,.62)", field: "rgba(255,255,255,.05)", fieldBd: "rgba(255,255,255,.16)",
        shadow: "0 24px 60px -24px rgba(0,0,0,.7)" }
    : { card: "#ffffff", cardTo: "#fdfdfc", bd: "rgba(0,0,0,.08)", ink: "#1d1d1f",
        sub: "#6b6b70", field: "#fbfbfa", fieldBd: "#e2e2e5",
        shadow: "0 20px 50px -28px rgba(16,24,20,.35)" };

  var S = "#" + MOUNT_ID;
  var css = [
    // Reset first so a host site's global styles can't distort the form.
    S + " *{box-sizing:border-box;margin:0;padding:0;font-family:inherit;letter-spacing:normal;text-transform:none}",
    S + "{--vg:" + ACCENT + ";--vgold:" + GOLD + ";max-width:36rem;font-family:" + SANS +
      ";color:" + C.ink + ";line-height:1.5;text-align:left}",

    // Card — soft gradient + a GOLD hairline at the very top. The hairline is the
    // whole brand cue: emerald does the work, gold is a thread, never a fill.
    S + " .vg-card{position:relative;overflow:hidden;background:linear-gradient(180deg," + C.card +
      " 0%," + C.cardTo + " 100%);border:1px solid " + C.bd +
      ";border-radius:20px;padding:28px 26px;box-shadow:" + C.shadow + "}",
    S + " .vg-card::before{content:'';position:absolute;inset:0 0 auto 0;height:2px;" +
      "background:linear-gradient(90deg,transparent,var(--vgold) 22%,var(--vgold) 78%,transparent);opacity:.85}",
    "@media(max-width:420px){" + S + " .vg-card{padding:22px 18px;border-radius:16px}}",

    // Editorial header.
    S + " .vg-eyebrow{font-family:" + SANS + ";font-size:10.5px;font-weight:600;letter-spacing:.18em;" +
      "text-transform:uppercase;color:var(--vgold);margin-bottom:9px}",
    S + " .vg-h{font-family:" + SERIF + ";font-size:27px;line-height:1.18;font-weight:600;letter-spacing:-.011em;color:" + C.ink + "}",
    "@media(max-width:420px){" + S + " .vg-h{font-size:23px}}",
    S + " .vg-sub{font-size:14px;line-height:1.45;color:" + C.sub + ";margin-top:6px;max-width:44ch}",
    // 32ch forced this to three lines in a 560px card. At 44ch it sets in two,
    // which is ~20px of hero height for no change to the words.
    S + " .vg-rule{height:1px;background:" + C.bd + ";margin:16px 0 2px}",

    // Fields.
    S + " .vg-row{margin-top:13px}",
    S + " .vg-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
    // Stack on the CONTAINER's width, not the viewport's.
    //
    // This is an embed: the host decides how much room it gets. A viewport
    // query says "the window is 1400px wide, go two-up" even when the form has
    // been dropped into a 320px sidebar — and then two inputs share 320px and
    // look broken. @container asks the only question that matters, which is how
    // wide THIS form is.
    "@supports (container-type: inline-size){" + S + "{container-type:inline-size}" +
      "@container (max-width:460px){" + S + " .vg-two{grid-template-columns:1fr;gap:13px}}}",
    // Fallback for browsers without container queries — a visitor on an old
    // phone must still get a usable form, not a broken one.
    "@supports not (container-type: inline-size){@media(max-width:460px){" +
      S + " .vg-two{grid-template-columns:1fr;gap:13px}}}",
    S + " label{display:block;font-size:12px;font-weight:600;letter-spacing:.01em;color:" + C.ink + ";margin-bottom:6px}",
    S + " .vg-opt{font-weight:500;color:" + C.sub + "}",
    // 16px minimum: iOS Safari force-zooms the page when a focused field is
    // smaller, which yanks the host layout sideways mid-typing.
    S + " input,"+S+" select{width:100%;height:48px;padding:0 14px;font-size:16px;color:" + C.ink +
      ";background:" + C.field + ";border:1px solid " + C.fieldBd +
      ";border-radius:12px;outline:none;appearance:none;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s,background .15s}",
    S + " input::placeholder{color:" + C.sub + ";opacity:.75}",
    S + " input:hover,"+S+" select:hover{border-color:" + (DARK ? "rgba(255,255,255,.26)" : "#cfcfd4") + "}",
    S + " input:focus,"+S+" select:focus{border-color:var(--vg);background:" + (DARK ? "rgba(255,255,255,.07)" : "#fff") +
      ";box-shadow:0 0 0 3.5px color-mix(in srgb,var(--vg) 16%,transparent)}",
    S + " .vg-bad input,"+S+" .vg-bad select{border-color:#c0392b}",
    S + " .vg-f{min-width:0}",
    S + " .vg-saved{display:flex;align-items:flex-start;gap:8px;margin-top:14px;padding:10px 12px;border-radius:11px;" +
      "font-size:13.5px;line-height:1.45;color:" + C.ink + ";background:color-mix(in srgb,var(--vg) 9%,transparent);" +
      "border:1px solid color-mix(in srgb,var(--vg) 22%,transparent)}",
    S + " .vg-saved strong{font-weight:600}",
    S + " .vg-tick{flex:0 0 auto;font-weight:700;color:var(--vg)}",
    // Native select arrows are ugly and inconsistent across browsers; draw our own.
    S + " .vg-sel{position:relative}",
    S + " .vg-sel::after{content:'';position:absolute;right:15px;top:50%;width:7px;height:7px;pointer-events:none;" +
      "border-right:1.6px solid " + C.sub + ";border-bottom:1.6px solid " + C.sub + ";transform:translateY(-70%) rotate(45deg)}",
    S + " select{padding-right:36px}",

    // Submit — emerald with a soft sheen, matching the app's primary button.
    S + " button{position:relative;overflow:hidden;width:100%;height:52px;margin-top:18px;border:0;border-radius:14px;" +
      "background:linear-gradient(180deg,var(--vg) 0%,color-mix(in srgb,var(--vg) 88%,#000) 100%);" +
      "color:#fff;font-size:15.5px;font-weight:600;letter-spacing:.005em;cursor:pointer;" +
      "box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 10px 22px -12px color-mix(in srgb,var(--vg) 70%,transparent);" +
      "transition:transform .12s,filter .15s,box-shadow .15s}",
    S + " button:hover{filter:brightness(1.06)}",
    S + " button:active{transform:translateY(1px)}",
    S + " button[disabled]{opacity:.62;cursor:default;transform:none;filter:none}",

    S + " .vg-err{color:#c0392b;font-size:12.5px;margin-top:10px;min-height:1.1em}",
    S + " .vg-fine{display:flex;align-items:center;justify-content:center;gap:6px;" +
      "font-size:11.5px;color:" + C.sub + ";margin-top:14px}",

    // Success.
    S + " .vg-ok{text-align:center;padding:34px 10px 30px}",
    S + " .vg-tick{width:52px;height:52px;border-radius:999px;margin:0 auto 16px;display:flex;align-items:center;" +
      "justify-content:center;background:linear-gradient(180deg,var(--vg),color-mix(in srgb,var(--vg) 85%,#000));" +
      "box-shadow:0 0 0 1px color-mix(in srgb,var(--vgold) 55%,transparent),0 10px 24px -12px rgba(0,0,0,.5)}",
    S + " .vg-tick svg{width:24px;height:24px;stroke:#fff;stroke-width:2.4;fill:none}",
    S + " .vg-ok .vg-h{font-size:23px}",
    // Honeypot: visually gone, still focusable-free for real users.
    S + " .vg-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}",
  ].join("");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function optionsHtml(list, placeholder) {
    return (
      '<option value="">' + placeholder + "</option>" +
      list.map(function (o) { return '<option value="' + o + '">' + o + "</option>"; }).join("")
    );
  }

  mount.innerHTML =
    '<form class="vg-card" novalidate>' +
      '<div class="vg-eyebrow">' + (d.eyebrow || "Veloria Grand") + "</div>" +
      '<div class="vg-h">' + (d.title || "Enquire about your event") + "</div>" +
      '<div class="vg-sub">' +
        (d.subtitle || "Share a few details and our team will call you back with availability and pricing.") +
      "</div>" +
      '<div class="vg-rule"></div>' +

      // THREE paired rows, not five stacked ones.
      //
      // Same six fields — none dropped, because every one of them is what makes
      // the callback useful — but the form is a hero element on the landing
      // page, and five full-width rows made it taller than the headline it sits
      // beside. Short inputs (name, phone, date) do not need 560px of width;
      // giving it to them cost ~145px of height for nothing.
      //
      // Below the container breakpoint every pair stacks, so the phone layout
      // is unchanged.
      '<div class="vg-row vg-two">' +
        '<div class="vg-f"><label for="vg-name">Your name</label>' +
          '<input id="vg-name" name="name" autocomplete="name" placeholder="e.g. Ananya Rao"></div>' +
        '<div class="vg-f"><label for="vg-phone">Mobile number</label>' +
          '<input id="vg-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile"></div>' +
      "</div>" +

      // ---- STEP 2 ----
      // Hidden until the lead is saved. The hero only ever shows name + mobile,
      // which is the whole reason the form fits beside the headline now.
      '<div class="vg-step2" hidden>' +
        '<div class="vg-saved">' +
          '<span class="vg-tick">\u2713</span> Got it — we have your number. ' +
          '<strong>A few details so we can quote accurately.</strong>' +
        "</div>" +
      '<div class="vg-row vg-two">' +
        '<div class="vg-f"><label for="vg-email">Email address</label>' +
          '<input id="vg-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>' +
        '<div class="vg-f"><label for="vg-date">Preferred date</label>' +
          '<input id="vg-date" name="date" type="date"></div>' +
      "</div>" +

      '<div class="vg-row vg-two">' +
        '<div class="vg-f"><label for="vg-event">Occasion</label>' +
          '<div class="vg-sel"><select id="vg-event" name="eventType">' + optionsHtml(EVENTS, "Select") + "</select></div></div>" +
        '<div class="vg-f"><label for="vg-guests">Guests</label>' +
          '<div class="vg-sel"><select id="vg-guests" name="guests">' + optionsHtml(GUESTS, "Select") + "</select></div></div>" +
      "</div>" +
      "</div>" +

      // Bots fill every field they can see; a human never sees this one.
      '<div class="vg-hp" aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div>' +

      '<div class="vg-err" role="alert" aria-live="polite"></div>' +
      "<button type=submit>Check availability</button>" +
      '<div class="vg-fine">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
        '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' +
        "Your details are used only to answer this enquiry." +
      "</div>" +
    "</form>";

  var form = mount.querySelector("form");
  var errEl = mount.querySelector(".vg-err");
  var btn = mount.querySelector("button");
  var step2 = mount.querySelector(".vg-step2");
  // Which half of the form we are on, and the token authorising the second.
  var step = 1;
  var enrichToken = null;

  function markBad(input, bad) {
    // Scope the outline to the FIELD, never the row.
    //
    // Every field now shares a .vg-row with a neighbour, so falling back to the
    // row would redden BOTH when only one is missing — telling the visitor two
    // things are wrong when one is. .vg-f wraps exactly one field.
    var target = input.closest(".vg-sel") || input.closest(".vg-f") || input.parentNode;
    if (target && target.classList) target.classList.toggle("vg-bad", !!bad);
  }
  // Clear the error styling as soon as the visitor starts correcting it.
  ["name", "phone", "email", "eventType", "guests", "date"].forEach(function (n) {
    var el = form[n];
    // "change" as well as "input": a <select> in Safari fires only change.
    ["input", "change"].forEach(function (evt) {
      el.addEventListener(evt, function () { markBad(el, false); errEl.textContent = ""; });
    });
  });

  /** Read a query param off the HOST page so paid traffic keeps attribution. */
  function q(name) {
    try { return new URLSearchParams(window.location.search).get(name) || undefined; }
    catch (_) { return undefined; }
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    errEl.textContent = "";
    // Clear EVERY previous outline, not just name/phone — otherwise a field
    // flagged on an earlier attempt stays red after the visitor has fixed it.
    ["name", "phone", "email", "eventType", "guests", "date"].forEach(function (n) {
      markBad(form[n], false);
    });

    // Silently accept-and-drop a bot rather than telling it what failed.
    if (form.company && form.company.value) {
      mount.innerHTML = successHtml();
      return;
    }

    // EVERY field is required. Validated in visual order so the message always
    // refers to the first thing the visitor still needs to fill, and the field
    // itself is outlined and focused rather than just described in prose.
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    if (!name) {
      errEl.textContent = "Please enter your name.";
      markBad(form.name, true); form.name.focus(); return;
    }
    var digits = phone.replace(/\D/g, "");
    // Mirror the server's rule so the visitor is corrected BEFORE a round-trip.
    var intl = phone.charAt(0) === "+" || digits.indexOf("00") === 0;
    if (digits.length < 7 || digits.length > 15 ||
        (!intl && !/^[6-9]\d{9}$/.test(digits.replace(/^0+/, "")))) {
      errEl.textContent = "Enter a 10-digit Indian mobile, or include your country code (e.g. +44…).";
      markBad(form.phone, true); form.phone.focus(); return;
    }
    // ---- STEP 2 validation (only once the lead is already saved) ----
    if (step === 2) {
      var email = form.email.value.trim();
      // Same shape the server accepts, checked here so the visitor is
      // corrected before a round-trip rather than after one.
      if (!email || !/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email)) {
        errEl.textContent = "Please enter a valid email address.";
        markBad(form.email, true); form.email.focus(); return;
      }
      // Date is checked BEFORE the two selects because it sits above them.
      if (!form.date.value) {
        errEl.textContent = "Please pick your preferred date.";
        markBad(form.date, true); form.date.focus(); return;
      }
      if (!form.eventType.value) {
        errEl.textContent = "Please choose the occasion.";
        markBad(form.eventType, true); form.eventType.focus(); return;
      }
      if (!form.guests.value) {
        errEl.textContent = "Please choose an approximate guest count.";
        markBad(form.guests, true); form.guests.focus(); return;
      }

      btn.disabled = true;
      btn.textContent = "Sending…";
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrichToken: enrichToken,
          email: email,
          eventType: form.eventType.value,
          guests: form.guests.value,
          date: form.date.value,
        }),
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function () { mount.innerHTML = successHtml(); })
        .catch(function () {
          // The LEAD IS ALREADY SAVED. There is nothing useful for the visitor
          // to retry and no reason to alarm them, so finish the journey.
          mount.innerHTML = successHtml();
        });
      return;
    }

    // ---- STEP 1: save the lead on name + mobile alone ----
    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = "Checking…";

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: phone,
        page: window.location.href,
        landing_url: window.location.href,
        referrer: document.referrer || undefined,
        submittedAt: new Date().toISOString(),
        utm_source: q("utm_source"), utm_medium: q("utm_medium"),
        utm_campaign: q("utm_campaign"), utm_term: q("utm_term"), utm_content: q("utm_content"),
        gclid: q("gclid"), gbraid: q("gbraid"), wbraid: q("wbraid"), fbclid: q("fbclid"),
      }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.body || res.body.ok !== true) {
          throw new Error((res.body && res.body.error) || "Could not send your enquiry.");
        }
        // The lead is SAVED. From here the visitor can walk away and still be
        // followed up — which is the entire reason for splitting the form.
        try {
          window.dispatchEvent(
            new CustomEvent("veloria:enquiry-submitted", { detail: { leadId: res.body.leadId } })
          );
        } catch (_) {}

        enrichToken = res.body.enrichToken;
        if (!enrichToken) {
          // No token means step 2 could not be applied to anything. Do not show
          // fields that would silently discard what the visitor types.
          mount.innerHTML = successHtml();
          return;
        }

        step = 2;
        step2.hidden = false;
        errEl.textContent = "";
        btn.disabled = false;
        btn.textContent = "Complete my enquiry";
        // Move focus into the newly revealed section so keyboard and screen
        // reader users are not left on a button whose meaning just changed.
        try { form.email.focus({ preventScroll: true }); } catch (_) { form.email.focus(); }
      })
      .catch(function (e) {
        // Never leave the visitor stuck with a dead button.
        errEl.textContent = e.message || "Something went wrong. Please call us instead.";
        btn.disabled = false;
        btn.textContent = original;
      });
  });

  function successHtml() {
    return (
      '<div class="vg-card vg-ok">' +
        '<div class="vg-tick"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>' +
        '<div class="vg-h">' + (d.thanks || "Thank you — we have your enquiry.") + "</div>" +
        '<div class="vg-sub" style="margin:8px auto 0">Our team will call you back shortly.</div>' +
      "</div>"
    );
  }
})();
