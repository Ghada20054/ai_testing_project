import { TestingSession } from "./types";

const sessions = new Map<string, TestingSession>();

export function createSession(targetUrl: string): TestingSession {
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const session: TestingSession = {
    id,
    targetUrl,
    status: "pending",
    startTime: new Date().toISOString(),
    pages: [],
    errors: [],
  };

  sessions.set(id, session);
  return session;
}

export function getSession(id: string): TestingSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, updates: Partial<TestingSession>): TestingSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;

  const updated = { ...session, ...updates };
  sessions.set(id, updated);
  return updated;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

export function listSessions(): TestingSession[] {
  return Array.from(sessions.values());
}
