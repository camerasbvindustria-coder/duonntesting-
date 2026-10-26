/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  color: string;
}

interface SingularityParticle {
  angle: number;
  dist: number;
  speed: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const isAudioActiveRef = useRef(false);

  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Interaction states without any on-screen menus or text
  const isInteractingRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const tiltRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const speedMultiplierRef = useRef(1.0);
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimeoutRef = useRef<number | null>(null);
  // Preload DUONN logo
  useEffect(() => {
    const img = new Image();
    img.src = '/public/assets/aistudio/image_0bc0cfb2.png';
    img.onload = () => {
      logoImageRef.current = img;
    };
    img.onerror = () => {
      const fallbackImg = new Image();
      fallbackImg.src = '/assets/aistudio/image_0bc0cfb2.png';
      fallbackImg.onload = () => {
        logoImageRef.current = fallbackImg;
      };
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // High DPI support
    const handleResize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initialize Starfield (points simulating stars)
    const starCount = 950;
    const starColors = [
      '#ffffff',
      '#f0f8ff',
      '#dbeafe',
      '#93c5fd',
      '#bfdbfe',
      '#fef3c7',
      '#e0f2fe'
    ];

    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2.5 * width,
        y: (Math.random() - 0.5) * 2.5 * height,
        z: Math.random() * 0.9 + 0.1,
        radius: Math.random() * 1.6 + 0.4,
        baseAlpha: Math.random() * 0.6 + 0.25,
        twinkleSpeed: Math.random() * 2.2 + 0.8,
        twinkleOffset: Math.random() * Math.PI * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)]
      });
    }

    // Singularity dust particles drawn toward the dark center
    const singularityParticles: SingularityParticle[] = [];
    const maxParticles = 45;

    const spawnSingularityParticle = (portalRadius: number) => {
      return {
        angle: Math.random() * Math.PI * 2,
        dist: portalRadius * (0.44 + Math.random() * 0.08),
        speed: (Math.random() * 0.4 + 0.2) * (portalRadius * 0.001),
        size: Math.random() * 1.5 + 0.6,
        alpha: Math.random() * 0.7 + 0.3,
        life: 0,
        maxLife: Math.random() * 90 + 40
      };
    };

    // Outer structure is stationary (no rotation)
    const portalAngle = 0;
    // Only the first inner ring rotates slowly as requested
    let innerRingAngle = 0;
    let pulseTime = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      pulseTime += dt * 1.8;
      // First inner ring rotates slowly (clockwise, ~0.08 rad/s)
      innerRingAngle += 0.08 * dt;

      // Smooth mouse tilt & parallax
      mousePosRef.current.x += (mousePosRef.current.targetX - mousePosRef.current.x) * 0.05;
      mousePosRef.current.y += (mousePosRef.current.targetY - mousePosRef.current.y) * 0.05;
      tiltRef.current.x += (tiltRef.current.targetX - tiltRef.current.x) * 0.05;
      tiltRef.current.y += (tiltRef.current.targetY - tiltRef.current.y) * 0.05;

      const cx = width / 2 + mousePosRef.current.x * 20;
      const cy = height / 2 + mousePosRef.current.y * 20;
      const maxDim = Math.min(width, height);
      const portalRadius = Math.max(140, maxDim * 0.38);

      // 1. Clear background: deep cosmos space
      ctx.fillStyle = '#030509';
      ctx.fillRect(0, 0, width, height);

      // Subtle deep cosmic dust / nebula haze in background
      const nebulaGrad = ctx.createRadialGradient(cx, cy, portalRadius * 0.2, cx, cy, portalRadius * 2.8);
      nebulaGrad.addColorStop(0, 'rgba(5, 18, 36, 0.45)');
      nebulaGrad.addColorStop(0.45, 'rgba(3, 10, 22, 0.25)');
      nebulaGrad.addColorStop(1, 'rgba(1, 3, 6, 0)');
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Starfield Points
      const parallaxX = mousePosRef.current.x * 40;
      const parallaxY = mousePosRef.current.y * 40;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const screenX = width / 2 + (s.x - parallaxX * s.z);
        const screenY = height / 2 + (s.y - parallaxY * s.z);

        // Render stars if within viewport bounds
        if (screenX >= -10 && screenX <= width + 10 && screenY >= -10 && screenY <= height + 10) {
          const twinkle = 0.5 + 0.5 * Math.sin(now * 0.002 * s.twinkleSpeed + s.twinkleOffset);
          const currentAlpha = Math.min(1, Math.max(0.08, s.baseAlpha * (0.4 + 0.6 * twinkle)));

          ctx.fillStyle = s.color;
          ctx.globalAlpha = currentAlpha;
          ctx.beginPath();
          ctx.arc(screenX, screenY, s.radius, 0, Math.PI * 2);
          ctx.fill();

          // Subtle star glow halo for brighter/larger stars
          if (s.radius > 1.2 && twinkle > 0.7) {
            ctx.fillStyle = s.color;
            ctx.globalAlpha = currentAlpha * 0.25;
            ctx.beginPath();
            ctx.arc(screenX, screenY, s.radius * 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1.0;

      // 3. Render Electronic Metallic Portal
      ctx.save();
      ctx.translate(cx, cy);

      // Apply subtle 3D perspective distortion (tilt)
      const scaleX = 1 - Math.abs(tiltRef.current.y) * 0.06;
      const scaleY = 1 - Math.abs(tiltRef.current.x) * 0.06;
      ctx.scale(scaleX, scaleY);

      // Soft ambient cyan/blue back-glow around outer perimeter
      const outerGlow = ctx.createRadialGradient(0, 0, portalRadius * 0.75, 0, 0, portalRadius * 1.35);
      const glowIntensity = isInteractingRef.current ? 0.35 : 0.18 + 0.04 * Math.sin(pulseTime);
      outerGlow.addColorStop(0, `rgba(0, 210, 255, ${glowIntensity * 0.8})`);
      outerGlow.addColorStop(0.3, `rgba(0, 140, 255, ${glowIntensity * 0.4})`);
      outerGlow.addColorStop(0.7, `rgba(0, 70, 180, ${glowIntensity * 0.15})`);
      outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, portalRadius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Rotate with portal angle (CLOCKWISE)
      ctx.save();
      ctx.rotate(portalAngle);

      // --- LAYER 1: OUTER DARK TITANIUM BEZEL ---
      const rOuterMax = portalRadius;
      const rOuterMin = portalRadius * 0.93;

      const outerGrad = ctx.createRadialGradient(0, 0, rOuterMin, 0, 0, rOuterMax);
      outerGrad.addColorStop(0, '#1c2430');
      outerGrad.addColorStop(0.5, '#3b4758');
      outerGrad.addColorStop(0.85, '#222c3a');
      outerGrad.addColorStop(1, '#0e131b');

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rOuterMax, 0, Math.PI * 2);
      ctx.arc(0, 0, rOuterMin, 0, Math.PI * 2, true);
      ctx.fill();

      // Outer bezel tick notches
      const totalTicks = 72;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < totalTicks; i++) {
        const a = (i * Math.PI * 2) / totalTicks;
        const isMajor = i % 6 === 0;
        const tickInner = isMajor ? rOuterMin + 2 : rOuterMin + 6;
        const tickOuter = rOuterMax - 2;

        ctx.strokeStyle = isMajor ? 'rgba(0, 230, 255, 0.75)' : 'rgba(160, 180, 205, 0.4)';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * tickInner, Math.sin(a) * tickInner);
        ctx.lineTo(Math.cos(a) * tickOuter, Math.sin(a) * tickOuter);
        ctx.stroke();
      }

      // --- LAYER 2: SEGMENTED METALLIC ARMOR PLATES (BRUSHED SILVER / TITANIUM) ---
      // Matching the iconic metallic segmented plates in the reference image
      const numPlates = 8;
      const rPlateMax = portalRadius * 0.925;
      const rPlateMin = portalRadius * 0.72;
      const plateGap = 0.045; // gap in radians
      const plateArc = (Math.PI * 2) / numPlates - plateGap;

      for (let i = 0; i < numPlates; i++) {
        const startA = i * ((Math.PI * 2) / numPlates) + plateGap / 2;
        const endA = startA + plateArc;
        const midA = (startA + endA) / 2;

        ctx.save();
        // Path for curved metallic segment plate
        ctx.beginPath();
        ctx.arc(0, 0, rPlateMax, startA, endA);
        ctx.arc(0, 0, rPlateMin, endA, startA, true);
        ctx.closePath();

        // Metallic conical/linear gradient simulating brushed aluminum/steel reflections
        const gradX1 = Math.cos(midA) * rPlateMin;
        const gradY1 = Math.sin(midA) * rPlateMin;
        const gradX2 = Math.cos(midA) * rPlateMax;
        const gradY2 = Math.sin(midA) * rPlateMax;

        const plateGrad = ctx.createLinearGradient(gradX1, gradY1, gradX2, gradY2);
        // Realistic metallic sheen shades
        plateGrad.addColorStop(0, '#596577');
        plateGrad.addColorStop(0.18, '#b8c4d2');
        plateGrad.addColorStop(0.42, '#f1f5f9');
        plateGrad.addColorStop(0.65, '#cbd5e1');
        plateGrad.addColorStop(0.88, '#8190a2');
        plateGrad.addColorStop(1, '#3b4554');

        ctx.fillStyle = plateGrad;
        ctx.fill();

        // Plate beveled rim highlight (light source simulated)
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.stroke();

        // Inset panel seam / mechanical groove on each plate
        const rGroove = (rPlateMax + rPlateMin) / 2;
        ctx.beginPath();
        ctx.arc(0, 0, rGroove, startA + 0.04, endA - 0.04);
        ctx.strokeStyle = 'rgba(20, 26, 36, 0.7)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Inset glowing blue cyan status telemetry line inside the plate groove
        ctx.beginPath();
        ctx.arc(0, 0, rGroove, startA + 0.06, startA + (endA - startA) * 0.45);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Metallic hex bolt rivets at segment corners
        const boltRadius = rPlateMin + 12;
        const boltPositions = [startA + 0.05, endA - 0.05];
        for (const bAngle of boltPositions) {
          const bx = Math.cos(bAngle) * boltRadius;
          const by = Math.sin(bAngle) * boltRadius;

          ctx.beginPath();
          ctx.arc(bx, by, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = '#1e2633';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(bx - 0.6, by - 0.6, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }

        ctx.restore();
      }

      // --- LAYER 3: RECESSED GLOWING CYAN ENERGY CONDUIT TRACK ---
      const rConduitMax = portalRadius * 0.718;
      const rConduitMin = portalRadius * 0.585;

      // Dark sunken track background
      const conduitBaseGrad = ctx.createRadialGradient(0, 0, rConduitMin, 0, 0, rConduitMax);
      conduitBaseGrad.addColorStop(0, '#02101e');
      conduitBaseGrad.addColorStop(0.5, '#04223d');
      conduitBaseGrad.addColorStop(1, '#051426');
      ctx.fillStyle = conduitBaseGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rConduitMax, 0, Math.PI * 2);
      ctx.arc(0, 0, rConduitMin, 0, Math.PI * 2, true);
      ctx.fill();

      // Glowing circular circuit tracks inside conduit
      const conduitRings = [
        rConduitMin + (rConduitMax - rConduitMin) * 0.28,
        rConduitMin + (rConduitMax - rConduitMin) * 0.5,
        rConduitMin + (rConduitMax - rConduitMin) * 0.72
      ];

      for (let idx = 0; idx < conduitRings.length; idx++) {
        const ringR = conduitRings[idx];
        ctx.save();
        ctx.strokeStyle = idx === 1 ? 'rgba(0, 240, 255, 0.9)' : 'rgba(0, 160, 255, 0.45)';
        ctx.lineWidth = idx === 1 ? 2.2 : 1.2;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = idx === 1 ? 9 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Stationary glowing energy arcs (matching reference image sectors)
      const pulseSegments = 8;
      for (let p = 0; p < pulseSegments; p++) {
        const pAngle = (p * Math.PI * 2) / pulseSegments + 0.12;
        const pArcLength = 0.54;
        const pRadius = conduitRings[1];

        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, pRadius, pAngle, pAngle + pArcLength);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2.8;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }

      // Energy conduit radial tick dividers (like in the reference)
      const conduitTicks = 48;
      for (let t = 0; t < conduitTicks; t++) {
        const tAngle = (t * Math.PI * 2) / conduitTicks;
        const tInner = rConduitMin + 3;
        const tOuter = rConduitMax - 3;
        const isCyanHighlight = t % 4 === 0;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(Math.cos(tAngle) * tInner, Math.sin(tAngle) * tInner);
        ctx.lineTo(Math.cos(tAngle) * tOuter, Math.sin(tAngle) * tOuter);
        ctx.strokeStyle = isCyanHighlight ? 'rgba(0, 240, 255, 0.8)' : 'rgba(120, 160, 200, 0.25)';
        ctx.lineWidth = isCyanHighlight ? 1.8 : 1;
        if (isCyanHighlight) {
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 5;
        }
        ctx.stroke();
        ctx.restore();
      }

      // --- LAYER 4: FIRST INNER MECHANICAL RING (ROTATES SLOWLY) ---
      // Only this first inner ring rotates slowly, exactly as requested
      ctx.save();
      ctx.rotate(innerRingAngle);

      const rIrisMax = portalRadius * 0.582;
      const rIrisMin = portalRadius * 0.44;

      // Base collar track for the inner rotating ring
      const innerChassisGrad = ctx.createRadialGradient(0, 0, rIrisMin, 0, 0, rIrisMax);
      innerChassisGrad.addColorStop(0, '#18202c');
      innerChassisGrad.addColorStop(0.5, '#334155');
      innerChassisGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = innerChassisGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rIrisMax, 0, Math.PI * 2);
      ctx.arc(0, 0, rIrisMin, 0, Math.PI * 2, true);
      ctx.fill();

      // Interlocking metallic teeth surrounding the portal's perimeter
      const irisTeethCount = 16;
      const toothGap = 0.05;
      const toothArc = (Math.PI * 2) / irisTeethCount - toothGap;

      for (let k = 0; k < irisTeethCount; k++) {
        const toothStart = k * ((Math.PI * 2) / irisTeethCount) + toothGap / 2;
        const toothEnd = toothStart + toothArc;
        const toothMid = (toothStart + toothEnd) / 2;

        ctx.save();
        // Stepped tooth profile
        ctx.beginPath();
        ctx.arc(0, 0, rIrisMax, toothStart, toothEnd);
        // Inward stepped tooth tab
        const stepArc = toothArc * 0.2;
        const rStep = rIrisMin + (rIrisMax - rIrisMin) * 0.25;
        ctx.lineTo(Math.cos(toothEnd - stepArc) * rStep, Math.sin(toothEnd - stepArc) * rStep);
        ctx.arc(0, 0, rIrisMin, toothEnd - stepArc, toothStart + stepArc, true);
        ctx.lineTo(Math.cos(toothStart) * rIrisMax, Math.sin(toothStart) * rIrisMax);
        ctx.closePath();

        // Metallic gradient for teeth
        const tx1 = Math.cos(toothMid) * rIrisMin;
        const ty1 = Math.sin(toothMid) * rIrisMin;
        const tx2 = Math.cos(toothMid) * rIrisMax;
        const ty2 = Math.sin(toothMid) * rIrisMax;

        const toothGrad = ctx.createLinearGradient(tx1, ty1, tx2, ty2);
        toothGrad.addColorStop(0, '#303947');
        toothGrad.addColorStop(0.3, '#7d8b9d');
        toothGrad.addColorStop(0.65, '#e2e8f0');
        toothGrad.addColorStop(1, '#475569');

        ctx.fillStyle = toothGrad;
        ctx.fill();

        // Specular chrome edge
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.stroke();

        // Inset glowing cyan light slot on each tooth
        const slotR = (rIrisMin + rIrisMax) * 0.52;
        const slotA = toothMid;
        ctx.beginPath();
        ctx.arc(Math.cos(slotA) * slotR, Math.sin(slotA) * slotR, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 5;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
      }

      ctx.restore(); // end innerRingAngle rotation

      // --- LAYER 5: PROMINENT HEAVY HYDRAULIC MECHANICAL CLAMPS ---
      // As seen prominently at 12 o'clock and 6 o'clock in the reference photo (and 3/9 secondary)
      const clampAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

      for (let c = 0; c < clampAngles.length; c++) {
        const cAngle = clampAngles[c];
        const isPrimary = c % 2 === 1; // 12 o'clock & 6 o'clock like reference image
        const clampWidth = isPrimary ? portalRadius * 0.17 : portalRadius * 0.12;
        const clampInnerR = portalRadius * 0.65;
        const clampOuterR = portalRadius * 1.02;

        ctx.save();
        ctx.rotate(cAngle);

        // Clamp cast shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Heavy metallic bracket chassis
        const halfW = clampWidth / 2;
        ctx.beginPath();
        ctx.rect(-halfW, clampInnerR, clampWidth, clampOuterR - clampInnerR);

        const clampGrad = ctx.createLinearGradient(-halfW, clampInnerR, halfW, clampOuterR);
        clampGrad.addColorStop(0, '#2d3748');
        clampGrad.addColorStop(0.2, '#64748b');
        clampGrad.addColorStop(0.5, '#cbd5e1');
        clampGrad.addColorStop(0.8, '#475569');
        clampGrad.addColorStop(1, '#1e293b');

        ctx.fillStyle = clampGrad;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Beveled bracket rim
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.stroke();

        // Stepped top plate
        const innerPlateW = clampWidth * 0.72;
        const innerPlateH = (clampOuterR - clampInnerR) * 0.65;
        const innerPlateY = clampInnerR + (clampOuterR - clampInnerR) * 0.18;

        ctx.beginPath();
        ctx.rect(-innerPlateW / 2, innerPlateY, innerPlateW, innerPlateH);
        ctx.fillStyle = '#1e2532';
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Dual glowing cyan LED power indicator strips (matching reference image)
        const ledW = innerPlateW * 0.28;
        const ledH = innerPlateH * 0.45;
        const ledY = innerPlateY + (innerPlateH - ledH) / 2;

        const leftLedX = -innerPlateW / 2 + innerPlateW * 0.15;
        const rightLedX = innerPlateW / 2 - innerPlateW * 0.15 - ledW;

        for (const lx of [leftLedX, rightLedX]) {
          ctx.beginPath();
          ctx.rect(lx, ledY, ledW, ledH);
          ctx.fillStyle = '#00f0ff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 8;
          ctx.fill();

          // White-hot center of LED
          ctx.beginPath();
          ctx.rect(lx + 1, ledY + 1, ledW - 2, ledH - 2);
          ctx.fillStyle = '#e0ffff';
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      ctx.restore(); // end portalAngle rotation

      // --- LAYER 6: SPECULAR ANISOTROPIC SHINE OVERLAY ---
      // A static world-space metallic reflection that glints across the rotating ring!
      const specAngle = -Math.PI / 4; // Key light from top-left (-45 deg)
      const specGrad = ctx.createLinearGradient(
        Math.cos(specAngle) * portalRadius,
        Math.sin(specAngle) * portalRadius,
        Math.cos(specAngle + Math.PI) * portalRadius,
        Math.sin(specAngle + Math.PI) * portalRadius
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      specGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.08)');
      specGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      specGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.2)');
      specGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, portalRadius, 0, Math.PI * 2);
      ctx.arc(0, 0, portalRadius * 0.44, 0, Math.PI * 2, true);
      ctx.fillStyle = specGrad;
      ctx.fill();
      ctx.restore();

      // --- LAYER 7: THE DARK CENTER / EVENT HORIZON ("o centro dexe oscuro") ---
      // The user specifically requested: "e o centro dexe oscuro"
      // Deep pitch black void with cyan energy lip
      const rCenterVoid = portalRadius * 0.44;

      // 7a. Glowing cyan event horizon inner rim
      ctx.save();
      const horizonLip = ctx.createRadialGradient(0, 0, rCenterVoid * 0.94, 0, 0, rCenterVoid * 1.02);
      horizonLip.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
      horizonLip.addColorStop(0.4, 'rgba(0, 160, 255, 0.7)');
      horizonLip.addColorStop(0.8, 'rgba(0, 80, 200, 0.3)');
      horizonLip.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = horizonLip;
      ctx.beginPath();
      ctx.arc(0, 0, rCenterVoid * 1.02, 0, Math.PI * 2);
      ctx.fill();

      // Sharp cyan neon boundary line
      ctx.beginPath();
      ctx.arc(0, 0, rCenterVoid * 0.98, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 7b. Pitch black void core (absorbing all light into the abyss)
      const voidGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rCenterVoid * 0.98);
      voidGrad.addColorStop(0, '#000000');
      voidGrad.addColorStop(0.7, '#010204');
      voidGrad.addColorStop(0.92, '#02060c');
      voidGrad.addColorStop(1, 'rgba(0, 20, 40, 0.85)');

      ctx.fillStyle = voidGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rCenterVoid * 0.98, 0, Math.PI * 2);
      ctx.fill();

      // 7c. Microscopic singularity particles drawn inward to darkness
      if (singularityParticles.length < maxParticles && Math.random() < 0.3) {
        singularityParticles.push(spawnSingularityParticle(portalRadius));
      }

      for (let pIdx = singularityParticles.length - 1; pIdx >= 0; pIdx--) {
        const sp = singularityParticles[pIdx];
        sp.life++;
        sp.dist -= sp.speed * (1 + (1 - sp.dist / rCenterVoid) * 1.5);
        // Direct inward attraction, no circular rotation

        const progress = sp.life / sp.maxLife;
        const currentAlpha = sp.alpha * (1 - progress) * (sp.dist / rCenterVoid);

        if (sp.dist <= 5 || sp.life >= sp.maxLife) {
          singularityParticles.splice(pIdx, 1);
          continue;
        }

        const px = Math.cos(sp.angle) * sp.dist;
        const py = Math.sin(sp.angle) * sp.dist;

        ctx.fillStyle = '#00f0ff';
        ctx.globalAlpha = Math.max(0, currentAlpha);
        ctx.beginPath();
        ctx.arc(px, py, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // 7d. DUONN Logomark and "SUPPORT CENTER" in small letters in the center
      const logo = logoImageRef.current;
      if (logo && logo.complete && logo.naturalWidth > 0) {
        ctx.save();
        const logoAspect = logo.naturalHeight / logo.naturalWidth;
        // Size proportionally to fit comfortably inside the dark center void
        const targetLogoW = Math.min(rCenterVoid * 1.35, 185);
        const targetLogoH = targetLogoW * logoAspect;
        const logoOffsetY = -targetLogoH * 0.5 - 7;

        // Draw DUONN logomark (blends seamlessly onto black void)
        ctx.drawImage(
          logo,
          -targetLogoW / 2,
          logoOffsetY,
          targetLogoW,
          targetLogoH
        );

        // Small letters: "SUPPORT CENTER"
        const textY = logoOffsetY + targetLogoH + 9;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // High-tech sci-fi typography in small letters
        const fontSize = Math.max(9, Math.min(11, targetLogoW * 0.072));
        ctx.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = 'rgba(180, 240, 255, 0.92)';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.75)';
        ctx.shadowBlur = 6;

        // Widely spaced letters for refined aesthetic
        const supportText = 'S U P P O R T   C E N T E R';
        ctx.fillText(supportText, 0, textY);

        ctx.restore();
      }

      ctx.restore(); // end center void

      ctx.restore(); // end tilt/translate

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Mouse / Touch handlers for subtle parallax and 3D tilt
    const handlePointerMove = (e: MouseEvent) => {
      const normX = (e.clientX / width - 0.5) * 2;
      const normY = (e.clientY / height - 0.5) * 2;
      mousePosRef.current.targetX = normX;
      mousePosRef.current.targetY = normY;
      tiltRef.current.targetX = normY * 0.15; // tilt X based on Y
      tiltRef.current.targetY = -normX * 0.15; // tilt Y based on X

      // Cursor visibility management
      setCursorHidden(false);
      if (cursorTimeoutRef.current) window.clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = window.setTimeout(() => {
        setCursorHidden(true);
      }, 3000);
    };

    const handlePointerDown = () => {
      isInteractingRef.current = true;
      initOrResumeAudio();
    };

    const handlePointerUp = () => {
      isInteractingRef.current = false;
    };

    const handleDoubleClick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        toggleAudio();
      } else if (e.code === 'KeyF') {
        handleDoubleClick();
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('keydown', handleKeyDown);
      if (cursorTimeoutRef.current) window.clearTimeout(cursorTimeoutRef.current);
    };
  }, []);

  // Ambient deep-space procedural hum / warp resonance (Web Audio API)
  const initOrResumeAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioCtxRef.current = ctx;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
        masterGain.connect(ctx.destination);
        audioGainRef.current = masterGain;

        // Sub bass drone
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1 note

        // Harmonic tone
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(110, ctx.currentTime); // A2 note

        // Low-pass filter for smooth cinematic deep space sound
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, ctx.currentTime);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);

        osc1.start();
        osc2.start();

        // Smooth fade-in to comfortable ambient level
        masterGain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 3);
        isAudioActiveRef.current = true;
      } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch {
      // Audio autoplay policy handled smoothly
    }
  };

  const toggleAudio = () => {
    if (!audioCtxRef.current) {
      initOrResumeAudio();
      return;
    }
    const ctx = audioCtxRef.current;
    const gain = audioGainRef.current;
    if (!gain) return;

    if (isAudioActiveRef.current) {
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      isAudioActiveRef.current = false;
    } else {
      ctx.resume().then(() => {
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 1.2);
        isAudioActiveRef.current = true;
      });
    }
  };

  return (
    <div
      className={`fixed inset-0 w-full h-full bg-[#030509] overflow-hidden select-none transition-all duration-300 ${
        cursorHidden ? 'cursor-none' : 'cursor-default'
      }`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
