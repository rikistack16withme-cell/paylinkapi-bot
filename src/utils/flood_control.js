const adminHandler = require('../bot/handlers/admin.handler');
const safeSender = require('./safe_sender');
const logger = require('./logger');

class BotFloodControl {
  constructor() {
    this.userHits = new Map();
    this.bannedUsers = new Map();

    // Clean up cache every 60s to prevent memory leaks
    setInterval(() => this.cleanup(), 60000);
  }

  cleanup() {
    const now = Date.now();
    for (const [userId, record] of this.userHits.entries()) {
      if (now - record.windowStart > 60000) {
        this.userHits.delete(userId);
      }
    }
    for (const [userId, unbanTime] of this.bannedUsers.entries()) {
      if (now > unbanTime) {
        this.bannedUsers.delete(userId);
      }
    }
  }

  /**
   * Evaluates user request against flood control & Anti-DDoS rules
   * @param {number|string} userId
   * @returns {{ allowed: boolean, reason?: string, remainingSec?: number }}
   */
  check(userId) {
    if (!userId) return { allowed: true };

    const uId = String(userId);

    // Master admins are completely exempt
    if (adminHandler.isMasterAdmin(uId)) {
      return { allowed: true };
    }

    const now = Date.now();

    // 1. Check if user is temporarily banned due to aggressive spam / flood attack
    if (this.bannedUsers.has(uId)) {
      const unbanTime = this.bannedUsers.get(uId);
      if (now < unbanTime) {
        const remainingSec = Math.ceil((unbanTime - now) / 1000);
        return { allowed: false, reason: 'FLOOD_BAN', remainingSec };
      } else {
        this.bannedUsers.delete(uId);
      }
    }

    // 2. Sliding window tracker
    let record = this.userHits.get(uId);
    if (!record || now - record.windowStart > 60000) {
      record = {
        windowStart: now,
        count: 1,
        timestamps: [now]
      };
      this.userHits.set(uId, record);
      return { allowed: true };
    }

    record.count++;
    record.timestamps.push(now);

    // Keep only timestamps within last 5 seconds for rapid-click detection
    record.timestamps = record.timestamps.filter(t => now - t <= 5000);

    // 3. Rapid click / Burst spam check (> 5 clicks in 3 seconds)
    const recentClicksIn3s = record.timestamps.filter(t => now - t <= 3000).length;
    if (recentClicksIn3s > 5) {
      return { allowed: false, reason: 'RAPID_BURST', remainingSec: 2 };
    }

    // 4. Aggressive flood attack check (> 35 requests in 60s)
    if (record.count > 35) {
      const banDurationMs = 5 * 60 * 1000; // 5 minute ban
      const unbanTime = now + banDurationMs;
      this.bannedUsers.set(uId, unbanTime);
      logger.warn(`[BOT ANTI-DDOS TRIGGERED] User ${uId} auto-banned for 5 mins due to aggressive spam (${record.count} req/min).`);
      return { allowed: false, reason: 'FLOOD_BAN', remainingSec: 300, isNewBan: true };
    }

    // 5. Normal rate limit check (> 20 requests in 60s)
    if (record.count > 20) {
      return { allowed: false, reason: 'RATE_LIMIT', remainingSec: 5 };
    }

    return { allowed: true };
  }
}

module.exports = new BotFloodControl();
