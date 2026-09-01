import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Small copy-to-clipboard icon button for a result panel's header.
 * `getText` is called lazily on click so it always copies current state. */
export function CopyButton({
  getText,
  label,
  className = "",
}: {
  getText: () => string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = getText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable/denied — fail silently, nothing to recover into.
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors ${className}`}
      aria-label={label ? `Copy ${label}` : "Copy"}
      data-testid="button-copy"
      title={label ? `Copy ${label}` : "Copy"}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
