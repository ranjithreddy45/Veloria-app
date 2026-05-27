import { isCapacitor } from "./platform";

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

/**
 * Check whether sharing is available on the current platform.
 * On native: always true. On web: checks for navigator.share support.
 */
export async function canShare(): Promise<boolean> {
  if (isCapacitor()) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  // Web: check for Web Share API support
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Share content using the native share sheet or the Web Share API.
 * Falls back to copying the URL to clipboard if Web Share API is unavailable.
 * Returns true if the share was initiated successfully.
 */
export async function shareContent(options: ShareOptions): Promise<boolean> {
  if (isCapacitor()) {
    return shareNative(options);
  }

  return shareWeb(options);
}

async function shareNative(options: ShareOptions): Promise<boolean> {
  try {
    const { Share } = await import("@capacitor/share");

    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: options.dialogTitle,
    });

    return true;
  } catch (error) {
    // User may have cancelled the share sheet; that is not a real error
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("cancel")) {
      return false;
    }
    console.error("[share] Native share failed:", error);
    return false;
  }
}

async function shareWeb(options: ShareOptions): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  // Try the Web Share API first
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return true;
    } catch (error) {
      // User may have cancelled; not a real error
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("abort")) {
        return false;
      }
      console.error("[share] Web Share API failed:", error);
    }
  }

  // Fallback: copy URL or text to clipboard
  const contentToCopy = options.url || options.text || options.title;
  if (contentToCopy && typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(contentToCopy);
      console.info("[share] Content copied to clipboard as fallback.");
      return true;
    } catch (error) {
      console.error("[share] Clipboard fallback failed:", error);
      return false;
    }
  }

  console.info("[share] No share mechanism available on this platform.");
  return false;
}
