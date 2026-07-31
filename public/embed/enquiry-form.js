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
 *   data-accent     brand colour            (default: Veloria emerald #006742)
 *   data-events     comma-separated types   (default: the usual list)
 *   data-thanks     success message
 *   data-endpoint   override the API base   (for staging)
 *
 * WHY A SCRIPT AND NOT AN IFRAME: the app sends `X-Frame-Options: SAMEORIGIN`
 * on every route, so an iframe embed is blocked by the browser on any other
 * domain. A script that renders real DOM in the host page has no such problem,
 * inherits nothing from the host's CSS (everything is scoped + reset), and lets
 * the form auto-size naturally instead of needing postMessage height plumbing.
 *
 * The host page's own UTM parameters and gclid are read off its URL and sent
 * along, so paid traffic keeps its attribution all the way into the CRM.
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
    document.currentScript ||
    document.querySelector('script[src*="enquiry-form.js"]');
  var base =
    d.endpoint ||
    (thisScript && thisScript.src ? thisScript.src.replace(/\/embed\/enquiry-form\.js.*$/, "") : "");
  var ENDPOINT = base + "/api/landing-lead";

  var ACCENT = d.accent || "#006742";
  var EVENTS = (d.events || "Wedding,Reception,Engagement,Birthday,Corporate,Other")
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var GUESTS = ["Under 100", "100–200", "200–300", "300–500", "500+", "Not sure yet"];

  // ---- styles: scoped, reset-first, so host CSS can't distort the form ----
  var css =
    "#" + MOUNT_ID + " *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}" +
    "#" + MOUNT_ID + "{--vg:" + ACCENT + ";max-width:34rem;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1d1d1f;line-height:1.45}" +
    "#" + MOUNT_ID + " .vg-card{background:#fff;border:1px solid #e5e5e7;border-radius:16px;padding:20px}" +
    "#" + MOUNT_ID + " .vg-h{font-size:19px;font-weight:650;letter-spacing:-.01em}" +
    "#" + MOUNT_ID + " .vg-sub{font-size:13.5px;color:#6b6b70;margin-top:4px}" +
    "#" + MOUNT_ID + " .vg-row{margin-top:13px}" +
    "#" + MOUNT_ID + " .vg-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    "@media(max-width:420px){#" + MOUNT_ID + " .vg-two{grid-template-columns:1fr}}" +
    "#" + MOUNT_ID + " label{display:block;font-size:12.5px;font-weight:550;margin-bottom:5px}" +
    // 16px min on inputs: iOS Safari force-zooms the page when a focused field
    // is smaller, which yanks the layout sideways mid-typing.
    "#" + MOUNT_ID + " input,#" + MOUNT_ID + " select,#" + MOUNT_ID + " textarea{" +
      "width:100%;min-height:44px;padding:10px 12px;font-size:16px;color:#1d1d1f;" +
      "background:#fff;border:1px solid #d9d9dd;border-radius:10px;outline:none;appearance:none}" +
    "#" + MOUNT_ID + " textarea{min-height:76px;resize:vertical}" +
    "#" + MOUNT_ID + " input:focus,#" + MOUNT_ID + " select:focus,#" + MOUNT_ID + " textarea:focus{" +
      "border-color:var(--vg);box-shadow:0 0 0 3px color-mix(in srgb,var(--vg) 18%,transparent)}" +
    "#" + MOUNT_ID + " button{width:100%;min-height:48px;margin-top:16px;border:0;border-radius:12px;" +
      "background:var(--vg);color:#fff;font-size:15px;font-weight:600;cursor:pointer}" +
    "#" + MOUNT_ID + " button[disabled]{opacity:.6;cursor:default}" +
    "#" + MOUNT_ID + " .vg-err{color:#b3261e;font-size:12.5px;margin-top:8px;min-height:1em}" +
    "#" + MOUNT_ID + " .vg-ok{text-align:center;padding:26px 8px}" +
    "#" + MOUNT_ID + " .vg-ok .vg-tick{width:44px;height:44px;border-radius:999px;background:var(--vg);color:#fff;" +
      "display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 12px}" +
    "#" + MOUNT_ID + " .vg-fine{font-size:11.5px;color:#8a8a90;margin-top:10px;text-align:center}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function opts(list, placeholder) {
    return (
      '<option value="">' + placeholder + "</option>" +
      list.map(function (o) { return '<option value="' + o + '">' + o + "</option>"; }).join("")
    );
  }

  mount.innerHTML =
    '<form class="vg-card" novalidate>' +
      '<div class="vg-h">' + (d.title || "Enquire about your event") + "</div>" +
      '<div class="vg-sub">' + (d.subtitle || "Tell us a little and we'll call you back with availability and pricing.") + "</div>" +
      '<div class="vg-row"><label for="vg-name">Your name *</label><input id="vg-name" name="name" autocomplete="name" required></div>' +
      '<div class="vg-row"><label for="vg-phone">Mobile number *</label>' +
        '<input id="vg-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile, or +44… from abroad" required></div>' +
      '<div class="vg-row vg-two">' +
        '<div><label for="vg-event">Occasion</label><select id="vg-event" name="eventType">' + opts(EVENTS, "Select") + "</select></div>" +
        '<div><label for="vg-guests">Guests</label><select id="vg-guests" name="guests">' + opts(GUESTS, "Select") + "</select></div>" +
      "</div>" +
      '<div class="vg-row"><label for="vg-date">Preferred date</label><input id="vg-date" name="date" type="date"></div>' +
      '<div class="vg-err" role="alert" aria-live="polite"></div>' +
      "<button type=submit>Request a callback</button>" +
      '<div class="vg-fine">We\'ll only use your details to respond to this enquiry.</div>' +
    "</form>";

  var form = mount.querySelector("form");
  var errEl = mount.querySelector(".vg-err");
  var btn = mount.querySelector("button");

  /** Read a query param off the HOST page so paid traffic keeps attribution. */
  function q(name) {
    try { return new URLSearchParams(window.location.search).get(name) || undefined; }
    catch (_) { return undefined; }
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    errEl.textContent = "";

    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    if (!name) { errEl.textContent = "Please enter your name."; form.name.focus(); return; }
    var digits = phone.replace(/\D/g, "");
    // Mirror the server's rule so the user is told BEFORE a round-trip.
    var intl = phone.charAt(0) === "+" || digits.indexOf("00") === 0;
    if (digits.length < 7 || digits.length > 15 || (!intl && !/^[6-9]\d{9}$/.test(digits.replace(/^0+/, "")))) {
      errEl.textContent = "Enter a 10-digit Indian mobile, or include your country code (e.g. +44…).";
      form.phone.focus();
      return;
    }

    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = "Sending…";

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: phone,
        eventType: form.eventType.value || undefined,
        guests: form.guests.value || undefined,
        date: form.date.value || undefined,
        page: window.location.href,
        landing_url: window.location.href,
        referrer: document.referrer || undefined,
        submittedAt: new Date().toISOString(),
        utm_source: q("utm_source"), utm_medium: q("utm_medium"),
        utm_campaign: q("utm_campaign"), utm_term: q("utm_term"),
        utm_content: q("utm_content"),
        gclid: q("gclid"), gbraid: q("gbraid"), wbraid: q("wbraid"), fbclid: q("fbclid"),
      }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.body || res.body.ok !== true) {
          throw new Error((res.body && res.body.error) || "Could not send your enquiry.");
        }
        mount.innerHTML =
          '<div class="vg-card vg-ok"><div class="vg-tick">&#10003;</div>' +
          '<div class="vg-h">' + (d.thanks || "Thank you — we've got it.") + "</div>" +
          '<div class="vg-sub">Our team will call you back shortly.</div></div>';
        // Let the host page hook analytics onto a real conversion.
        try {
          window.dispatchEvent(new CustomEvent("veloria:enquiry-submitted", { detail: { leadId: res.body.leadId } }));
        } catch (_) {}
      })
      .catch(function (e) {
        // Never leave the visitor stuck with a dead button.
        errEl.textContent = e.message || "Something went wrong. Please call us instead.";
        btn.disabled = false;
        btn.textContent = original;
      });
  });
})();
