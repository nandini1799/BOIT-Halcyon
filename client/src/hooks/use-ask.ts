import {
  PIPELINE_STAGES,
  asTraceId,
  type AskResponse,
  type FailureCode,
  type PipelineStage,
} from '@halcyon/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AskFailed, askStream } from '@/api/client';

export type StageStatus = 'idle' | 'running' | 'done' | 'skipped';

export interface StageView {
  readonly stage: PipelineStage;
  readonly status: StageStatus;
  readonly elapsedMs: number;
  readonly detail: string | undefined;
}

export type AskState =
  | { readonly phase: 'idle' }
  | {
      readonly phase: 'thinking';
      readonly question: string;
      readonly stages: readonly StageView[];
    }
  | {
      readonly phase: 'settled';
      readonly question: string;
      readonly response: AskResponse;
      readonly stages: readonly StageView[];
    };

const initialStages = (): StageView[] =>
  PIPELINE_STAGES.map((stage) => ({ stage, status: 'idle', elapsedMs: 0, detail: undefined }));

/**
 * Stages complete in under two milliseconds most of the time.
 *
 * Shown raw, the rail would flash through six states faster than anyone can
 * read one, which communicates nothing and looks broken. So each stage is held
 * visible for a readable minimum before the next is allowed to start. The
 * timings reported are always the real ones — the pace of the display is
 * adjusted, never the measurement.
 */
const MIN_STAGE_MS = 260;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface UseAsk {
  readonly state: AskState;
  readonly ask: (question: string) => void;
  readonly reset: () => void;
  /** Restores a filed answer without going near the pipeline. */
  readonly show: (question: string, response: AskResponse) => void;
}

export function useAsk(): UseAsk {
  const [state, setState] = useState<AskState>({ phase: 'idle' });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const ask = useCallback((question: string) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    const stages = initialStages();
    setState({ phase: 'thinking', question, stages });

    const settle = (code: FailureCode, message: string): void => {
      setState({
        phase: 'settled',
        question,
        stages: [...stages],
        response: { status: 'failed', code, message, traceId: asTraceId('client') },
      });
    };

    void (async () => {
      let lastShownAt = Date.now();
      let answered = false;

      try {
        for await (const event of askStream(question, controller.signal)) {
          if (controller.signal.aborted) return;

          if (event.type === 'stage') {
            const held = Date.now() - lastShownAt;
            if (event.status !== 'running' && held < MIN_STAGE_MS) {
              await wait(MIN_STAGE_MS - held);
              if (controller.signal.aborted) return;
            }
            if (event.status !== 'running') lastShownAt = Date.now();

            const index = stages.findIndex((s) => s.stage === event.stage);
            if (index !== -1) {
              stages[index] = {
                stage: event.stage,
                status: event.status,
                elapsedMs: event.elapsedMs,
                detail: event.detail,
              };
            }
            setState({ phase: 'thinking', question, stages: [...stages] });
            continue;
          }

          answered = true;
          setState({ phase: 'settled', question, response: event.response, stages: [...stages] });
        }

        /*
         * A stream that ends without an outcome leaves the UI thinking for
         * ever, which is the worst way for this to fail: it looks like the
         * database is still working. Anything that reaches here is a bug, and
         * it is reported as one rather than hidden behind a spinner.
         */
        if (!answered && !controller.signal.aborted) {
          settle('internal_error', 'The answer stream ended without a result.');
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;

        if (error instanceof AskFailed) {
          settle(error.code === 'rate_limited' ? 'rate_limited' : 'internal_error', error.message);
          return;
        }

        settle(
          'network_error',
          'The server could not be reached. Check that it is running, then ask again.',
        );
      }
    })();
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setState({ phase: 'idle' });
  }, []);

  const show = useCallback((question: string, response: AskResponse) => {
    abort.current?.abort();
    setState({
      phase: 'settled',
      question,
      response,
      stages: initialStages().map((stage) => ({ ...stage, status: 'done' as const })),
    });
  }, []);

  return { state, ask, reset, show };
}
