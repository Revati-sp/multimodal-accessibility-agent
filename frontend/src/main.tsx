import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createTransport, readConfig } from './config';
import './styles.css';

const config = readConfig();
const transport = createTransport(config);
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App transport={transport} pollIntervalMs={config.pollIntervalMs} />
  </StrictMode>,
);
