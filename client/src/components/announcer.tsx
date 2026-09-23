import type { AskState } from '@/hooks/use-ask';

/**
 * What a screen reader hears.
 *
 * Without this the page changes silently: a question is asked, six stages run,
 * an answer replaces the empty state, and nothing is announced at all. The
 * stage rail is deliberately not narrated step by step — six polite
 * announcements in two seconds is noise, and the rail is a list the user can
 * read directly. Only the two moments that matter are spoken: that the question
 * was taken, and what became of it.
 */
export function Announcer({ state }: { state: AskState }): JSX.Element {
  let message = '';

  if (state.phase === 'thinking') {
    message = 'Working on your question.';
  } else if (state.phase === 'settled') {
    const { response } = state;
    switch (response.status) {
      case 'answered':
        message = `Answered. ${response.answer.headline}.`;
        break;
      case 'unanswerable':
        message = `This cannot be answered from the connected data. ${response.reason}`;
        break;
      case 'blocked':
        message = `Blocked before execution. ${response.reason}`;
        break;
      case 'failed':
        message = `The query failed. ${response.message}`;
        break;
      default: {
        const never: never = response;
        message = String(never);
      }
    }
  }

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
