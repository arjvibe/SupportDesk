/**
 * Dynamically resolves the API base URL depending on the current subdomain/host context.
 * Enables local subdomain routing (e.g. acme.localhost:5173 calls acme.localhost:5000/api)
 */
export const getApiBase = (): string => {
  const { hostname, protocol } = window.location;
  const hostOnly = hostname.split(":")[0];
  return `${protocol}//${hostOnly}:5000/api`;
};

/**
 * Extracts the active subdomain from the current hostname.
 * e.g., acme.localhost -> "acme"
 * e.g., localhost -> null
 */
export const getActiveSubdomain = (): string | null => {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  
  if (parts.length > 1) {
    // Local dev subdomain check (e.g. acme.localhost)
    if (parts[parts.length - 1] === "localhost") {
      if (parts.length === 2) return parts[0];
      return null;
    }
    
    // Production subdomain check (e.g. acme.aura.com)
    if (parts.length >= 3) {
      return parts[0];
    }
  }
  
  return null;
};

/**
 * Resolves local served asset paths to their fully-qualified backend host URLs,
 * while leaving absolute external S3/CDN URLs untouched.
 * 
 * @param path The relative upload path or absolute CDN/S3 URL
 * @returns The resolved asset source URL
 */
export const resolveAssetUrl = (path: string | null | undefined): string => {
  if (!path) return "";
  if (path.startsWith("/uploads")) {
    const apiBase = getApiBase(); // e.g., http://localhost:5000/api
    const origin = apiBase.replace(/\/api$/, ""); // e.g., http://localhost:5000
    return `${origin}${path}`;
  }
  return path;
};
