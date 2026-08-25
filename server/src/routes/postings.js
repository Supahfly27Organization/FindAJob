import { Router } from 'express';
import { searchPostingsForTitle } from '../services/searchService.js';
import {
  listPostingsForTitle,
  markPostingViewed,
  updatePostingStatus
} from '../services/postingService.js';

export function registerPostingRoutes(app, db) {
  const router = Router();

  router.post('/position-titles/:id/search', async (req, res, next) => {
    try {
      res.json(await searchPostingsForTitle(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  router.get('/position-titles/:id/postings', (req, res, next) => {
    try {
      res.json(listPostingsForTitle(db, Number(req.params.id), { status: req.query.status }));
    } catch (error) {
      next(error);
    }
  });

  router.put('/postings/:id/viewed', (req, res, next) => {
    try {
      res.json(markPostingViewed(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  router.put('/postings/:id/status', (req, res, next) => {
    try {
      res.json(updatePostingStatus(db, Number(req.params.id), req.body.status));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', router);
}
