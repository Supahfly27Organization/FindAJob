import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import open from 'open';
import { createApp, errorHandler } from './app.js';
import { createDb } from './db/index.js';
import { PORT, DB_PATH, CLIENT_DIST_PATH } from './config.js';
import { registerPositionTitleRoutes } from './routes/positionTitles.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerPostingRoutes } from './routes/postings.js';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = createDb(DB_PATH);
const app = createApp(db);
registerPositionTitleRoutes(app, db);
registerSettingsRoutes(app, db);
registerPostingRoutes(app, db);

if (fs.existsSync(CLIENT_DIST_PATH)) {
  app.use(express.static(CLIENT_DIST_PATH));
  app.get(/^\/(?!api\/)/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`FindAJob running at ${url}`);
  if (!process.argv.includes('--no-open')) {
    open(url).catch(() => {});
  }
});
