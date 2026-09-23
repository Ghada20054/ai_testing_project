import { chromium, Browser, Page } from "playwright";
import { validateUrl } from "./url-validator";
import { createSession, updateSession } from "./session-manager";
import {
  TestingSession,
  ExplorationResult,
  PageSummary,
} from "./types";
import {
  createDatabaseSession,
  updateDatabaseSession,
  savePage,
  saveDetectedElements,
} from "./database";

export interface ExploreOptions {
  maxPages?: number;
  timeout?: number;
}

const NON_HTML_EXTENSIONS = [
  ".csv", ".pdf", ".zip", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx", ".txt", ".json", ".xml", ".rss", ".svg",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".mp4", ".webm", ".avi", ".mov", ".mkv", ".mp3", ".wav",
  ".ogg", ".flac", ".aac", ".exe", ".dmg", ".apk", ".tar",
  ".gz", ".rar", ".7z", ".css", ".js", ".mjs", ".woff",
  ".woff2", ".ttf", ".eot", ".map",
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

    if (
      pathLower.includes("/files/") ||
      pathLower.includes("/downloads/") ||
      pathLower.includes("/upload")
    ) {
      if (pathLower.match(/\.[a-z]{2,5}$/)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function runExploration(
  targetUrl: string,
  options: ExploreOptions = {}
): Promise<{ session: TestingSession; result: ExplorationResult }> {
  const validation = validateUrl(targetUrl);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const normalizedUrl = validation.normalizedUrl!;
  const session = createSession(normalizedUrl);

  await createDatabaseSession(
    session.id,
    normalizedUrl,
    "pending"
  );

  updateSession(session.id, { status: "crawling" });

  await updateDatabaseSession(
    session.id,
    "crawling"
  );

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(normalizedUrl, {
      timeout: options.timeout || 30000,
      waitUntil: "domcontentloaded",
    });

    const visited = new Set<string>();
    const navigableUrls: string[] = [];
    const skippedResources: string[] = [];
    const errors: string[] = [];
    const maxPages = options.maxPages || 20;

    const normalizedTarget = normalizedUrl;

    visited.add(normalizedTarget);

    if (isNavigableHtml(normalizedTarget)) {
      navigableUrls.push(normalizedTarget);
    } else {
      skippedResources.push(normalizedTarget);
    }

    const queue: string[] = [];

    const links = await discoverLinks(page, normalizedUrl);

    for (const link of links) {
      const normalized = normalizeUrl(link, normalizedUrl);

      if (
        normalized &&
        !visited.has(normalized) &&
        isSameDomain(normalizedUrl, normalized)
      ) {
        visited.add(normalized);

        if (isNavigableHtml(normalized)) {
          queue.push(normalized);
        } else {
          skippedResources.push(normalized);
        }
      }
    }

    while (queue.length > 0 && navigableUrls.length < maxPages) {
      const nextUrl = queue.shift()!;

      try {
        await page.goto(nextUrl, {
          timeout: options.timeout || 30000,
          waitUntil: "domcontentloaded",
        });

        navigableUrls.push(nextUrl);

        const newLinks = await discoverLinks(
          page,
          normalizedUrl
        );

        for (const link of newLinks) {
          const normalized = normalizeUrl(
            link,
            normalizedUrl
          );

          if (
            normalized &&
            !visited.has(normalized) &&
            isSameDomain(normalizedUrl, normalized)
          ) {
            visited.add(normalized);

            if (isNavigableHtml(normalized)) {
              queue.push(normalized);
            } else {
              skippedResources.push(normalized);
            }
          }
        }
      } catch {
        // Skip inaccessible pages silently
      }
    }

    updateSession(session.id, {
      status: "inspecting",
    });

    await updateDatabaseSession(
      session.id,
      "inspecting"
    );

    const pages: PageSummary[] = [];

    for (let i = 0; i < navigableUrls.length; i++) {
      const url = navigableUrls[i];

      try {
        if (page.url() !== url) {
          await page.goto(url, {
            timeout: options.timeout || 30000,
            waitUntil: "domcontentloaded",
          });
        }

        const title = await page.title();
        const summary = await extractPageSummary(page);
        const visitedAt = new Date().toISOString();

        const pageSummary: PageSummary = {
          pageNumber: i + 1,
          name: title || `Page ${i + 1}`,
          url,
          elements: summary.elementCount,
          forms: summary.formCount,
          inputs: summary.inputCount,
        };

        pages.push(pageSummary);

        const databasePageId = await savePage(
          session.id,
          {
            url,
            title: title || `Page ${i + 1}`,
            visitedAt,
          }
        );

        await saveDetectedElements(
          databasePageId,
          summary.detectedElements
        );
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

    const result: ExplorationResult = {
      targetUrl: normalizedUrl,
      pages,
      pageCount: pages.length,
      skippedResources,
      status:
        errors.length === 0
          ? "completed"
          : "partial",
      errors,
      sessionId: session.id,
    };

    const endTime = new Date().toISOString();

    updateSession(session.id, {
      status: "completed",
      endTime,
      pages: navigableUrls.map((url, i) => ({
        id: `page_${i}`,
        url,
        title:
          pages.find((p) => p.url === url)?.name || "",
        visitedAt: endTime,
        domNodes: [],
        elements: [],
      })),
      errors,
    });

    await updateDatabaseSession(
      session.id,
      "completed",
      endTime
    );

    return {
      session,
      result,
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Unknown error";

    const endTime = new Date().toISOString();

    updateSession(session.id, {
      status: "error",
      endTime,
      errors: [msg],
    });

    await updateDatabaseSession(
      session.id,
      "error",
      endTime
    );

    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function discoverLinks(
  page: Page,
  baseUrl: string
): Promise<string[]> {
  return page.evaluate((base: string) => {
    const links =
      document.querySelectorAll("a[href]");

    const urls: string[] = [];

    links.forEach((link) => {
      const href = link.getAttribute("href");

      if (
        href &&
        !href.startsWith("#") &&
        !href.startsWith("javascript:") &&
        !href.startsWith("mailto:")
      ) {
        try {
          const resolved = new URL(href, base);

          if (
            resolved.protocol === "http:" ||
            resolved.protocol === "https:"
          ) {
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
  detectedElements: Array<{
    elementType: string;
    label: string;
    selector: string;
    available: boolean;
    attributes: Record<string, string>;
  }>;
}> {
  return page.evaluate(() => {
    let elementCount = 0;
    let formCount = 0;
    let inputCount = 0;

    const detectedElements: Array<{
      elementType: string;
      label: string;
      selector: string;
      available: boolean;
      attributes: Record<string, string>;
    }> = [];

    const getSelector = (
      element: Element
    ): string => {
      const htmlElement =
        element as HTMLElement;

      if (htmlElement.id) {
        return `#${CSS.escape(
          htmlElement.id
        )}`;
      }

      const tagName =
        element.tagName.toLowerCase();

      const parent =
        element.parentElement;

      if (!parent) {
        return tagName;
      }

      const siblings =
        Array.from(
          parent.children
        ).filter(
          (child) =>
            child.tagName ===
            element.tagName
        );

      const index =
        siblings.indexOf(element) + 1;

      return `${tagName}:nth-of-type(${index})`;
    };

    const getLabel = (
      element: Element
    ): string => {
      const htmlElement =
        element as HTMLElement;

      const ariaLabel =
        element.getAttribute(
          "aria-label"
        );

      if (ariaLabel) {
        return ariaLabel;
      }

      const title =
        element.getAttribute("title");

      if (title) {
        return title;
      }

      const text =
        htmlElement.innerText?.trim();

      if (text) {
        return text.substring(0, 200);
      }

      const placeholder =
        element.getAttribute(
          "placeholder"
        );

      if (placeholder) {
        return placeholder;
      }

      const name =
        element.getAttribute("name");

      if (name) {
        return name;
      }

      return "";
    };

    const getAttributes = (
      element: Element
    ): Record<string, string> => {
      const attributes: Record<
        string,
        string
      > = {};

      for (const attribute of Array.from(
        element.attributes
      )) {
        attributes[attribute.name] =
          attribute.value;
      }

      return attributes;
    };

    const addElements = (
      selector: string,
      elementType: string
    ) => {
      const elements =
        document.querySelectorAll(
          selector
        );

      elements.forEach((element) => {
        const htmlElement =
          element as HTMLElement;

        detectedElements.push({
          elementType,
          label: getLabel(element),
          selector: getSelector(element),
          available:
            !htmlElement.hasAttribute(
              "disabled"
            ),
          attributes:
            getAttributes(element),
        });
      });
    };

    addElements("button", "button");
    addElements("a[href]", "link");
    addElements("input", "input");
    addElements("form", "form");
    addElements("select", "select");
    addElements(
      "textarea",
      "textarea"
    );

    addElements(
      "[role='button']",
      "button"
    );

    addElements(
      "[role='link']",
      "link"
    );

    addElements(
      "[role='checkbox']",
      "other"
    );

    addElements(
      "[role='radio']",
      "other"
    );

    addElements(
      "[role='combobox']",
      "select"
    );

    addElements(
      "[role='textbox']",
      "input"
    );

    addElements(
      "[onclick]",
      "other"
    );

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
      elementCount +=
        document.querySelectorAll(
          selector
        ).length;
    }

    formCount =
      document.querySelectorAll(
        "form"
      ).length;

    inputCount =
      document.querySelectorAll(
        "input, textarea, select, [role='textbox'], [role='combobox']"
      ).length;

    return {
      elementCount,
      formCount,
      inputCount,
      detectedElements,
    };
  });
}

function normalizeUrl(
  url: string,
  baseUrl: string
): string | null {
  try {
    const parsed = new URL(
      url,
      baseUrl
    );

    parsed.hash = "";

    return parsed.href;
  } catch {
    return null;
  }
}

function isSameDomain(
  targetUrl: string,
  linkUrl: string
): boolean {
  try {
    const target = new URL(
      targetUrl
    );

    const link = new URL(
      linkUrl
    );

    return (
      link.hostname ===
      target.hostname
    );
  } catch {
    return false;
  }
}
