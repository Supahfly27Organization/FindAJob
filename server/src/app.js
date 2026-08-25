import express from 'express';
import cors from 'cors';

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.locals.db = db;

  return app;
}

export function errorHandler(error, req, res, next) {
  if (error.status) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
}
