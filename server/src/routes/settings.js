import { Router } from 'express';
import multer from 'multer';
import { ValidationError } from '../errors.js';
import { getOpenAiKeyStatus, saveOpenAiKey } from '../services/settingsService.js';
import { getResumeTemplateStatus, saveResumeTemplate } from '../services/resumeTemplateService.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

  router.get('/resume-template', (req, res) => {
    res.json(getResumeTemplateStatus(db));
  });

  router.post('/resume-template', (req, res, next) => {
    upload.single('file')(req, res, (uploadError) => {
      if (uploadError) {
        if (uploadError instanceof multer.MulterError) {
          const message =
            uploadError.code === 'LIMIT_FILE_SIZE'
              ? 'Resume template must be 10MB or smaller.'
              : 'Could not process the uploaded file.';
          return next(new ValidationError(message));
        }
        return next(uploadError);
      }
      try {
        res.json(saveResumeTemplate(db, req.file));
      } catch (error) {
        next(error);
      }
    });
  });

  app.use('/api/settings', router);
}
