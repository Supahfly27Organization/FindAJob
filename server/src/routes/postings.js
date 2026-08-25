import { Router } from 'express';
import path from 'node:path';
import { searchPostingsForTitle } from '../services/searchService.js';
import {
  listPostingsForTitle,
  markPostingViewed,
  updatePostingStatus,
  getPostingById
} from '../services/postingService.js';
import { adaptResumeForPosting } from '../services/resumeAdaptationService.js';
import { NotFoundError } from '../errors.js';

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

  router.post('/postings/:id/adapt-resume', async (req, res, next) => {
    try {
      res.json(await adaptResumeForPosting(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  router.get('/postings/:id/adapted-resume', (req, res, next) => {
    try {
      const posting = getPostingById(db, Number(req.params.id));
      if (!posting.adaptedResumePath) {
        throw new NotFoundError('No adapted resume has been generated for this posting yet.');
      }
      const filename = `adapted-resume${path.extname(posting.adaptedResumePath)}`;
      res.download(posting.adaptedResumePath, filename, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', router);
}
