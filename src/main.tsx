import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryClientProvider } from '@tanstack/react-query';
import '@github/spark/spark';

import App from './App.tsx';
import { ErrorFallback } from './ErrorFallback.tsx';
import { queryClient } from './lib/queryClient';

import './main.css';
import './styles/theme.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>
);
