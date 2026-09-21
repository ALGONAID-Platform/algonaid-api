import { Injectable, Logger } from '@nestjs/common';

interface AttemptRecord {
  count: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

/**
 * Tracks failed login attempts per email and implements progressive account lockout.
 * Uses in-memory storage (suitable for single-instance deployments).
 * For multi-instance: replace with Redis-backed storage.
 */
@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);

  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000;    // 15 minutes
  private readonly LOCKOUT_MS = 30 * 60 * 1000;   // 30 minutes lockout

  private readonly attempts = new Map<string, AttemptRecord>();

  /**
   * Checks if the given identifier (email) is currently locked out.
   * @returns `{ locked: false }` or `{ locked: true, remainingSeconds: number }`
   */
  checkLockout(identifier: string): { locked: boolean; remainingSeconds?: number } {
    const record = this.attempts.get(identifier);
    if (!record?.lockedUntil) return { locked: false };

    const now = Date.now();
    if (now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }

    // Lockout expired — reset
    this.attempts.delete(identifier);
    return { locked: false };
  }

  /**
   * Records a failed login attempt. Triggers lockout after MAX_ATTEMPTS within WINDOW_MS.
   */
  recordFailure(identifier: string): void {
    const now = Date.now();
    const existing = this.attempts.get(identifier);

    if (!existing || now - existing.lastAttemptAt > this.WINDOW_MS) {
      // First attempt or window expired — start fresh
      this.attempts.set(identifier, {
        count: 1,
        lastAttemptAt: now,
        lockedUntil: null,
      });
      return;
    }

    const newCount = existing.count + 1;
    if (newCount >= this.MAX_ATTEMPTS) {
      this.logger.warn(
        `[LoginAttemptService] Account locked: "${identifier}" after ${newCount} failed attempts.`,
      );
      this.attempts.set(identifier, {
        count: newCount,
        lastAttemptAt: now,
        lockedUntil: now + this.LOCKOUT_MS,
      });
    } else {
      this.attempts.set(identifier, {
        count: newCount,
        lastAttemptAt: now,
        lockedUntil: null,
      });
    }
  }

  /**
   * Clears the failure record after a successful login.
   */
  recordSuccess(identifier: string): void {
    this.attempts.delete(identifier);
  }
}
