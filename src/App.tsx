import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootLayout from './pages/layout';
import { ToastProvider } from './components/ui/toast';
import { MangouAuthProvider } from './lib/auth-context';
import { Loader2 } from 'lucide-react';

const AgentStartPage = lazy(() => import('./pages/page'));
const ProjectPage = lazy(() => import('./pages/[projectId]/page'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MangouAuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <RootLayout>
              <Suspense fallback={<AppLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard/agent" replace />} />
                  <Route path="/dashboard/agent" element={<AgentStartPage />} />
                  <Route path="/dashboard/agent/:projectId" element={<ProjectPage />} />
                  <Route path="*" element={<Navigate to="/dashboard/agent" replace />} />
                </Routes>
              </Suspense>
            </RootLayout>
          </BrowserRouter>
        </ToastProvider>
      </MangouAuthProvider>
    </QueryClientProvider>
  );
}

function AppLoadingFallback() {
  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );
}
