import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/index.js';
import { attachWebSocket } from './ws-handler.js';
import { registerEventSubscribers } from './event-bus/subscribers.js';
import { assertProductionSecurity } from './auth/security-check.js';
import { checkSecurityConfig } from './auth/constants.js';
import { getCorsOrigins, isProduction } from './auth/env.js';

registerEventSubscribers();
assertProductionSecurity();
checkSecurityConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT || '8765', 10);
const HOST = process.env.STUDIO_HOST || '127.0.0.1';
const FRONTEND_DIST = path.join(ROOT, 'frontend', 'dist');

const app = express();

function buildCorsOptions() {
  if (!isProduction()) {
    return { origin: true, credentials: true };
  }
  const origins = getCorsOrigins();
  if (!origins.length) {
    return { origin: false, credentials: true };
  }
  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
}

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '2mb' }));

// API routes
app.use('/api', apiRouter);

// SPA static files
import fs from 'fs';

const sendFavicon = (filename, contentType) => (req, res) => {
  const file = path.join(FRONTEND_DIST, filename);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.type(contentType);
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(file);
};

if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.get('/favicon.ico', sendFavicon('favicon.ico', 'image/x-icon'));
  app.get('/favicon-32.png', sendFavicon('favicon-32.png', 'image/png'));
  app.get('/apple-touch-icon.png', sendFavicon('apple-touch-icon.png', 'image/png'));
  const assetsDir = path.join(FRONTEND_DIST, 'assets');
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir));
  }
  // Serve other static files
  app.use(express.static(FRONTEND_DIST));

  const sendSpaIndex = (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  };

  // SPA fallback（index.html 不缓存，避免引用过期 hash 的 JS）
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    const candidate = path.join(FRONTEND_DIST, req.path);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return res.sendFile(candidate);
    }
    sendSpaIndex(req, res);
  });
}

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
attachWebSocket(server);

server.listen(PORT, HOST, () => {
  console.log(`\n  文匠 Studio → http://${HOST}:${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  错误：端口 ${PORT} 已被占用。`);
    if (process.platform === 'win32') {
      console.error(`  Windows: 再次运行 start.bat / start.ps1 / npm start（会自动释放端口）`);
      console.error(`  或: netstat -ano | findstr :${PORT}  然后 taskkill /PID <pid> /F`);
    } else {
      console.error(`  macOS/Linux: 再次运行 ./start.sh / npm start（会自动释放端口）`);
      console.error(`  或: lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t | xargs kill`);
    }
    console.error('');
    process.exit(1);
  }
  throw err;
});
