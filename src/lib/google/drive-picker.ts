// ============================================================
// Google Drive picker — "upload from Drive" for any FileUpload.
// ------------------------------------------------------------
// Client-only. Loads Google's Picker + Identity Services scripts on demand,
// asks the signed-in Google account for the narrow `drive.file` scope (the app
// can read ONLY files the user picks in the dialog — never their whole Drive),
// opens the Picker, then downloads each chosen file with the same token and
// hands back ordinary File objects. From there the existing upload path
// (size guard → downscale → base64 data-URL → server action) is unchanged, so
// Drive photos are stored and validated exactly like local ones.
//
// Needs two PUBLIC env vars (set in Vercel → Environment Variables):
//   NEXT_PUBLIC_GOOGLE_API_KEY   — a browser API key with the Picker API enabled
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID — an OAuth web client whose "Authorized
//                                  JavaScript origins" include the app's URL
// and, in Google Cloud, the "Google Picker API" + "Google Drive API" enabled.
// Without them the button explains what's missing instead of failing silently.
// ============================================================

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID; // optional (project number)
const SCOPE = "https://www.googleapis.com/auth/drive.file";

export function isDrivePickerConfigured(): boolean {
  return !!API_KEY && !!CLIENT_ID;
}

export const DRIVE_SETUP_HINT =
  "Google Drive isn't connected yet. An admin needs to add NEXT_PUBLIC_GOOGLE_API_KEY and NEXT_PUBLIC_GOOGLE_CLIENT_ID in Vercel and enable the Picker + Drive APIs in Google Cloud.";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

const loaded = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
  loaded.set(src, p);
  return p;
}

async function ensureLibraries(): Promise<void> {
  await Promise.all([
    loadScript("https://apis.google.com/js/api.js"),
    loadScript("https://accounts.google.com/gsi/client"),
  ]);
  await new Promise<void>((resolve, reject) => {
    window.gapi.load("picker", { callback: resolve, onerror: reject });
  });
}

// One token per page session; Google's token client re-prompts only when it
// has to (expiry / first consent), so repeat picks feel instant.
let cachedToken: { value: string; expiresAt: number } | null = null;

function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return Promise.resolve(cachedToken.value);
  }
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error === "access_denied" ? "Google Drive access was declined." : "Couldn't sign in to Google Drive."));
          return;
        }
        cachedToken = {
          value: resp.access_token,
          expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
        };
        resolve(resp.access_token);
      },
      error_callback: (err: { type?: string }) => {
        reject(new Error(err?.type === "popup_closed" ? "Google sign-in was closed." : "Couldn't open Google sign-in."));
      },
    });
    client.requestAccessToken({ prompt: cachedToken ? "" : "consent" });
  });
}

interface PickedDoc {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
}

function openPicker(token: string, opts: { mimeTypes: string[]; multiple: boolean }): Promise<PickedDoc[]> {
  return new Promise((resolve) => {
    const g = window.google.picker;
    const view = new g.DocsView(g.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);
    if (opts.mimeTypes.length) view.setMimeTypes(opts.mimeTypes.join(","));
    let builder = new g.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .addView(view)
      .addView(new g.DocsUploadView())
      .setTitle("Pick from Google Drive")
      .setCallback((data: { action: string; docs?: Array<Record<string, unknown>> }) => {
        if (data.action === g.Action.PICKED) {
          resolve(
            (data.docs ?? []).map((d) => ({
              id: String(d.id),
              name: String(d.name ?? "file"),
              mimeType: String(d.mimeType ?? ""),
              sizeBytes: typeof d.sizeBytes === "number" ? d.sizeBytes : undefined,
            }))
          );
        } else if (data.action === g.Action.CANCEL) {
          resolve([]);
        }
      });
    if (APP_ID) builder = builder.setAppId(APP_ID);
    if (opts.multiple) builder = builder.enableFeature(g.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });
}

/** Expand an <input accept> string into Drive mime filters. */
function acceptToMimeTypes(accept: string): string[] {
  return accept
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a && a.includes("/") && !a.startsWith("."));
}

/**
 * Let the user pick file(s) from Google Drive; resolves to real File objects.
 * Resolves to [] when the user cancels. Throws with a human message otherwise.
 */
export async function pickFilesFromDrive(opts: {
  accept: string;
  multiple: boolean;
}): Promise<File[]> {
  if (!isDrivePickerConfigured()) throw new Error(DRIVE_SETUP_HINT);
  await ensureLibraries();
  const token = await getAccessToken();
  const docs = await openPicker(token, { mimeTypes: acceptToMimeTypes(opts.accept), multiple: opts.multiple });
  if (docs.length === 0) return [];

  const files: File[] = [];
  const skipped: string[] = [];
  for (const d of docs) {
    // Native Google formats (Docs/Sheets/Slides) have no bytes to download;
    // the picker is filtered to images/PDFs, but guard anyway.
    if (d.mimeType.startsWith("application/vnd.google-apps.")) {
      skipped.push(d.name);
      continue;
    }
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(d.id)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      skipped.push(d.name);
      continue;
    }
    const blob = await res.blob();
    files.push(new File([blob], d.name, { type: d.mimeType || blob.type }));
  }
  if (skipped.length && files.length === 0) {
    throw new Error(`Couldn't download from Drive: ${skipped.join(", ")}`);
  }
  return files;
}
