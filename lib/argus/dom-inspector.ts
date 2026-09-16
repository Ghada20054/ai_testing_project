import { Page } from "playwright";
import { DOMNode, PageElement } from "./types";

export interface DOMInspectionResult {
  url: string;
  title: string;
  domNodes: DOMNode[];
  elements: PageElement[];
}

export async function inspectPageDOM(page: Page): Promise<DOMInspectionResult> {
  const url = page.url();
  const title = await page.title();

  const domNodes = await extractDOMNodes(page);
  const elements = await extractInteractiveElements(page);

  return { url, title, domNodes, elements };
}

async function extractDOMNodes(page: Page): Promise<DOMNode[]> {
  return page.evaluate(() => {
    const nodes: Array<{
      id: string;
      parent_node_id: string | null;
      tag_name: string;
      attributes: Record<string, string>;
      children_count: number;
    }> = [];

    let nodeCounter = 0;

    function walk(el: Element, parentId: string | null) {
      const id = `dom_${nodeCounter++}`;
      const attrs: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        attrs[attr.name] = attr.value;
      }

      nodes.push({
        id,
        parent_node_id: parentId,
        tag_name: el.tagName.toLowerCase(),
        attributes: attrs,
        children_count: el.children.length,
      });

      for (const child of Array.from(el.children)) {
        walk(child, id);
      }
    }

    walk(document.documentElement, null);
    return nodes;
  });
}

async function extractInteractiveElements(page: Page): Promise<PageElement[]> {
  return page.evaluate(() => {
    const elements: PageElement[] = [];
    let elemCounter = 0;

    const selectors: Array<{ selector: string; type: PageElement["type"] }> = [
      { selector: "button", type: "button" },
      { selector: "a[href]", type: "link" },
      { selector: "input", type: "input" },
      { selector: "form", type: "form" },
      { selector: "select", type: "select" },
      { selector: "textarea", type: "textarea" },
      { selector: "[role='button']", type: "button" },
      { selector: "[role='link']", type: "link" },
      { selector: "[role='checkbox']", type: "input" },
      { selector: "[role='radio']", type: "input" },
      { selector: "[role='combobox']", type: "select" },
      { selector: "[role='textbox']", type: "textarea" },
      { selector: "[onclick]", type: "button" },
    ];

    const seen = new Set<Element>();

    for (const { selector, type } of selectors) {
      const els = document.querySelectorAll(selector);
      els.forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const attrs: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) {
          attrs[attr.name] = attr.value;
        }

        elements.push({
          id: `elem_${elemCounter++}`,
          type,
          tag_name: el.tagName.toLowerCase(),
          text_content: el.textContent?.trim().substring(0, 200) || "",
          attributes: attrs,
          dom_node_id: "",
        });
      });
    }

    return elements;
  });
}
