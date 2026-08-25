import express from 'express';

export function createApp(db) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

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
