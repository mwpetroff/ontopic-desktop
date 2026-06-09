import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Sessions from "@/pages/sessions";
import SessionDetail from "@/pages/session-detail";
import VoiceTraining from "@/pages/voice-training";
import Partners from "@/pages/partners";
import Competencies from "@/pages/competencies";
import ReferenceLibrary from "@/pages/reference-library";
import StudioSettings from "@/pages/studio-settings";
import Analytics from "@/pages/analytics";
import SessionGraph from "@/pages/session-graph";
import Landing from "@/pages/landing";
import { Loader2, AlertTriangle } from "lucide-react";
import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <pre className="text-xs text-muted-foreground bg-muted p-4 rounded max-w-2xl overflow-auto whitespace-pre-wrap text-left">
            {this.state.error.message}{"\n"}{this.state.error.stack}
          </pre>
          <button
            className="text-sm underline text-primary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/welcome" component={Landing} />
      <Route path="/">{() => <Redirect to="/sessions" />}</Route>
      <Route path="/live" component={Dashboard} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/sessions/:id" component={SessionDetail} />
      <Route path="/voice-training" component={VoiceTraining} />
      <Route path="/partners" component={Partners} />
      <Route path="/competencies" component={Competencies} />
      <Route path="/reference-library" component={ReferenceLibrary} />
      <Route path="/studio-settings" component={StudioSettings} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/sessions/:id/graph" component={SessionGraph} />
      <Route component={NotFound} />
    </Switch>
  );
}

const sidebarStyle = {
  "--sidebar-width": "15rem",
  "--sidebar-width-icon": "3rem",
};

function AuthenticatedApp() {
  return (
    <SidebarProvider defaultOpen={false} style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center p-2 border-b border-border lg:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-hidden">
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
