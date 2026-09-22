const { spawn } = require('child_process');
const logger = require('../utils/logger');

class TunnelService {
  constructor() {
    this.process = null;
    this.activeUrl = null;
    this.lastPublicUrl = null;
    this.consecutiveFailures = 0;
    this.isStarting = false;
    this.restartTimeout = null;
    this.healthInterval = null;
    this.urlResolvers = [];
    this.currentPort = 5000;
  }

  /**
   * Verify if a tunnel URL is actually live and serving our application
   * rather than returning 'no tunnel here :('
   */
  async isTunnelHealthy(url) {
    if (!url || !url.startsWith('https://')) return false;

    try {
      const res = await fetch(`${url}/register`, {
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) return false;

      const body = await res.text();
      // Check for localhost.run or broken proxy error indicators
      if (body.includes('no tunnel here :(') || body.includes('Tunnel Not Found')) {
        return false;
      }

      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Get the current live public URL synchronously.
   * Returns a valid HTTPS URL or null if no tunnel is ready.
   * Never returns localhost for public consumption.
   */
  getPublicUrl() {
    const fixedEnv = (
      process.env.CONFIGURED_WEB_PORTAL_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : '') ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
      ''
    ).trim();
    if (fixedEnv && fixedEnv.startsWith('https://') && !fixedEnv.includes('pinggy')) {
      return fixedEnv.replace(/\/+$/, '');
    }

    if (this.activeUrl && this.activeUrl.startsWith('https://')) {
      return this.activeUrl.replace(/\/+$/, '');
    }

    if (this.lastPublicUrl && this.lastPublicUrl.startsWith('https://')) {
      return this.lastPublicUrl.replace(/\/+$/, '');
    }

    return null;
  }

  /**
   * Asynchronously wait for the tunnel to produce a valid, verified working HTTPS URL.
   */
  async getLivePublicUrl(timeoutMs = 6000) {
    if (this.activeUrl && this.activeUrl.startsWith('https://')) {
      return this.activeUrl;
    }

    if (this.lastPublicUrl && this.lastPublicUrl.startsWith('https://') && !this.isStarting && this.process) {
      return this.lastPublicUrl;
    }

    if (!this.process && !this.isStarting) {
      this.startTunnel(this.currentPort);
    }

    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(this.getPublicUrl());
        }
      }, timeoutMs);

      this.urlResolvers.push((url) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(url);
        }
      });
    });
  }

  /**
   * Start the secure tunnel using localhost.run (zero pinggy)
   */
  startTunnel(port = 5000) {
    this.currentPort = port;

    if (this.process || this.isStarting) {
      return;
    }

    const fixedEnv = (
      process.env.CONFIGURED_WEB_PORTAL_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.KOYEB_PUBLIC_DOMAIN ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}` : '') ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
      ''
    ).trim();
    if (fixedEnv && fixedEnv.startsWith('https://') && !fixedEnv.includes('pinggy')) {
      this.activeUrl = fixedEnv.replace(/\/+$/, '');
      this.lastPublicUrl = this.activeUrl;
      logger.info(`✓ Using Cloud Hosted Web Portal URL: ${this.activeUrl}`);
      return;
    }

    this.isStarting = true;
    logger.info(`Starting high-speed web tunnel for port ${port} (zero pinggy)...`);

    try {
      this.process = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ServerAliveInterval=15',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'ConnectTimeout=10',
        '-o', 'TCPKeepAlive=yes',
        `-R`, `80:127.0.0.1:${port}`,
        'nokey@localhost.run'
      ]);

      const handleOutput = (data) => {
        const text = data.toString();
        // Match localhost.run tunnel https url: https://<hash>.lhr.life
        const match = text.match(/https:\/\/[a-z0-9-]+\.lhr\.life/i);
        if (match) {
          const newUrl = match[0].toLowerCase();
          if (this.activeUrl !== newUrl) {
            this.activeUrl = newUrl;
            this.lastPublicUrl = newUrl;
            this.consecutiveFailures = 0;
            logger.info(`✓ Live Web Portal URL ready: ${this.activeUrl}`);
            
            // Notify waiting promises
            while (this.urlResolvers.length > 0) {
              const resolver = this.urlResolvers.shift();
              resolver(this.activeUrl);
            }
          }
        }
      };

      this.process.stdout.on('data', handleOutput);
      this.process.stderr.on('data', handleOutput);

      this.process.on('error', (err) => {
        logger.warn('Tunnel process error:', err.message);
        this.handleTunnelExit(port);
      });

      this.process.on('close', (code) => {
        logger.warn(`Tunnel process disconnected (code ${code}).`);
        this.handleTunnelExit(port);
      });

      this.isStarting = false;
      this.startHealthMonitor(port);

    } catch (err) {
      logger.error('Failed to spawn tunnel process:', err.message);
      this.isStarting = false;
      this.handleTunnelExit(port);
    }
  }

  startHealthMonitor(port) {
    if (this.healthInterval) clearInterval(this.healthInterval);

    // Check tunnel health every 30s with failure tolerance
    this.healthInterval = setInterval(async () => {
      if (this.activeUrl && this.activeUrl.startsWith('https://')) {
        const isHealthy = await this.isTunnelHealthy(this.activeUrl);
        if (!isHealthy) {
          this.consecutiveFailures++;
          logger.warn(`⚠️ Tunnel health check warning (${this.consecutiveFailures}/3) for ${this.activeUrl}`);
          if (this.consecutiveFailures >= 3) {
            logger.warn(`⚠️ Tunnel health check failed 3 consecutive times for ${this.activeUrl}. Re-establishing tunnel...`);
            this.handleTunnelExit(port);
          }
        } else {
          this.consecutiveFailures = 0;
        }
      }
    }, 30000);
  }

  handleTunnelExit(port) {
    if (this.process) {
      try { this.process.kill(); } catch (_) {}
      this.process = null;
    }
    this.isStarting = false;
    this.activeUrl = null;
    this.consecutiveFailures = 0;

    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      logger.info('Attempting to reconnect web tunnel...');
      this.startTunnel(port);
    }, 2500);
  }

  stopTunnel() {
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    if (this.healthInterval) clearInterval(this.healthInterval);
    if (this.process) {
      try { this.process.kill(); } catch (_) {}
      this.process = null;
    }
    this.isStarting = false;
    this.activeUrl = null;
    this.consecutiveFailures = 0;
  }
}

const tunnelService = new TunnelService();

module.exports = tunnelService;
