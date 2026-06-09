import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, BookOpen, Sparkles, Shield } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { NriLogo } from "@/components/nri-logo";

export default function Landing() {
  const { theme } = useTheme();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NriLogo variant={theme === "dark" ? "white" : "color"} height={22} />
            <div className="h-4 w-px bg-border" />
            <span className="font-semibold text-sm tracking-tight text-foreground">OnTopic</span>
          </div>
          {!isAuthenticated && (
            <Button asChild size="sm" data-testid="button-login">
              <a href="/api/login">Sign In</a>
            </Button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Hero — NRI blue gradient background */}
        <div
          className="w-full max-w-5xl mx-auto rounded-2xl mb-10 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #e3eced 0%, #94bcf5 35%, #5da0c8 65%, #001178 100%)" }}
        >
          <div className="max-w-2xl mx-auto text-center py-16 px-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white" style={{ fontFamily: "'Yu Gothic UI', 'Yu Gothic', Arial, sans-serif" }}>
              AI Meeting Intelligence<br />for Consulting
            </h1>

            <p className="text-white/85 text-base md:text-lg mb-8 max-w-lg mx-auto leading-relaxed">
              Listen, transcribe, and analyze client meetings in real time.
              Detect key topics, track sentiment, extract action items, and surface
              intelligent follow-up questions — all on your desktop.
            </p>

            <Button
              size="lg"
              className="px-8 text-sm font-semibold bg-white text-[#001178] hover:bg-white/90"
              data-testid="button-login-hero"
              onClick={() => navigate("/live")}
            >
              Get Started
            </Button>

            <p className="text-white/70 text-[11px] mt-3 flex items-center justify-center gap-1.5">
              <Shield className="h-3 w-3" />
              Local desktop — your data stays on your machine
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 pb-16">
          <Card className="p-5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mx-auto mb-3">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Live Transcription</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time speech-to-text with speaker detection and live display.
            </p>
          </Card>

          <Card className="p-5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mx-auto mb-3">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Smart Detection</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI identifies IT tools, concepts, and industry terms with definitions and categorization.
            </p>
          </Card>

          <Card className="p-5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mx-auto mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-1">AI Insights</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sentiment analysis, action items, follow-up questions, and session summaries.
            </p>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center">
        <p className="text-[11px] text-muted-foreground">NRI North America &mdash; OnTopic</p>
      </footer>
    </div>
  );
}
