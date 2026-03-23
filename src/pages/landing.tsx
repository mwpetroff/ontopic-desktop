import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Headphones, Mic, BookOpen, Sparkles, Radio, Shield } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function Landing() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Headphones className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">OnTopic</span>
          </div>
          <Button asChild size="sm" data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Radio className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Now Broadcasting</span>
          </div>

          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Your PreSales Consulting<br />Companion
          </h1>

          <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-lg mx-auto leading-relaxed">
            Listen, transcribe, and analyze PreSales consulting meetings in real time.
            Detect key terms, track sentiment, extract action items, and generate
            intelligent follow-up questions.
          </p>

          <Button asChild size="lg" className="px-8 text-sm font-semibold shadow-md" data-testid="button-login-hero">
            <a href="/api/login">Get Started</a>
          </Button>

          <p className="text-[11px] text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
            <Shield className="h-3 w-3" />
            Local desktop — no account required
          </p>
        </div>

        <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4 pb-16">
          <Card className="p-5 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mx-auto mb-3">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Live Transcription</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time speech-to-text with speaker detection and typewriter effect display.
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
              Sentiment analysis, action items, follow-up questions, and episode summaries.
            </p>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center">
        <p className="text-[11px] text-muted-foreground">OnTopic &mdash; PreSales Consulting Companion</p>
      </footer>
    </div>
  );
}
