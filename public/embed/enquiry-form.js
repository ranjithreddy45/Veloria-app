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
 *   data-property   property key for a property page (hosa_road, electronic_city,
 *                   hsr, indiranagar, bellandur, yelahanka, kr_puram). Sent as a
 *                   hidden field. Without it the form shows a required Venue list.
 *   data-whatsapp   WhatsApp number for the follow-up / fallback (default 918884331096)
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

  var ACCENT = d.accent || "#006742"; // brand emerald — focus rings, success tick
  var GOLD = d.gold || "#b88513"; // the second metal, used as a hairline only
  // Primary CTA colour. Defaults to the site's champagne gold so the button
  // matches the maroon/gold marketing site instead of the emerald app. Override
  // per-site with data-cta="#rrggbb".
  var CTA = d.cta || "#c9a24b";
  var CTA_INK = d.ctaInk || "#2a1c07"; // dark text — gold needs a dark label to stay legible
  var DARK = (d.theme || "light").toLowerCase() === "dark";
  var EVENTS = (d.events || "Wedding,Reception,Engagement,Birthday Party,Corporate Event,Baby Shower,Anniversary,Other")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
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
    S + "{--vg:" + ACCENT + ";--vgold:" + GOLD + ";--vgcta:" + CTA + ";--vgctaink:" + CTA_INK + ";max-width:36rem;font-family:" + SANS +
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
    S + " input:not([type=checkbox]),"+S+" select{width:100%;height:48px;padding:0 14px;font-size:16px;color:" + C.ink +
      ";background:" + C.field + ";border:1px solid " + C.fieldBd +
      ";border-radius:12px;outline:none;appearance:none;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s,background .15s}",
    S + " input::placeholder{color:" + C.sub + ";opacity:.75}",
    S + " input:not([type=checkbox]):hover,"+S+" select:hover{border-color:" + (DARK ? "rgba(255,255,255,.26)" : "#cfcfd4") + "}",
    S + " input:not([type=checkbox]):focus,"+S+" select:focus{border-color:var(--vg);background:" + (DARK ? "rgba(255,255,255,.07)" : "#fff") +
      ";box-shadow:0 0 0 3.5px color-mix(in srgb,var(--vg) 16%,transparent)}",
    S + " .vg-bad input,"+S+" .vg-bad select{border-color:#c0392b}",
    S + " .vg-f{min-width:0}",
    S + " .vg-consent[hidden]{display:none}",
    S + " .vg-consent{display:flex;align-items:flex-start;gap:9px;margin-top:15px;font-size:12.5px;" +
      "line-height:1.5;font-weight:400;color:" + C.sub + ";cursor:pointer}",
    // Consent text must stay readable — it is the record of what was agreed.
    // appearance:auto is the POINT of this rule, not decoration. The generic
    // field styling above once applied appearance:none to every input, which
    // strips a checkbox of its native tick — so ticking it changed nothing a
    // visitor could see, on the one control that is a legal record of consent.
    S + " .vg-consent input[type=checkbox]{appearance:auto;-webkit-appearance:checkbox;" +
      "width:17px;height:17px;flex:0 0 auto;margin-top:1px;padding:0;" +
      "accent-color:var(--vg);cursor:pointer}",
    S + " .vg-bad.vg-consent span{color:#c0392b}",
    S + " .vg-saved{display:flex;align-items:flex-start;gap:8px;margin-top:14px;padding:10px 12px;border-radius:11px;" +
      "font-size:13.5px;line-height:1.45;color:" + C.ink + ";background:color-mix(in srgb,var(--vg) 9%,transparent);" +
      "border:1px solid color-mix(in srgb,var(--vg) 22%,transparent)}",
    S + " .vg-saved strong{font-weight:600}",
    // Deliberately NOT .vg-tick — the success screen owns that class and renders
    // it as a big circular badge, which turned this inline checkmark into a
    // 90px green disc that shoved the banner text sideways.
    S + " .vg-ok-mark{flex:0 0 auto;font-weight:700;color:var(--vg)}",
    // Native select arrows are ugly and inconsistent across browsers; draw our own.
    S + " .vg-sel{position:relative}",
    S + " .vg-sel::after{content:'';position:absolute;right:15px;top:50%;width:7px;height:7px;pointer-events:none;" +
      "border-right:1.6px solid " + C.sub + ";border-bottom:1.6px solid " + C.sub + ";transform:translateY(-70%) rotate(45deg)}",
    S + " select{padding-right:36px}",

    // Submit — champagne gold with a soft sheen, matching the marketing site's
    // primary CTA. Dark ink keeps the label legible on gold.
    S + " button{position:relative;overflow:hidden;width:100%;height:52px;margin-top:18px;border:0;border-radius:14px;" +
      "background:linear-gradient(180deg,color-mix(in srgb,var(--vgcta) 92%,#fff) 0%,var(--vgcta) 55%,color-mix(in srgb,var(--vgcta) 82%,#000) 100%);" +
      "color:var(--vgctaink);font-size:15.5px;font-weight:700;letter-spacing:.005em;cursor:pointer;" +
      "box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 10px 22px -12px color-mix(in srgb,var(--vgcta) 70%,transparent);" +
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
    S + " .vg-wa{display:inline-block;padding:12px 22px;border-radius:999px;background:#1f8f4e;color:#fff!important;font-weight:600;font-size:15px;text-decoration:none}",
    S + " .vg-wa:hover{filter:brightness(1.08)}",
    S + " .vg-wa:focus-visible{outline:2px solid var(--vgold);outline-offset:3px}",
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

  // ---- Property (Google Ads brief, Nov 2026) ----------------------------
  // Every lead must say which property it is for, so the CRM can give it to
  // that property's owner. A property page passes data-property and the value
  // travels as a hidden field; any other page asks.
  var PROPERTIES = [
    ["hosa_road", "Hosa Road (Singasandra)"],
    ["electronic_city", "Electronic City"],
    ["hsr", "HSR Layout"],
    ["indiranagar", "Indiranagar"],
    ["bellandur", "Bellandur (corporate events)"],
    ["yelahanka", "Yelahanka"],
    ["kr_puram", "KR Puram"],
    ["other", "Not sure yet"],
  ];
  var FIXED_PROPERTY = (d.property || "").trim();
  var WA_NUMBER = (d.whatsapp || "918884331096").replace(/\D/g, "");
  function propertyName(key) {
    for (var i = 0; i < PROPERTIES.length; i++) if (PROPERTIES[i][0] === key) return PROPERTIES[i][1];
    return "";
  }
  var propertyField = FIXED_PROPERTY
    ? '<input type="hidden" name="property" value="' + FIXED_PROPERTY.replace(/"/g, "") + '">'
    : '<div class="vg-row"><label for="vg-prop">Venue</label>' +
        '<div class="vg-sel"><select id="vg-prop" name="property"><option value="">Select</option>' +
        PROPERTIES.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + "</option>"; }).join("") +
        "</select></div></div>";

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

      // Just the essentials: name + mobile above, then the occasion full-width.
      // "Preferred date" and "Guests" were removed at the client's request.
      '<div class="vg-row"><label for="vg-event">Occasion</label>' +
        '<div class="vg-sel"><select id="vg-event" name="eventType">' + optionsHtml(EVENTS, "Select") + "</select></div></div>" +
      propertyField +

      // Bots fill every field they can see; a human never sees this one.
      '<div class="vg-hp" aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div>' +

      '<div class="vg-err" role="alert" aria-live="polite"></div>' +
            // CONSENT IS STEP 1, not step 2.
      //
      // It is the permission to phone at all, and it explicitly overrides a
      // DND/NDNC registration. Step 1 already writes the lead, so putting the
      // tick in step 2 would mean a visitor who stops halfway leaves you a
      // number you are not licensed to ring. One line of height for the thing
      // that makes every later call lawful.
      '<label class="vg-consent"><input type="checkbox" name="consent">' +
        "<span>" + (d.consent ||
          "I agree to be contacted by Veloria Grand about this enquiry via phone, SMS and WhatsApp. " +
          "This consent overrides my DND/NDNC registration.") + "</span></label>" +
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
  // The exact sentence the visitor ticked — evidence, so store the words shown
  // rather than a generic "consented" that could later mean anything.
  var consentEl = mount.querySelector(".vg-consent span");
  var consentText = consentEl ? consentEl.textContent.trim() : "";

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
  if (form.consent) {
    form.consent.addEventListener("change", function () {
      var w = form.consent.closest(".vg-consent");
      if (w) w.classList.remove("vg-bad");
      errEl.textContent = "";
    });
  }
  ["name", "phone", "eventType", "property"].forEach(function (n) {
    var el = form[n];
    if (!el || el.type === "hidden") return;
    // "change" as well as "input": a <select> in Safari fires only change.
    ["input", "change"].forEach(function (evt) {
      el.addEventListener(evt, function () { markBad(el, false); errEl.textContent = ""; });
    });
  });

  /** Read a query param off the HOST page so paid traffic keeps attribution. */
  // ---- click-id capture -------------------------------------------------
  // A click id only appears in the URL of the page the ad landed on. Someone
  // who lands on /banquet-halls?gclid=… , reads two more pages and then fills
  // the form was arriving with no click id at all, and that lead could never be
  // reported back to Google as a conversion. So the first sighting is written
  // to a first-party cookie and read back for 90 days — Google's own
  // attribution window — with the live URL always winning if both exist.
  var CLICK_PARAMS = ["gclid", "gbraid", "wbraid", "fbclid"];
  var COOKIE_DAYS = 90;

  function readCookie(name) {
    try {
      var match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
      return match ? decodeURIComponent(match[2]) : undefined;
    } catch (_) { return undefined; }
  }

  function writeCookie(name, value) {
    try {
      var expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
      // Lax so it survives the click through from Google; not Secure-only, so
      // it still works on a plain-HTTP staging page.
      document.cookie =
        name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
    } catch (_) { /* private mode — the URL still works for this page */ }
  }

  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name) || undefined; }
    catch (_) { return undefined; }
  }

  // Remember any click id in the current URL, once per page load.
  try {
    for (var ci = 0; ci < CLICK_PARAMS.length; ci++) {
      var live = param(CLICK_PARAMS[ci]);
      if (live) writeCookie("vg_" + CLICK_PARAMS[ci], live);
    }
  } catch (_) { /* never let attribution break the form */ }

  // The site's own capture script (theveloriagrand.com /js/vg-click.js) keeps
  // every click id AND utm_* value from the ad landing, with the landing page
  // and time, for 90 days in a "vg_click" cookie + localStorage. Read it so a
  // visitor who browses before enquiring still carries the ad click.
  function storedClick() {
    try {
      var raw = readCookie("vg_click");
      if (!raw && window.localStorage) raw = window.localStorage.getItem("vg_click");
      var o = raw ? JSON.parse(raw) : null;
      return o && typeof o === "object" ? o : {};
    } catch (_) { return {}; }
  }
  var STORED = storedClick();

  function q(name) {
    var live = param(name);
    if (live) return live;
    // Click ids fall back to the per-id cookie we wrote on arrival.
    if (CLICK_PARAMS.indexOf(name) !== -1) {
      var c = readCookie("vg_" + name);
      if (c) return c;
    }
    var s = STORED[name];
    return typeof s === "string" && s ? s : undefined;
  }

  // Details handed over by another form on the page (the "check availability"
  // strip): date, guests, budget and location the visitor already gave.
  var PREFILL = {};
  window.addEventListener("veloria:prefill", function (ev) {
    var x = (ev && ev.detail) || {};
    PREFILL = x;
    try {
      if (x.eventType && form.eventType) {
        for (var i = 0; i < form.eventType.options.length; i++) {
          var o = form.eventType.options[i];
          if (o.value && o.value.toLowerCase() === String(x.eventType).toLowerCase()) { form.eventType.value = o.value; break; }
        }
      }
      if (x.property && form.property && form.property.tagName === "SELECT") {
        var want = String(x.property).toLowerCase();
        for (var j = 0; j < PROPERTIES.length; j++) {
          if (PROPERTIES[j][0] === want || PROPERTIES[j][1].toLowerCase().indexOf(want) === 0 ||
              want.indexOf(PROPERTIES[j][1].toLowerCase().replace(/ \(.*\)$/, "")) !== -1) {
            form.property.value = PROPERTIES[j][0]; break;
          }
        }
      }
      mount.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(function () { try { form.name.focus({ preventScroll: true }); } catch (_) {} }, 400);
    } catch (_) {}
  });

  function waLink(text) {
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
  }

  function logFailure(reason) {
    // The CRM may be the thing that is down, so the failure goes to analytics.
    try {
      (window.dataLayer = window.dataLayer || []).push({ event: "enquiry_post_failed", reason: String(reason || "") });
      if (typeof window.gtag === "function") window.gtag("event", "enquiry_post_failed", { reason: String(reason || "") });
    } catch (_) {}
    try { console.error("[Veloria] enquiry could not reach the CRM:", reason); } catch (_) {}
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    errEl.textContent = "";
    // Clear EVERY previous outline, not just name/phone — otherwise a field
    // flagged on an earlier attempt stays red after the visitor has fixed it.
    ["name", "phone", "eventType"].forEach(function (n) {
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

    // Consent gates STEP 1, because step 1 is what creates the lead. Without
    // it we would hold a number we have no permission to ring.
    if (form.consent && !form.consent.checked) {
      errEl.textContent = "Please tick the box so we can call you back.";
      var cw = form.consent.closest(".vg-consent");
      if (cw) cw.classList.add("vg-bad");
      form.consent.focus();
      return;
    }
    // ---- Remaining fields ----
    if (!form.eventType.value) {
      errEl.textContent = "Please choose the occasion.";
      markBad(form.eventType, true); form.eventType.focus(); return;
    }
    if (form.property && !form.property.value) {
      errEl.textContent = "Please choose a venue.";
      markBad(form.property, true); form.property.focus(); return;
    }
    var propertyKey = form.property ? form.property.value : "";

    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = "Sending…";

    var payload = JSON.stringify({
        name: name,
        phone: phone,
        eventType: form.eventType.value,
        // The consent record travels WITH the lead that it authorises.
        consent: form.consent ? !!form.consent.checked : undefined,
        consentText: form.consent ? consentText : undefined,
        page: window.location.href,
        // Where the ad click arrived (stored by the site's vg-click.js), else this page.
        landing_url: STORED.landing_page || window.location.href,
        referrer: document.referrer || undefined,
        submittedAt: new Date().toISOString(),
        utm_source: q("utm_source"), utm_medium: q("utm_medium"),
        utm_campaign: q("utm_campaign"), utm_term: q("utm_term"), utm_content: q("utm_content"),
        gclid: q("gclid"), gbraid: q("gbraid"), wbraid: q("wbraid"), fbclid: q("fbclid"),
        property: propertyKey || undefined,
        page_url: window.location.href,
        // Handed over by the availability strip, if the visitor used it.
        date: PREFILL.date || undefined,
        guests: PREFILL.guests || undefined,
      });

    // One retry on a network error or a server error, then WhatsApp, so the
    // enquiry is never lost. A 4xx is the visitor's to fix and is shown as is.
    function post(attempt) {
      return fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, ok: r.ok, body: j }; });
        })
        .then(function (res) {
          if (res.status >= 500 && attempt < 2) return post(attempt + 1);
          return res;
        }, function (netErr) {
          if (attempt < 2) return post(attempt + 1);
          return { status: 0, ok: false, body: {}, netErr: netErr };
        });
    }

    post(1).then(function (res) {
      if (res.ok && res.body && res.body.ok === true) {
        var leadId = res.body.leadId || res.body.lead_id || "";
        mount.innerHTML = successHtml(leadId, name, form.eventType.value, propertyKey);
        try {
          window.dispatchEvent(
            new CustomEvent("veloria:enquiry-submitted", { detail: { leadId: leadId, property: propertyKey } })
          );
        } catch (_) {}
        return;
      }
      if (res.status === 0 || res.status >= 500) {
        logFailure(res.status === 0 ? (res.netErr && res.netErr.message) || "network" : "HTTP " + res.status);
        mount.innerHTML = fallbackHtml(name, phone, form.eventType.value, propertyKey);
        return;
      }
      // Never leave the visitor stuck with a dead button.
      errEl.textContent = (res.body && res.body.error) || "Something went wrong. Please call us instead.";
      btn.disabled = false;
      btn.textContent = original;
    });
  });

  function esc(t) {
    return String(t || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function waButton(href, label) {
    return '<a class="vg-wa" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(label) + "</a>";
  }

  function successHtml(leadId, name, eventType, propertyKey) {
    var ref = leadId ? String(leadId).slice(-8).toUpperCase() : "";
    var place = propertyName(propertyKey);
    var text = "Hello Veloria Grand, I have just sent an enquiry" +
      (eventType ? " for a " + String(eventType).toLowerCase() : "") +
      (place && propertyKey !== "other" ? " at " + place : "") + "." +
      (ref ? " Reference: " + ref + "." : "");
    return (
      '<div class="vg-card vg-ok">' +
        '<div class="vg-tick"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>' +
        '<div class="vg-h">' + (d.thanks || "Thank you — we have your enquiry.") + "</div>" +
        '<div class="vg-sub" style="margin:8px auto 0">Our team will call you back shortly.</div>' +
        (leadId ? '<div style="margin-top:14px">' + waButton(waLink(text), "Continue on WhatsApp") + "</div>" : "") +
      "</div>"
    );
  }

  // The CRM could not be reached: hand the enquiry to WhatsApp with every
  // detail already written, so the visitor only has to press send.
  function fallbackHtml(name, phone, eventType, propertyKey) {
    var place = propertyName(propertyKey);
    var text = ["Hello Veloria Grand, I would like to enquire.",
      "Name: " + name, "Mobile: " + phone,
      eventType ? "Occasion: " + eventType : "",
      place && propertyKey !== "other" ? "Venue: " + place : "",
      PREFILL.date ? "Date: " + PREFILL.date : "",
      PREFILL.guests ? "Guests: " + PREFILL.guests : ""].filter(Boolean).join("\n");
    return (
      '<div class="vg-card vg-ok">' +
        '<div class="vg-h">Please send this on WhatsApp</div>' +
        '<div class="vg-sub" style="margin:8px auto 14px">Our enquiry desk did not answer just now. Your details are ready in a WhatsApp message.</div>' +
        waButton(waLink(text), "Send on WhatsApp") +
      "</div>"
    );
  }
})();
