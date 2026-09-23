import type {
  AskStreamEvent,
  HistoryDetail,
  HistoryPage,
  SchemaResponse,
} from '@halcyon/shared';

/** A failure the user should be told about in words, not left guessing at. */
export class AskFailed extends Error {
  constructor(
    message: string,
    readonly code: 'rate_limited' | 'internal_error',
  ) {
    super(message);
    this.name = 'AskFailed';
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, signal ? { signal } : {});
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return (await response.json()) as T;
}

export const getSchema = (signal?: AbortSignal): Promise<SchemaResponse> =>
  getJson<SchemaResponse>('/api/schema', signal);

export const getHistory = (signal?: AbortSignal): Promise<HistoryPage> =>
  getJson<HistoryPage>('/api/history', signal);

export const getHistoryDetail = (id: string, signal?: AbortSignal): Promise<HistoryDetail> =>
  getJson<HistoryDetail>(`/api/history/${id}`, signal);

/**
 * Reads the pipeline's event stream.
 *
 * `EventSource` cannot issue a POST, and the question belongs in a body rather
 * than a query string, so the stream is read off `fetch` directly. Events
 * arrive as they happen — a stage that takes four seconds yields nothing for
 * four seconds, which is the honest thing for it to do.
 */
export async function* askStream(
  question: string,
  signal: AbortSignal,
): AsyncGenerator<AskStreamEvent> {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  });

  /*
   * A refused request still has a body, just not an event stream. Reading it as
   * one yields no events and ends cleanly, which the caller cannot tell apart
   * from a question that produced nothing — and the UI sits on "Filing" for
   * ever. The status is checked before a single byte is read.
   */
  if (!response.ok) {
    throw new AskFailed(
      response.status === 429
        ? 'Too many questions in a short time. Wait a moment and ask again.'
        : `The server refused the question (${response.status}).`,
      response.status === 429 ? 'rate_limited' : 'internal_error',
    );
  }

  if (!response.body) throw new Error('The server returned no stream.');

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;

      // Events are separated by a blank line; a partial one stays buffered.
      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        const chunk = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        split = buffer.indexOf('\n\n');

        if (chunk.startsWith('data: ')) {
          yield JSON.parse(chunk.slice(6)) as AskStreamEvent;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
