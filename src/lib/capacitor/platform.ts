import { Capacitor } from "@capacitor/core";

export function isCapacitor(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return isCapacitor() && Capacitor.getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return isCapacitor() && Capacitor.getPlatform() === "android";
}

export function isWeb(): boolean {
  return !isCapacitor();
}

export function getPlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}
