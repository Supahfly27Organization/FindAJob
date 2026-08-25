import { Router } from 'express';
import {
  createPositionTitle,
  listPositionTitles,
  updatePositionTitle,
  deletePositionTitle
} from '../services/positionTitleService.js';

export function registerPositionTitleRoutes(app, db) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(listPositionTitles(db));
  });

  router.post('/', (req, res, next) => {
    try {
      res.status(201).json(createPositionTitle(db, req.body.title));
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', (req, res, next) => {
    try {
      res.json(updatePositionTitle(db, Number(req.params.id), req.body.title));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', (req, res, next) => {
    try {
      res.json(deletePositionTitle(db, Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/position-titles', router);
}
