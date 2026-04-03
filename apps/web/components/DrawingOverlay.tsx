'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Tool = 'none'|'trendline'|'fib';
type Pt = { x:number; y:number };
type Trend = { a:Pt; b:Pt };
type Fib = { hi:Pt; lo:Pt };

export default function DrawingOverlay({ 
  width, 
  height,
  currentPrice,
  onDrawingComplete 
}: { 
  width:number; 
  height:number;
  currentPrice?: number;
  onDrawingComplete?: (analysis: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [trendlines, setTrendlines] = useState<Trend[]>([]);
  const [fibs, setFibs] = useState<Fib[]>([]);
  const [dragStart, setDragStart] = useState<Pt|null>(null);
  const [dragNow, setDragNow] = useState<Pt|null>(null);

  const levels = useMemo(()=> [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], []);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dm-drawings');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.trendlines) setTrendlines(data.trendlines);
        if (data.fibs) setFibs(data.fibs);
      } catch (e) {
        console.error('Failed to load drawings:', e);
      }
    }
  }, []);

  // Save to localStorage whenever drawings change
  useEffect(() => {
    localStorage.setItem('dm-drawings', JSON.stringify({ trendlines, fibs }));
  }, [trendlines, fibs]);

  // Convert canvas Y coordinate to approximate price
  function yToPrice(y: number, currentPrice: number): number {
    // Rough approximation: assume chart shows ±10% around current price
    const priceRange = currentPrice * 0.2; // 20% total range
    const priceHigh = currentPrice * 1.1;
    const pricePerPixel = priceRange / height;
    return priceHigh - (y * pricePerPixel);
  }

  // Analyze a trendline
  function analyzeTrendline(trend: Trend, currentPrice: number): string {
    const priceA = yToPrice(trend.a.y, currentPrice);
    const priceB = yToPrice(trend.b.y, currentPrice);
    
    const deltaX = trend.b.x - trend.a.x;
    const deltaY = priceB - priceA;
    const slope = deltaY / deltaX;
    const angle = Math.atan(slope) * (180 / Math.PI);
    
    const isUpward = priceB > priceA;
    const avgPrice = (priceA + priceB) / 2;
    const distanceFromCurrent = ((currentPrice - avgPrice) / avgPrice * 100);
    
    let analysis = `**What You Drew:**\n`;
    analysis += isUpward 
      ? `An upward line from $${priceA.toFixed(2)} to $${priceB.toFixed(2)}\n\n`
      : `A downward line from $${priceA.toFixed(2)} to $${priceB.toFixed(2)}\n\n`;
    
    analysis += `**What This Means:**\n`;
    if (isUpward) {
      analysis += `This line shows where the stock has been bouncing UP from (like a floor).\n`;
      analysis += `If the price stays above this line, it suggests the stock is staying strong.\n\n`;
    } else {
      analysis += `This line shows where the stock has been getting stuck (like a ceiling).\n`;
      analysis += `If the price stays below this line, it suggests the stock is struggling to go higher.\n\n`;
    }
    
    analysis += `**Right Now:**\n`;
    analysis += `Current stock price: $${currentPrice.toFixed(2)}\n`;
    
    if (isUpward && distanceFromCurrent > 2) {
      analysis += `✅ Price is holding above the line - good sign! The "floor" is holding.`;
    } else if (isUpward && distanceFromCurrent < -2) {
      analysis += `⚠️ Price dropped below the line - the "floor" broke. This could mean the upward trend is weakening.`;
    } else if (!isUpward && distanceFromCurrent < -2) {
      analysis += `🔻 Price is stuck below the line - the "ceiling" is holding it down.`;
    } else if (!isUpward && distanceFromCurrent > 2) {
      analysis += `⚡ Price broke above the line - it finally pushed through the "ceiling"! Could be turning around.`;
    } else {
      analysis += `💡 Price is right near the line. Watch what happens next - will it bounce off or break through?`;
    }
    
    return analysis;
  }

  // Analyze Fibonacci levels
  function analyzeFib(fib: Fib, currentPrice: number): string {
    const priceHi = yToPrice(fib.hi.y, currentPrice);
    const priceLo = yToPrice(fib.lo.y, currentPrice);
    
    const high = Math.max(priceHi, priceLo);
    const low = Math.min(priceHi, priceLo);
    const range = high - low;
    
    // Calculate key Fibonacci price levels
    const fib236 = high - (range * 0.236);
    const fib382 = high - (range * 0.382);
    const fib500 = high - (range * 0.5);
    const fib618 = high - (range * 0.618);
    const fib786 = high - (range * 0.786);
    
    let analysis = `**What You Drew:**\n`;
    analysis += `You marked the stock's recent high ($${high.toFixed(2)}) and low ($${low.toFixed(2)}).\n\n`;
    
    analysis += `**What This Shows:**\n`;
    analysis += `When stocks move up or down, they often pause or reverse at predictable spots.\n`;
    analysis += `These horizontal lines show where the stock might "take a breath" on its way back.\n\n`;
    
    analysis += `**Key Price Levels to Watch:**\n`;
    analysis += `• $${fib236.toFixed(2)} - First potential pause spot\n`;
    analysis += `• $${fib382.toFixed(2)} - Common bounce area\n`;
    analysis += `• $${fib500.toFixed(2)} - Halfway back (50/50 zone)\n`;
    analysis += `• $${fib618.toFixed(2)} - Strong support level (the "golden ratio")\n`;
    analysis += `• $${fib786.toFixed(2)} - Last chance before going all the way back\n\n`;
    
    // Find nearest level
    const levels = [
      { name: 'first pause spot', price: fib236 },
      { name: 'common bounce area', price: fib382 },
      { name: '50/50 zone', price: fib500 },
      { name: 'golden ratio level', price: fib618 },
      { name: 'last chance level', price: fib786 }
    ];
    
    const closest = levels.reduce((prev, curr) => 
      Math.abs(curr.price - currentPrice) < Math.abs(prev.price - currentPrice) ? curr : prev
    );
    
    const distanceToClosest = ((currentPrice - closest.price) / closest.price * 100);
    
    analysis += `**Right Now:**\n`;
    analysis += `Current price: $${currentPrice.toFixed(2)}\n`;
    
    if (Math.abs(distanceToClosest) < 1) {
      analysis += `🎯 The stock is RIGHT AT the ${closest.name} ($${closest.price.toFixed(2)})!\n`;
      analysis += `This is a decision point - it might bounce back up or drop through to the next level.`;
    } else if (currentPrice > closest.price) {
      const nextResistance = levels.find(l => l.price > currentPrice);
      if (nextResistance) {
        analysis += `📈 Stock is moving up. Next level to watch: $${nextResistance.price.toFixed(2)} (${nextResistance.name})`;
      } else {
        analysis += `📈 Stock is above all the levels - showing strength!`;
      }
    } else {
      const nextSupport = [...levels].reverse().find(l => l.price < currentPrice);
      if (nextSupport) {
        analysis += `📉 Stock is dropping. Next level where it might stop falling: $${nextSupport.price.toFixed(2)} (${nextSupport.name})`;
      } else {
        analysis += `📉 Stock is below all the levels - might be headed back to the original low.`;
      }
    }
    
    return analysis;
  }

  function isNear(price1: number, price2: number): boolean {
    return Math.abs(price1 - price2) / price1 < 0.01; // Within 1%
  }

  function redraw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0,0,width,height);

    // Trendlines
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#60a5fa';
    for (const t of trendlines){
      ctx.beginPath();
      ctx.moveTo(t.a.x, t.a.y);
      ctx.lineTo(t.b.x, t.b.y);
      ctx.stroke();
    }

    // Fibonacci
    for (const f of fibs){
      const yHi = f.hi.y;
      const yLo = f.lo.y;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#a78bfa';
      ctx.fillStyle = 'rgba(167,139,250,0.12)';
      const top = Math.min(yHi, yLo);
      const bot = Math.max(yHi, yLo);
      ctx.fillRect(0, top, width, bot-top);

      ctx.font = '12px ui-sans-serif';
      ctx.fillStyle = '#e5e7eb';
      for (const lv of levels){
        const y = yHi + (yLo-yHi)*lv;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillText(`${Math.round(lv*1000)/10}%`, 8, y-4);
      }
    }

    // In-progress drag preview
    if (tool !== 'none' && dragStart && dragNow){
      ctx.setLineDash([6,6]);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(dragNow.x, dragNow.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  useEffect(()=>{ redraw(); }, [trendlines, fibs, dragStart, dragNow, tool, width, height]);

  function onDown(e:React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const p = { x: e.clientX-rect.left, y: e.clientY-rect.top };
    setDragStart(p);
    setDragNow(p);
  }
  function onMove(e:React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStart) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    setDragNow({ x: e.clientX-rect.left, y: e.clientY-rect.top });
  }
  function onUp() {
    if (!dragStart || !dragNow) { setDragStart(null); setDragNow(null); return; }
    
    if (tool === 'trendline') {
      const newTrend = { a: dragStart, b: dragNow };
      setTrendlines(prev => [...prev, newTrend]);
      
      if (currentPrice && onDrawingComplete) {
        const analysis = analyzeTrendline(newTrend, currentPrice);
        onDrawingComplete(analysis);
      }
    }
    
    if (tool === 'fib') {
      const newFib = { hi: dragStart, lo: dragNow };
      setFibs(prev => [...prev, newFib]);
      
      if (currentPrice && onDrawingComplete) {
        const analysis = analyzeFib(newFib, currentPrice);
        onDrawingComplete(analysis);
      }
    }
    
    setDragStart(null);
    setDragNow(null);
  }

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex: 10 }}>
      <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:8, zIndex: 50, pointerEvents:'auto' }}>
        <button onClick={()=>setTool('none')} style={btn(tool==='none')}>Cursor</button>
        <button onClick={()=>setTool('trendline')} style={btn(tool==='trendline')}>Trendline</button>
        <button onClick={()=>setTool('fib')} style={btn(tool==='fib')}>Fib</button>
        <button onClick={()=>{setTrendlines([]); setFibs([]);}} style={btn(false)}>Clear</button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        style={{ 
          width:'100%', 
          height:'100%', 
          cursor: tool==='none'?'default':'crosshair',
          pointerEvents: tool === 'none' ? 'none' : 'auto'
        }}
      />
    </div>
  );
}

function btn(active:boolean){
  return {
    padding:'8px 10px',
    borderRadius: 999,
    background: active ? '#2563eb' : '#0b1226',
    border: '1px solid #1f2a44',
    color:'#e5e7eb',
    fontWeight: 800,
    fontSize: 12
  } as React.CSSProperties;
}