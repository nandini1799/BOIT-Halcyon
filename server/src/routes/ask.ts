import { asTraceId, type AskStreamEvent } from '@halcyon/shared';
import { Router, type Request, type Response } from 'express';
import { ask } from '../pipeline/ask.js';

export const askRouter: Router = Router();

/**
 * `POST /api/ask` — Server-Sent Events.
 *
 * One event per pipeline stage as it completes, then a terminal `result` event
 * carrying the envelope. SSE rather than WebSocket because the traffic is one
 * way and short-lived, and because it survives a proxy that would drop an
 * upgrade.
 */
askRouter.post('/ask', async (request: Request, response: Response): Promise<void> => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Proxies that buffer would defeat the point of streaming stages.
    'X-Accel-Buffering': 'no',
  });

  const send = (event: AskStreamEvent): void => {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const body: unknown = request.body;
  const question = typeof body === 'object' && body !== null && 'question' in body
    ? String((body as { question: unknown }).question ?? '')
    : '';

  let closed = false;
  request.on('close', () => {
    closed = true;
  });

  try {
    for await (const event of ask(question)) {
      if (closed) break;
      send(event);
    }
  } catch (error: unknown) {
    process.stderr.write(`ask failed: ${error instanceof Error ? error.stack : String(error)}\n`);
    if (!closed) {
      send({
        type: 'result',
        response: {
          status: 'failed',
          code: 'internal_error',
          message: 'Something went wrong before the question could be answered.',
          traceId: asTraceId('unrecorded'),
        },
      });
    }
  } finally {
    response.end();
  }
});
