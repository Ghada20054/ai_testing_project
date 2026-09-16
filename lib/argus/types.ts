export interface TestingSession {
  id: string;
  targetUrl: string;
  status: "pending" | "crawling" | "inspecting" | "completed" | "error";
  startTime: string;
  endTime?: string;
  pages: DiscoveredPage[];
  errors: string[];
}

export interface DiscoveredPage {
  id: string;
  url: string;
  title: string;
  visitedAt: string;
  domNodes: DOMNode[];
  elements: PageElement[];
}

export interface DOMNode {
  id: string;
  parent_node_id: string | null;
  tag_name: string;
  attributes: Record<string, string>;
  children_count: number;
}

export interface PageElement {
  id: string;
  type: "button" | "link" | "input" | "form" | "select" | "textarea" | "other";
  tag_name: string;
  text_content: string;
  attributes: Record<string, string>;
  dom_node_id: string;
}

export interface PageSummary {
  pageNumber: number;
  name: string;
  url: string;
  elements: number;
  forms: number;
  inputs: number;
}

export interface ExplorationResult {
  targetUrl: string;
  pages: PageSummary[];
  pageCount: number;
  skippedResources: string[];
  status: "completed" | "error" | "partial";
  errors: string[];
  sessionId: string;
}

export interface ExploreRequest {
  url: string;
}

export interface ExploreResponse {
  success: boolean;
  session?: TestingSession;
  result?: ExplorationResult;
  error?: string;
}
