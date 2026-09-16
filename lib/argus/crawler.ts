import { chromium, Browser, Page } from "playwright";
import { isSameDomain, normalizeUrl } from "./url-validator";
import { ExplorationResult, PageSummary } from "./types";

export interface CrawlOptions {
  maxPages?: number;
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

const DEFAULT_OPTIONS: CrawlOptions = {
  maxPages: 20,
  timeout: 30000,
  waitUntil: "domcontentloaded",
};

const NON_HTML_EXTENSIONS = [
  ".csv",
  ".pdf",
  ".zip",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".json",
  ".xml",
  ".rss",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".mp4",
  ".webm",
  ".avi",
  ".mov",
  ".mkv",
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".aac",
  ".exe",
  ".dmg",
  ".apk",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".css",
  ".js",
  ".mjs",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".map",
];

function isNavigableHtml(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathLower = parsed.pathname.toLowerCase();

    for (const ext of NON_HTML_EXTENSIONS) {
      if (pathLower.endsWith(ext)) {
        return false;
      }
    }

    if (pathLower.includes("/files/") || pathLower.includes("/downloads/") || pathLower.includes("/upload")) {
      if (pathLower.match(/\.[a-z]{2,5}$/)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function crawlWebsite(
  targetUrl: string,
  options: CrawlOptions = {}
): Promise<ExplorationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const visited = new Set<string>();
  const navigableUrls: string[] = [];
  const skippedResources: string[] = [];
  const errors: string[] = [];
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(targetUrl, {
      timeout: opts.timeout,
      waitUntil: opts.waitUntil,
    });

    const normalizedTarget = normalizeUrl(targetUrl, targetUrl) || targetUrl;
    visited.add(normalizedTarget);

    if (isNavigableHtml(normalizedTarget)) {
      navigableUrls.push(normalizedTarget);
    } else {
      skippedResources.push(normalizedTarget);
    }

    const queue: string[] = [];

    const links = await discoverLinks(page, targetUrl);
    for (const link of links) {
      const normalized = normalizeUrl(link, targetUrl);
      if (normalized && !visited.has(normalized) && isSameDomain(targetUrl, normalized)) {
        visited.add(normalized);
        if (isNavigableHtml(normalized)) {
          queue.push(normalized);
        } else {
          skippedResources.push(normalized);
        }
      }
    }

    while (queue.length > 0 && navigableUrls.length < (opts.maxPages || 20)) {
      const nextUrl = queue.shift()!;

      try {
        await page.goto(nextUrl, {
          timeout: opts.timeout,
          waitUntil: opts.waitUntil,
        });

        navigableUrls.push(nextUrl);

        const newLinks = await discoverLinks(page, targetUrl);
        for (const link of newLinks) {
          const normalized = normalizeUrl(link, targetUrl);
          if (normalized && !visited.has(normalized) && isSameDomain(targetUrl, normalized)) {
            visited.add(normalized);
            if (isNavigableHtml(normalized)) {
              queue.push(normalized);
            } else {
              skippedResources.push(normalized);
            }
          }
        }
      } catch {
        // Skip inaccessible pages silently - do not report as errors for non-HTML resources
        if (isNavigableHtml(nextUrl)) {
          // Only report navigation errors for pages we intended to crawl
        }
      }
    }

    const pages: PageSummary[] = [];
    for (let i = 0; i < navigableUrls.length; i++) {
      const url = navigableUrls[i];
      try {
        if (page.url() !== url) {
          await page.goto(url, { timeout: opts.timeout, waitUntil: opts.waitUntil });
        }
        const title = await page.title();
        const summary = await extractPageSummary(page);
        pages.push({
          pageNumber: i + 1,
          name: title || `Page ${i + 1}`,
          url,
          elements: summary.elementCount,
          forms: summary.formCount,
          inputs: summary.inputCount,
        });
      } catch {
        pages.push({
          pageNumber: i + 1,
          name: `Page ${i + 1}`,
          url,
          elements: 0,
          forms: 0,
          inputs: 0,
        });
      }
    }

    return {
      targetUrl,
      pages,
      pageCount: pages.length,
      skippedResources,
      status: errors.length === 0 ? "completed" : "partial",
      errors,
      sessionId: "",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    errors.push(`Crawl failed: ${msg}`);
    return {
      targetUrl,
      pages: [],
      pageCount: 0,
      skippedResources,
      status: "error",
      errors,
      sessionId: "",
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function discoverLinks(page: Page, baseUrl: string): Promise<string[]> {
  return page.evaluate((base: string) => {
    const links = document.querySelectorAll("a[href]");
    const urls: string[] = [];
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("#") && !href.startsWith("javascript:") && !href.startsWith("mailto:")) {
        try {
          const resolved = new URL(href, base);
          if (resolved.protocol === "http:" || resolved.protocol === "https:") {
            urls.push(resolved.href);
          }
        } catch {
          // skip invalid URLs
        }
      }
    });
    return urls;
  }, baseUrl);
}

async function extractPageSummary(page: Page): Promise<{
  elementCount: number;
  formCount: number;
  inputCount: number;
}> {
  return page.evaluate(() => {
    let elementCount = 0;
    let formCount = 0;
    let inputCount = 0;

    const interactiveSelectors = [
      "button",
      "a[href]",
      "select",
      "textarea",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='radio']",
      "[role='combobox']",
      "[role='textbox']",
      "[onclick]",
    ];

    for (const selector of interactiveSelectors) {
      elementCount += document.querySelectorAll(selector).length;
    }

    formCount = document.querySelectorAll("form").length;

    inputCount = document.querySelectorAll("input, textarea, select, [role='textbox'], [role='combobox']").length;

    return { elementCount, formCount, inputCount };
  });
}
