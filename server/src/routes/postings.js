import { Router } from 'express';
import path from 'node:path';
import multer from 'multer';
import { searchPostingsForTitle } from '../services/searchService.js';
import {
  listPostingsForTitle,
  markPostingViewed,
  updatePostingStatus,
  getPostingById
} from '../services/postingService.js';
import { adaptResumeForPosting } from '../services/resumeAdaptationService.js';
import { saveAppliedCv, getAppliedCv } from '../services/appliedCvService.js';
import { NotFoundError, ValidationError } from '../errors.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

  router.post('/postings/:id/applied-cv', (req, res, next) => {
    upload.single('file')(req, res, (uploadError) => {
      if (uploadError) {
        if (uploadError instanceof multer.MulterError) {
          const message =
            uploadError.code === 'LIMIT_FILE_SIZE'
              ? 'Applied CV must be 10MB or smaller.'
              : 'Could not process the uploaded file.';
          return next(new ValidationError(message));
        }
        return next(uploadError);
      }
      try {
        res.json(saveAppliedCv(db, Number(req.params.id), req.file));
      } catch (error) {
        next(error);
      }
    });
  });

  router.get('/postings/:id/applied-cv', (req, res, next) => {
    try {
      const cv = getAppliedCv(db, Number(req.params.id));
      res.download(cv.path, cv.originalName, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', router);
}
