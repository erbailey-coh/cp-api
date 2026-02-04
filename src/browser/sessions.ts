import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { browserManager } from './manager';
import { config } from '../utils/config';

/**
 * Represents an active conversation session with Copilot
 */
interface Session {
  id: string;
  page: Page;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
}

/**
 * Session configuration
 */
const SESSION_CONFIG = {
  // Close session after 30 minutes of inactivity
  timeoutMs: 30 * 60 * 1000,
  // Check for expired sessions every 5 minutes
  cleanupIntervalMs: 5 * 60 * 1000,
  // Maximum concurrent sessions
  maxSessions: 10,
};

/**
 * Manages multiple concurrent conversation sessions
 * Each session is a separate browser page/tab with its own Copilot conversation
 */
class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Start the periodic cleanup of expired sessions
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, SESSION_CONFIG.cleanupIntervalMs);

    // Don't prevent Node from exiting
    this.cleanupInterval.unref();
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up sessions that have been inactive for too long
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > SESSION_CONFIG.timeoutMs) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      console.log(`[Sessions] Closing expired session: ${id}`);
      await this.closeSession(id);
    }

    if (expiredIds.length > 0) {
      console.log(`[Sessions] Cleaned up ${expiredIds.length} expired session(s). Active: ${this.sessions.size}`);
    }
  }

  /**
   * Create a new session with a fresh Copilot conversation
   */
  async createSession(): Promise<Session> {
    // Check if we've hit the max sessions limit
    if (this.sessions.size >= SESSION_CONFIG.maxSessions) {
      // Try to clean up expired sessions first
      await this.cleanupExpiredSessions();

      // If still at max, close the oldest session
      if (this.sessions.size >= SESSION_CONFIG.maxSessions) {
        const oldestSession = this.getOldestSession();
        if (oldestSession) {
          console.log(`[Sessions] Max sessions reached, closing oldest: ${oldestSession.id}`);
          await this.closeSession(oldestSession.id);
        }
      }
    }

    // Get the browser context and create a new page
    const context = await browserManager.getContext();
    if (!context) {
      throw new Error('Browser not initialized');
    }

    const page = await context.newPage();
    const sessionId = uuidv4();
    const now = Date.now();

    // Navigate to Copilot to start a fresh conversation
    await page.goto(config.copilotUrl, { timeout: config.navigationTimeout });

    const session: Session = {
      id: sessionId,
      page: page,
      createdAt: now,
      lastActivityAt: now,
      messageCount: 0,
    };

    this.sessions.set(sessionId, session);
    console.log(`[Sessions] Created new session: ${sessionId}. Active sessions: ${this.sessions.size}`);

    return session;
  }

  /**
   * Get an existing session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get or create a session
   * If sessionId is provided and valid, return that session
   * Otherwise create a new one
   */
  async getOrCreateSession(sessionId?: string): Promise<Session> {
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) {
        // Update last activity time
        existing.lastActivityAt = Date.now();
        return existing;
      }
      console.log(`[Sessions] Session not found: ${sessionId}, creating new one`);
    }

    return this.createSession();
  }

  /**
   * Update session activity timestamp
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      session.messageCount++;
    }
  }

  /**
   * Close a specific session
   */
  async closeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      await session.page.close();
    } catch (error) {
      console.error(`[Sessions] Error closing page for session ${sessionId}:`, error);
    }

    this.sessions.delete(sessionId);
    console.log(`[Sessions] Closed session: ${sessionId}. Active sessions: ${this.sessions.size}`);
    return true;
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    console.log(`[Sessions] Closing all ${this.sessions.size} sessions...`);

    const closePromises = Array.from(this.sessions.keys()).map((id) =>
      this.closeSession(id)
    );

    await Promise.all(closePromises);
    this.stopCleanupInterval();
  }

  /**
   * Get the oldest session (for cleanup when at max capacity)
   */
  private getOldestSession(): Session | undefined {
    let oldest: Session | undefined;

    for (const session of this.sessions.values()) {
      if (!oldest || session.lastActivityAt < oldest.lastActivityAt) {
        oldest = session;
      }
    }

    return oldest;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    activeSessions: number;
    maxSessions: number;
    sessions: Array<{
      id: string;
      createdAt: number;
      lastActivityAt: number;
      messageCount: number;
      idleMinutes: number;
    }>;
  } {
    const now = Date.now();

    return {
      activeSessions: this.sessions.size,
      maxSessions: SESSION_CONFIG.maxSessions,
      sessions: Array.from(this.sessions.values()).map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        messageCount: s.messageCount,
        idleMinutes: Math.floor((now - s.lastActivityAt) / 60000),
      })),
    };
  }

  /**
   * Check if a session exists and is valid
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
