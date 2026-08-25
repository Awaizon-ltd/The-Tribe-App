import * as ImagePicker from "expo-image-picker";
import { APP_CONFIG } from "../constants/Config";

const BACKEND_URL = APP_CONFIG.BACKEND_URL;

// ─── Permissions ──────────────────────────────────────────────────────────────

export const requestImagePermissions = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Sorry, we need camera roll permissions to upload images!");
  }
  return true;
};

// ─── Image picker ─────────────────────────────────────────────────────────────

export const pickImage = async () => {
  try {
    await requestImagePermissions();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      return result.assets[0];
    }

    return null;
  } catch (error) {
    console.error("Error picking image:", error);
    throw error;
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getMimeInfo = (uri) => {
  const ext = uri.split(".").pop()?.toLowerCase().split("?")[0] ?? "jpg";
  const mimeMap = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return {
    ext: mimeMap[ext] ? ext : "jpg",
    mimeType: mimeMap[ext] ?? "image/jpeg",
  };
};

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload image to Cloudinary via backend-signed request.
 *
 * Flow:
 *   1. POST /api/upload/sign  → backend signs params with API secret
 *   2. POST to Cloudinary     → direct upload using the signed payload
 *
 * @param {string} imageUri  - Local URI from ImagePicker
 * @param {string} folder    - Cloudinary folder (default: 'dao-images')
 * @param {object} options   - Optional: { publicId }
 * @returns {{ url, publicId, width, height }}
 */
export const uploadImageToCloudinary = async (
  imageUri,
  folder = "dao-images",
  options = {},
) => {
  const timestamp = Date.now();
  const { ext, mimeType } = getMimeInfo(imageUri);
  const publicId = options.publicId ?? `dao_${timestamp}`;

  // ── Step 1: Get signature from backend ────────────────────
  const signRes = await fetch(`${BACKEND_URL}/upload/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, publicId }),
  });

  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error ?? `Signature request failed: ${signRes.status}`);
  }

  const { data: sign } = await signRes.json();

  // ── Step 2: Upload directly to Cloudinary ─────────────────
  const formData = new FormData();
  formData.append("file", { uri: imageUri, type: mimeType, name: `${publicId}.${ext}` });
  formData.append("api_key", sign.apiKey);
  formData.append("timestamp", String(sign.timestamp));
  formData.append("signature", sign.signature);
  formData.append("folder", folder);
  formData.append("public_id", publicId);

  console.log(`[Cloudinary] Uploading image (${mimeType})...`);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!uploadRes.ok) {
    const errorData = await uploadRes.json().catch(() => ({}));
    console.error("[Cloudinary] Upload error:", JSON.stringify(errorData));
    throw new Error(
      errorData.error?.message ?? `Upload failed: ${uploadRes.status}`,
    );
  }

  const data = await uploadRes.json();
  console.log("[Cloudinary] ✅ Image uploaded successfully:", data.secure_url);

  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
  };
};

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete image from Cloudinary via the backend.
 * The backend signs the deletion request with the API secret.
 *
 * @param {string} publicId - The public_id returned from uploadImageToCloudinary
 */
export const deleteImageFromCloudinary = async (publicId) => {
  const response = await fetch(`${BACKEND_URL}/upload/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("[Cloudinary] Delete error:", JSON.stringify(errorData));
    throw new Error(errorData.error ?? `Deletion failed: ${response.status}`);
  }

  console.log("[Cloudinary] ✅ Image deleted successfully:", publicId);
  return true;
};

// ─── Transform ────────────────────────────────────────────────────────────────

/**
 * Build a Cloudinary on-the-fly transformation URL from an existing secure_url.
 *
 * @example
 *   getTransformedUrl(url, 'w_200,h_200,c_fill,q_auto,f_auto')
 */
export const getTransformedUrl = (secureUrl, transformation) => {
  if (!secureUrl || !transformation) return secureUrl;
  return secureUrl.replace("/upload/", `/upload/${transformation}/`);
};

export default {
  pickImage,
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  getTransformedUrl,
  requestImagePermissions,
};
