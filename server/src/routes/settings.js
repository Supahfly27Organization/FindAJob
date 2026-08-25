import { Router } from 'express';
import { getOpenAiKeyStatus, saveOpenAiKey } from '../services/settingsService.js';

export function registerSettingsRoutes(app, db) {
  const router = Router();

  router.get('/openai-key', (req, res) => {
    res.json(getOpenAiKeyStatus(db));
  });

  router.put('/openai-key', (req, res, next) => {
    try {
      res.json(saveOpenAiKey(db, req.body.apiKey));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/settings', router);
}
