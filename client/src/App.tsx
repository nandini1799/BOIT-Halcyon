import type { AskResponse, SchemaResponse } from '@halcyon/shared';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSchema } from '@/api/client';
import { Announcer } from '@/components/announcer';
import { AskBar } from '@/components/ask-bar';
import { HistoryDrawer } from '@/components/history-drawer';
import { Masthead } from '@/components/masthead';
import { Rail } from '@/components/rail';
import { Answered } from '@/components/states/answered';
import { Empty } from '@/components/states/empty';
import { Blocked, Failed, Unanswerable } from '@/components/states/refusals';
import { Thinking } from '@/components/states/thinking';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAsk } from '@/hooks/use-ask';

export function App(): JSX.Element {
  const { state, ask, show } = useAsk();
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [question, setQuestion] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filed, setFiled] = useState(0);
  const historyButton = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();
    getSchema(controller.signal)
      .then(setSchema)
      .catch(() => {
        // The rail degrades to empty; the ask bar still works. Nothing to say.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (state.phase === 'settled') setFiled((count) => count + 1);
  }, [state.phase, state]);

  const askQuestion = useCallback(
    (asked: string) => {
      setQuestion(asked);
      ask(asked);
    },
    [ask],
  );

  const restore = useCallback(
    (asked: string, response: AskResponse) => {
      setQuestion(asked);
      show(asked, response);
    },
    [show],
  );

  const response = state.phase === 'settled' ? state.response : null;
  const suggestions = schema?.starters ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-bg">
        {/*
          There is no skip link. One exists to bypass a block of navigation,
          and there is none here: the ask bar takes focus on load, so the
          keyboard already starts at the primary action with a single control
          behind it. A skip link reachable only by shift-tabbing backwards
          would be furniture.
        */}
        <Announcer state={state} />

        <Masthead onOpenHistory={() => setHistoryOpen(true)} historyButtonRef={historyButton} />
        <AskBar
          onAsk={askQuestion}
          busy={state.phase === 'thinking'}
          value={question}
          onValueChange={setQuestion}
        />

        <main
          aria-busy={state.phase === 'thinking'}
          className="px-5 pb-11 pt-6 sm:px-10"
        >
          {state.phase === 'idle' ? (
            <Empty
              starters={suggestions}
              probes={schema?.guardProbes ?? []}
              onAsk={askQuestion}
            />
          ) : (
            <div className="mx-auto grid max-w-sheet items-start gap-[34px] xl:grid-cols-[1fr_var(--container-rail)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state.phase === 'settled' ? `settled-${filed}` : 'thinking'}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-0"
                >
                  {state.phase === 'thinking' && (
                    <Thinking question={state.question} stages={state.stages} />
                  )}

                  {state.phase === 'settled' && state.response.status === 'answered' && (
                    <Answered answer={state.response.answer} onAsk={askQuestion} />
                  )}

                  {state.phase === 'settled' && state.response.status === 'unanswerable' && (
                    <Unanswerable
                      question={state.question}
                      reason={state.response.reason}
                      suggestions={
                        state.response.suggestions.length > 0
                          ? state.response.suggestions
                          : suggestions
                      }
                      onAsk={askQuestion}
                    />
                  )}

                  {state.phase === 'settled' && state.response.status === 'blocked' && (
                    <Blocked
                      question={state.question}
                      reason={state.response.reason}
                      sql={state.response.sql}
                      checks={state.response.checks}
                      suggestions={suggestions}
                      onAsk={askQuestion}
                    />
                  )}

                  {state.phase === 'settled' && state.response.status === 'failed' && (
                    <Failed
                      question={state.question}
                      code={state.response.code}
                      message={state.response.message}
                      traceId={String(state.response.traceId)}
                      suggestions={suggestions}
                      onAsk={askQuestion}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              <Rail schema={schema} response={response} />
            </div>
          )}
        </main>

        <HistoryDrawer
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          onRestore={restore}
          revision={filed}
          returnFocusTo={historyButton}
        />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
