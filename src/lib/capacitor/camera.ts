import type { ImageOptions, Photo } from "@capacitor/camera";
import { isCapacitor } from "./platform";

export interface CameraResult {
  dataUrl: string;
  format: string;
}

/**
 * Take a photo using the device camera.
 * Returns the photo as a data URL with its format, or null on web / error.
 */
export async function takePhoto(): Promise<CameraResult | null> {
  if (!isCapacitor()) {
    console.info("[camera] Camera is not available on web.");
    return null;
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );

    const options: ImageOptions = {
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    };

    const photo: Photo = await Camera.getPhoto(options);

    if (!photo.dataUrl) {
      console.error("[camera] No data URL returned from camera.");
      return null;
    }

    return {
      dataUrl: photo.dataUrl,
      format: photo.format,
    };
  } catch (error) {
    console.error("[camera] Failed to take photo:", error);
    return null;
  }
}

/**
 * Pick a single photo from the device gallery.
 * Returns the photo as a data URL with its format, or null on web / error.
 */
export async function pickFromGallery(): Promise<CameraResult | null> {
  if (!isCapacitor()) {
    console.info("[camera] Gallery picker is not available on web.");
    return null;
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );

    const options: ImageOptions = {
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    };

    const photo: Photo = await Camera.getPhoto(options);

    if (!photo.dataUrl) {
      console.error("[camera] No data URL returned from gallery.");
      return null;
    }

    return {
      dataUrl: photo.dataUrl,
      format: photo.format,
    };
  } catch (error) {
    console.error("[camera] Failed to pick photo from gallery:", error);
    return null;
  }
}

/**
 * Pick multiple photos from the device gallery.
 * Returns an array of photos as data URLs, or an empty array on web / error.
 */
export async function pickMultipleFromGallery(): Promise<CameraResult[]> {
  if (!isCapacitor()) {
    console.info(
      "[camera] Multiple gallery picker is not available on web."
    );
    return [];
  }

  try {
    const { Camera, CameraResultType } = await import("@capacitor/camera");

    const result = await Camera.pickImages({
      quality: 90,
      limit: 0, // 0 = no limit
    });

    const photos: CameraResult[] = [];

    for (const photo of result.photos) {
      // pickImages returns webPath; read as data URL if needed
      if (photo.webPath) {
        try {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          photos.push({
            dataUrl,
            format: photo.format,
          });
        } catch {
          console.error(
            "[camera] Failed to convert webPath to data URL for a photo."
          );
        }
      }
    }

    return photos;
  } catch (error) {
    console.error(
      "[camera] Failed to pick multiple photos from gallery:",
      error
    );
    return [];
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read blob as data URL."));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
