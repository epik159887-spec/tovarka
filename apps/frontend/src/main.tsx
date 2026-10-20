import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from './hooks/useCart';
import { App } from './App';
import './styles/index.css';
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <CartProvider>
        <App />
      </CartProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
