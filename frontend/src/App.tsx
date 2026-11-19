import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReadinessResponse, TaskView } from './api/contracts';
import { AnnouncerProvider } from './components/AccessibleStatus';
import { SpeechSettings } from './components/SpeechSettings';
import { NewTaskPage } from './pages/NewTaskPage';
import { TaskHistoryPage, type SessionTask } from './pages/TaskHistoryPage';
import { TaskProgressPage } from './pages/TaskProgressPage';
import { createBrowserSpeechAdapter, createSimulatedSpeechAdapter, type SpeechInputAdapter } from './speech/speechInput';
import type { Transport } from './transport/types';
import type { SpeechOutput } from './hooks/useSpeechOutput';

export type Route = { name: 'new' } | { name: 'task'; id: string } | { name: 'history'; id?: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const task = /^\/tasks\/([^/]+)$/.exec(path);
  if (task?.[1]) return { name: 'task', id: decodeURIComponent(task[1]) };
  const history = /^\/history(?:\/([^/]+))?$/.exec(path);
  if (history) return history[1] ? { name: 'history', id: decodeURIComponent(history[1]) } : { name: 'history' };
  return { name: 'new' };
}

/** Returns the route and whether the user has navigated within the app (for focus management). */
function useHashRoute(): [Route, boolean] {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const [navigated, setNavigated] = useState(false);
  useEffect(() => {
    const onChange = () => {
      setNavigated(true);
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return [route, navigated];
}

function ModeBanner({ transport }: { transport: Transport }) {
  const [readiness, setReadiness] = useState<ReadinessResponse | null>();
  useEffect(() => {
    if (transport.mode !== 'http') return;
    let cancelled = false;
    transport
      .getReadiness()
      .then((r) => !cancelled && setReadiness(r))
      .catch(() => !cancelled && setReadiness(null));
    return () => {
      cancelled = true;
    };
  }, [transport]);

  if (transport.mode === 'mock') {
    return (
      <p className="mode-banner mode-demo" data-testid="mode-banner">
        <strong>Demo mode — simulated data.</strong> Nothing is sent to a real student portal or calendar.
      </p>
    );
  }
  return (
    <p className="mode-banner mode-http" data-testid="mode-banner">
      <strong>Connected to the AccessPilot gateway.</strong>{' '}
      {readiness === undefined && 'Checking gateway status…'}
      {readiness === null && 'The gateway is not reachable right now.'}
      {readiness &&
        `Gateway reports mode “${readiness.mode}”, storage “${readiness.storage}”.${
          readiness.mode === 'mock' ? ' It is a mock backend: no real external actions run.' : ''
        }`}
    </p>
  );
}

export interface AppProps {
  transport: Transport;
  pollIntervalMs?: number;
  browserSpeechAdapter?: SpeechInputAdapter;
  simulatedSpeechAdapter?: SpeechInputAdapter;
  speech?: SpeechOutput;
}

export function App({ transport, pollIntervalMs = 3000, browserSpeechAdapter, simulatedSpeechAdapter, speech }: AppProps) {
  // On first load focus stays at the document start so the skip link is the first Tab stop.
  const [route, navigated] = useHashRoute();
  const [sessionTasks, setSessionTasks] = useState<SessionTask[]>([]);
  const browserAdapter = useMemo(() => browserSpeechAdapter ?? createBrowserSpeechAdapter(), [browserSpeechAdapter]);
  const simulatedAdapter = useMemo(
    () => (transport.mode === 'mock' ? (simulatedSpeechAdapter ?? createSimulatedSpeechAdapter()) : undefined),
    [transport.mode, simulatedSpeechAdapter],
  );

  const onCreated = useCallback((task: TaskView) => {
    setSessionTasks((prev) => [...prev.filter((t) => t.task_id !== task.task_id), { task_id: task.task_id, instruction: task.instruction }]);
    window.location.hash = `#/tasks/${encodeURIComponent(task.task_id)}`;
  }, []);

  const latest = sessionTasks[sessionTasks.length - 1];
  const navCurrent = (name: Route['name'], id?: string) =>
    route.name === name && (id === undefined || (route.name === 'task' && route.id === id)) ? 'page' : undefined;

  return (
    <AnnouncerProvider {...(speech ? { speech } : {})}>
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        Skip to main content
      </a>
      <header className="site-header">
        <div className="wrap">
          <p className="site-title">AccessPilot</p>
          <ModeBanner transport={transport} />
          <nav aria-label="Main">
            <ul>
              <li>
                <a href="#/" aria-current={navCurrent('new')}>
                  New task
                </a>
              </li>
              {latest && (
                <li>
                  <a href={`#/tasks/${encodeURIComponent(latest.task_id)}`} aria-current={navCurrent('task', latest.task_id)}>
                    Current task
                  </a>
                </li>
              )}
              <li>
                <a href="#/history" aria-current={navCurrent('history')}>
                  Task history
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="wrap">
        {route.name === 'new' && (
          <NewTaskPage key="new" transport={transport} onCreated={onCreated} browserAdapter={browserAdapter} simulatedAdapter={simulatedAdapter} focusHeading={navigated} />
        )}
        {route.name === 'task' && <TaskProgressPage key={route.id} transport={transport} taskId={route.id} pollIntervalMs={pollIntervalMs} focusHeading={navigated} />}
        {route.name === 'history' && (
          <TaskHistoryPage key={`history-${route.id ?? ''}`} transport={transport} sessionTasks={sessionTasks} selectedId={route.id} focusHeading={navigated} />
        )}
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <SpeechSettings />
          <p className="muted">
            AccessPilot client · contract schema 1.0.0 · {transport.mode === 'mock' ? 'demo mode (simulated data)' : 'gateway mode'}
          </p>
        </div>
      </footer>
    </AnnouncerProvider>
  );
}
