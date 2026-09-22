const path = require('path');
const express = require('express');
const next = require('next');
const apiRoutes = require('../routes/api');
const logger = require('../utils/logger');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: path.join(__dirname, '..', '..') });
const handle = nextApp.getRequestHandler();

const { rateLimiter, securityHeaders } = require('./security');

function createApiServer() {
  const app = express();

  // Enable trust proxy for accurate client IP identification on Render / Cloudflare
  app.set('trust proxy', 1);

  // 1. Remove Express fingerprinting & attach Security Headers (Anti-XSS, No-Sniff, HSTS)
  app.disable('x-powered-by');
  app.use(securityHeaders);

  // 2. Strict Payload Limits to prevent Memory Exhaustion & Buffer Flooding DDoS attacks
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 3. CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, language, token, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // 4. Anti-DDoS & Rate Limiting (60 req/min limit, 120 req/min auto-ban throttle)
  app.use('/api', rateLimiter.middleware({ maxRequests: 60, ddosThreshold: 120 }));

  // 5. Serve static files from public directory
  const publicDir = path.join(__dirname, '..', '..', 'public');
  app.use(express.static(publicDir));

  // 6. Mount API routes at /api
  app.use('/api', apiRoutes);

  // Delegate all web pages to Next.js
  app.use((req, res) => {
    return handle(req, res);
  });

  return app;
}

function startApiServer(port = process.env.PORT || process.env.API_PORT || 5000) {
  const app = createApiServer();

  nextApp.prepare().then(() => {
    logger.info('✓ Next.js application compiled and ready');
  }).catch((err) => {
    logger.warn(`Next.js prepare warning: ${err.message}`);
  });

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`✓ PaylinkApi REST API & Next.js Server listening on http://localhost:${port}`);
    logger.info(`  • Web Portal:        http://localhost:${port}/register`);
    logger.info(`  • ABA QR Generator:  POST http://localhost:${port}/api/aba/generate-qr`);
    logger.info(`  • ABA Payment Check: POST http://localhost:${port}/api/aba/check-payment`);
    logger.info(`  • Bakong Check:      GET  http://localhost:${port}/api/bakong/check/:md5`);
  });
  return server;
}

module.exports = {
  createApiServer,
  startApiServer
};
