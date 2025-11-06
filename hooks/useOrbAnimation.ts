import { useEffect, useRef } from 'react';

// Color constants from Tailwind config
const COLOR_SAGE = '#5E8C61';
const COLOR_MINT = '#97C09E';
const COLOR_BLUE = '#A7CAE3';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const useOrbAnimation = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  amplitude: number,
  isSpeaking: boolean,
  isModelSpeaking: boolean,
) => {
  const smoothedAmplitude = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = window.devicePixelRatio || 1;

    const resizeCanvas = () => {
      if (!canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const render = () => {
        smoothedAmplitude.current = lerp(smoothedAmplitude.current, amplitude, 0.2);

        const { width, height } = canvas.getBoundingClientRect();
        const centerX = width / 2;
        const centerY = height / 2;

        const baseRadius = Math.min(width, height) * 0.3;
        const scale = 1 + smoothedAmplitude.current * 0.4;
        const radius = baseRadius * scale;
        
        const speakingColor = isModelSpeaking ? COLOR_BLUE : COLOR_SAGE;
        const idleColor = COLOR_SAGE;
        const orbColor = isSpeaking ? speakingColor : idleColor;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Glow effect
        if (isSpeaking) {
            ctx.shadowBlur = 10 + smoothedAmplitude.current * 40;
            ctx.shadowColor = orbColor;
        } else {
            ctx.shadowBlur = 5;
            ctx.shadowColor = idleColor;
        }

        // Outer, static ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = orbColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = isSpeaking ? 0.5 : 0.3;
        ctx.stroke();
        
        // Main pulsing orb
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        
        const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius);
        gradient.addColorStop(0, orbColor);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.globalAlpha = isSpeaking ? 0.9 : 0.7;

        ctx.fill();
        
        // Reset shadow and alpha for next frame
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        animationFrameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [canvasRef, amplitude, isSpeaking, isModelSpeaking]);
};

export default useOrbAnimation;