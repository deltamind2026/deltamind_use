
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Tool = 'none'|'trendline'|'fib';
type Pt = { x:number; y:number };
type Trend = { a:Pt; b:Pt };
type Fib = { hi:Pt; lo:Pt };

export default function DrawingOverlay({ width, height }: { width:number; height:number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [trendlines, setTrendlines] = useState<Trend[]>([]);
  const [fibs, setFibs] = useState<Fib[]>([]);
  const [dragStart, setDragStart] = useState<Pt|null>(null);
  const [dragNow, setDragNow] = useState<Pt|null>(null);

  const levels = useMemo(()=> [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], []);

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
    if (tool === 'trendline') setTrendlines(prev => [...prev, { a: dragStart, b: dragNow }]);
    if (tool === 'fib') setFibs(prev => [...prev, { hi: dragStart, lo: dragNow }]);
    setDragStart(null);
    setDragNow(null);
  }

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'auto' }}>
      <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:8, zIndex: 50 }}>
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
        style={{ width:'100%', height:'100%', cursor: tool==='none'?'default':'crosshair' }}
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
