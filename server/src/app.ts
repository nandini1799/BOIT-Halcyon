import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './lib/config.js';
import { askRouter } from './routes/ask.js';
import { historyRouter } from './routes/history.js';
import { schemaRouter } from './routes/schema.js';

/**
 * The HTTP surface, separated from the process that runs it so integration
 * tests can mount the real application rather than a rehearsal of it.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, methods: ['GET', 'POST'] }));
  app.use(express.json({ limit: '16kb' }));
  const limiter = (limit: number, message: string) =>
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // Tests drive many questions quickly; the limit protects the database,
      // not the test runner.
      skip: () => config.NODE_ENV === 'test',
      message: { message },
    });

  /*
   * Only asking is expensive, so only asking is tightly limited.
   *
   * One budget across the whole API meant the evidence rail and the history
   * drawer — two cheap reads that happen on every page load — spent the
   * allowance intended to protect the database, and a reviewer working through
   * the starters could be refused partway. The limit belongs on the endpoint
   * that runs queries.
   */
  app.use('/api/ask', limiter(config.RATE_LIMIT_MAX, 'Too many questions in a short time. Try again shortly.'));
  app.use('/api', limiter(config.RATE_LIMIT_MAX * 10, 'Too many requests. Try again shortly.'));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api', askRouter);
  app.use('/api', historyRouter);
  app.use('/api', schemaRouter);

  app.use((_request, response) => {
    response.status(404).json({ message: 'No such endpoint.' });
  });

  return app;
}
