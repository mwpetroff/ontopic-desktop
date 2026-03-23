import { useState, useEffect, useRef } from "react";

export function useTypewriter(fullText: string, charsPerFrame = 3, intervalMs = 16): string {
  const [displayedLength, setDisplayedLength] = useState(0);
  const prevTextRef = useRef("");
  const targetRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (fullText === prevTextRef.current) return;

    const prevText = prevTextRef.current;
    const prevLen = prevText.length;
    prevTextRef.current = fullText;

    if (fullText.length <= prevLen) {
      setDisplayedLength(fullText.length);
      targetRef.current = fullText.length;
      return;
    }

    if (prevLen > 0 && !fullText.startsWith(prevText.slice(0, prevLen))) {
      setDisplayedLength(fullText.length);
      targetRef.current = fullText.length;
      return;
    }

    targetRef.current = fullText.length;

    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      setDisplayedLength(prev => {
        const target = targetRef.current;
        if (prev >= target) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return target;
        }
        return Math.min(prev + charsPerFrame, target);
      });
    }, intervalMs);
  }, [fullText, charsPerFrame, intervalMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return fullText.slice(0, displayedLength);
}
