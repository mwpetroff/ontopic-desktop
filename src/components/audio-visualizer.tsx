import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  level: number;
  isActive: boolean;
  size?: number;
}

export function AudioVisualizer({ level, isActive, size = 120 }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<number[]>(Array(24).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size * 0.3;
      const bars = barsRef.current;
      const barCount = bars.length;

      for (let i = 0; i < barCount; i++) {
        const target = isActive ? (Math.random() * level * 0.7 + level * 0.3) : 0;
        bars[i] += (target - bars[i]) * 0.15;

        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const barHeight = Math.max(2, bars[i] * size * 0.25);
        const barWidth = 3;

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isActive
          ? `hsl(30, ${50 + bars[i] * 20}%, ${40 + bars[i] * 25}%)`
          : "hsl(30, 10%, 45%)";
        ctx.lineWidth = barWidth;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 8, 0, Math.PI * 2);
      ctx.fillStyle = isActive
        ? `hsla(30, 50%, 45%, ${0.08 + level * 0.12})`
        : "hsla(30, 10%, 45%, 0.05)";
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [level, isActive, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="transition-opacity duration-300"
      data-testid="audio-visualizer"
    />
  );
}
