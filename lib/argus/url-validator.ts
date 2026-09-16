export interface URLValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

export function validateUrl(input: string): URLValidationResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, error: "URL is required" };
  }

  let urlToTest = trimmed;

  if (!urlToTest.match(/^https?:\/\//i)) {
    urlToTest = `https://${urlToTest}`;
  }

  try {
    const parsed = new URL(urlToTest);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are supported" };
    }

    if (!parsed.hostname || parsed.hostname.length < 3) {
      return { valid: false, error: "Invalid hostname" };
    }

    if (parsed.hostname.includes(" ")) {
      return { valid: false, error: "Hostname cannot contain spaces" };
    }

    const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`;

    return { valid: true, normalizedUrl: normalized };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

export function isSameDomain(targetUrl: string, linkUrl: string): boolean {
  try {
    const target = new URL(targetUrl);
    const link = new URL(linkUrl, targetUrl);
    return link.hostname === target.hostname;
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(url, baseUrl);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}
