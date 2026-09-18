import pool from "@/lib/db";

export interface DetectedElementData {
  elementType: string;
  label: string;
  selector: string;
  available: boolean;
  attributes: Record<string, string>;
}

export interface PageData {
  url: string;
  title: string;
  visitedAt: string;
}

export async function createDatabaseSession(
  sessionId: string,
  targetUrl: string,
  status: string
) {
  await pool.query(
    `
    INSERT INTO "TestingSession"
      ("sessionId", "targetUrl", "status")
    VALUES ($1, $2, $3)
    `,
    [sessionId, targetUrl, status]
  );
}

export async function updateDatabaseSession(
  sessionId: string,
  status: string,
  endTime?: string
) {
  if (endTime) {
    await pool.query(
      `
      UPDATE "TestingSession"
      SET "status" = $2, "endTime" = $3
      WHERE "sessionId" = $1
      `,
      [sessionId, status, endTime]
    );
  } else {
    await pool.query(
      `
      UPDATE "TestingSession"
      SET "status" = $2
      WHERE "sessionId" = $1
      `,
      [sessionId, status]
    );
  }
}

export async function savePage(
  sessionId: string,
  page: PageData
): Promise<string> {
  const result = await pool.query(
    `
    INSERT INTO "Page"
      ("sessionId", "url", "title", "visitedAt")
    VALUES ($1, $2, $3, $4)
    RETURNING "pageId"
    `,
    [sessionId, page.url, page.title, page.visitedAt]
  );

  return result.rows[0].pageId;
}

export async function saveDetectedElements(
  pageId: string,
  elements: DetectedElementData[]
) {
  for (const element of elements) {
    await pool.query(
      `
      INSERT INTO "DetectedElement"
        (
          "pageId",
          "elementType",
          "label",
          "selector",
          "available",
          "attributes"
        )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        pageId,
        element.elementType,
        element.label,
        element.selector,
        element.available,
        JSON.stringify(element.attributes),
      ]
    );
  }
}
