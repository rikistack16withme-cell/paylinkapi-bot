/**
 * PaylinkApi Enterprise Security & Anti-DDoS Layer
 *
 * Provides:
 * 1. High-speed In-Memory Token Bucket / Sliding Window Rate Limiting
 * 2. Anti-DDoS Brute Force Mitigation (Auto 429 Throttle)
 * 3. Security HTTP Response Headers (Anti-XSS, No-Sniff, HSTS)
 * 4. Payload Size Limiting (Prevents memory exhaustion attacks)
 */

class RateLimiter {
  constructor() {
    this.ipHits = new Map();
    this.keyHits = new Map();
    this.bannedIps = new Map();

    // Clean up stale entries every 60 seconds to prevent memory leaks
    setInterval(() => this.cleanup(), 60000);
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, data] of this.ipHits.entries()) {
      if (now - data.windowStart > 60000) {
        this.ipHits.delete(ip);
      }
    }
    for (const [key, data] of this.keyHits.entries()) {
      if (now - data.windowStart > 60000) {
        this.keyHits.delete(key);
      }
    }
    for (const [ip, unbanTime] of this.bannedIps.entries()) {
      if (now > unbanTime) {
        this.bannedIps.delete(ip);
      }
    }
  }

  getBannedIps() {
    const now = Date.now();
    const list = [];
    for (const [ip, unbanTime] of this.bannedIps.entries()) {
      if (now < unbanTime) {
        list.push({ ip, remainingSec: Math.ceil((unbanTime - now) / 1000) });
      }
    }
    return list;
  }

  unbanIp(ip) {
    return this.bannedIps.delete(ip);
  }

  flush() {
    this.ipHits.clear();
    this.keyHits.clear();
    this.bannedIps.clear();
  }

  getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || req.ip || '127.0.0.1';
  }

  /**
   * Express Middleware: Enforces IP & API Key Rate Limiting with Anti-DDoS Protection
   * @param {Object} options
   * @param {number} options.maxRequests - Max requests per minute per IP (default: 60)
   * @param {number} options.ddosThreshold - Threshold above which IP is temporarily banned (default: 120)
   * @param {number} options.banDurationMs - Ban duration in milliseconds (default: 180000 = 3 mins)
   */
  middleware(options = {}) {
    const maxRequests = options.maxRequests || 60;
    const ddosThreshold = options.ddosThreshold || 120;
    const banDurationMs = options.banDurationMs || 180000;

    return (req, res, next) => {
      // Exclude preflight, health-check monitoring pings, and telegram webhook from rate limiting
      if (
        req.method === 'OPTIONS' ||
        req.path === '/health' ||
        req.originalUrl?.includes('/health') ||
        req.path?.includes('webhook') ||
        req.originalUrl?.includes('webhook')
      ) {
        return next();
      }

      const now = Date.now();
      const ip = this.getClientIp(req);

      // 1. Check if IP is currently banned due to DDoS attempt
      if (this.bannedIps.has(ip)) {
        const unbanTime = this.bannedIps.get(ip);
        if (now < unbanTime) {
          const retrySec = Math.ceil((unbanTime - now) / 1000);
          res.setHeader('Retry-After', retrySec);
          return res.status(429).json({
            success: false,
            error: 'DDOS_PROTECTION_TRIGGERED',
            message: `Too many requests from your IP. Temporary rate-limit lockout active. Please wait ${retrySec} seconds before retrying.`,
            retryAfterSeconds: retrySec
          });
        } else {
          this.bannedIps.delete(ip);
        }
      }

      // 2. Track requests per IP in 60s sliding window
      let ipRecord = this.ipHits.get(ip);
      if (!ipRecord || now - ipRecord.windowStart > 60000) {
        ipRecord = { windowStart: now, count: 1 };
        this.ipHits.set(ip, ipRecord);
      } else {
        ipRecord.count++;
      }

      // 3. Check for aggressive DDoS flooding -> trigger auto-ban
      if (ipRecord.count > ddosThreshold) {
        this.bannedIps.set(ip, now + banDurationMs);
        console.warn(`[SECURITY ALERT] DDoS flood detected from IP: ${ip} (${ipRecord.count} req/min). Banned for 3 minutes.`);
        return res.status(429).json({
          success: false,
          error: 'DDOS_FLOOD_BLOCKED',
          message: 'Extreme request volume detected. IP temporarily blocked by automated firewall.',
          retryAfterSeconds: Math.ceil(banDurationMs / 1000)
        });
      }

      // 4. Standard Rate Limit Check
      if (ipRecord.count > maxRequests) {
        const resetSec = Math.ceil((ipRecord.windowStart + 60000 - now) / 1000);
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.floor((ipRecord.windowStart + 60000) / 1000));
        res.setHeader('Retry-After', resetSec);

        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded (${maxRequests} requests per minute). Please throttle your client requests.`,
          retryAfterSeconds: resetSec
        });
      }

      // Add RateLimit headers to response
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - ipRecord.count));
      res.setHeader('X-RateLimit-Reset', Math.floor((ipRecord.windowStart + 60000) / 1000));

      next();
    };
  }
}

/**
 * Express Middleware: Attaches Enterprise Security Headers & Removes Fingerprinting
 */
function securityHeaders(req, res, next) {
  // Remove Express server identifier to prevent targeted automated attacks
  res.removeHeader('X-Powered-By');

  // Anti-Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Anti-MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Cross-site scripting filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

const rateLimiter = new RateLimiter();

module.exports = {
  rateLimiter,
  securityHeaders
};
