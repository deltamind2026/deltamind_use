'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineStyle, CrosshairMode, UTCTimestamp } from 'lightweight-charts';
import type { OHLCV } from '../lib/ta/series';
import { bollinger, macd, rsi, sma, vwap, ema } from '../lib/ta/series';
import type { IndicatorSettings } from '../lib/ta/settings';
import DrawingOverlay from './DrawingOverlay';
import HoverAI from './HoverAI';

/* ---------------- helpers ---------------- */

function mapLine(data:number[], bars:OHLCV[]){
  if (!data || !bars) return [];
  return data.map((v,i)=>v?{time:bars[i].t as UTCTimestamp,value:v}:null).filter(Boolean) as any;
}

type AiMetric = {
  name: string;
  value: string;
  explanation: string;
  evaluation: string;
  evaluationExplanation: string;
};

type AiExplanation = {
  metrics: AiMetric[];
  current?: string;
  future?: string;
  risks?: string;
  fallbackText?: string;
};

function parseAiExplanation(raw?: string): AiExplanation {
  if (!raw || typeof raw !== 'string') {
    return { metrics: [], fallbackText: "AI unavailable" };
  }

  const metricRegex = /\{"metric":\s*\[(.*?)\]\}/g;
  const sectionRegex = /\{"(current|future|risks)":\s*(.+?)\}/g;

  const cleanToken = (token: string) =>
    token.trim().replace(/^['"]|['"]$/g, '').replace(/\\"/g, '"');

  const splitMetricParts = (content: string) => {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      if (char === '"' && prev !== '\\') {
        inQuotes = !inQuotes;
      }

      if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    if (current) parts.push(current);
    return parts.map(cleanToken);
  };

  const metrics: AiMetric[] = [];
  let metricMatch: RegExpExecArray | null;

  while ((metricMatch = metricRegex.exec(raw)) !== null) {
    const [name, value, explanation, evaluation, evaluationExplanation] = splitMetricParts(metricMatch[1]);
    if (!name) continue;

    metrics.push({
      name,
      value: value || '',
      explanation: explanation || '',
      evaluation: evaluation || 'N/A',
      evaluationExplanation: evaluationExplanation || '',
    });
  }

  const sections: Partial<Record<'current' | 'future' | 'risks', string>> = {};
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRegex.exec(raw)) !== null) {
    sections[sectionMatch[1] as 'current' | 'future' | 'risks'] = cleanToken(sectionMatch[2]);
  }

  if (!metrics.length && !sections.current && !sections.future && !sections.risks) {
    return { metrics: [], fallbackText: raw };
  }

  return {
    metrics,
    current: sections.current,
    future: sections.future,
    risks: sections.risks,
  };
}

/* ------------------------------------------------ */

export default function ProChart({
  symbol,
  tf,
  compareSymbol,
  settings
}:{ symbol:string; tf:string; compareSymbol?:string; settings:IndicatorSettings }){

  const priceRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  const barsRef = useRef<OHLCV[]>([]);
  const chartRef = useRef<any>(null);
  const marketStateRef = useRef<any>({});
  const multiStateRef = useRef<any>({});
  const optionsRef = useRef<any[]>([]);

  const [aiText,setAiText]=useState("Analyzing market...");
  const [aiExplanation, setAiExplanation] = useState<AiExplanation>({ metrics: [], fallbackText: "Analyzing market..." });
  const [drawingAnalysis, setDrawingAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [timeWindowAnalysis, setTimeWindowAnalysis] = useState<string>("");
  const [analyzingWindow, setAnalyzingWindow] = useState(false);
  const lastHash = useRef<string>("");

  useEffect(()=>{

    if(!priceRef.current || !rsiRef.current || !macdRef.current) return;

    /* ---------------- PRICE CHART ---------------- */

    const chart=createChart(priceRef.current,{
      height:520,
      crosshair:{mode:CrosshairMode.Normal},
      layout:{background:{color:'#020617'},textColor:'#e5e7eb'},
      grid:{vertLines:{color:'#0b1020'},horzLines:{color:'#0b1020'}}
    });
    chartRef.current = chart;

    const candles=chart.addCandlestickSeries();
    const volume=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:''});

    const smaLine=chart.addLineSeries({color:'#facc15',lineWidth:2});
    const vwapLine=chart.addLineSeries({color:'#a78bfa',lineWidth:2});
    const bbU=chart.addLineSeries({color:'#94a3b8',lineWidth:1,lineStyle:LineStyle.Dotted});
    const bbL=chart.addLineSeries({color:'#94a3b8',lineWidth:1,lineStyle:LineStyle.Dotted});

    /* EMA STACK */
    const ema9Line=chart.addLineSeries({color:'#22c55e',lineWidth:2});
    const ema21Line=chart.addLineSeries({color:'#60a5fa',lineWidth:2});
    const ema50Line=chart.addLineSeries({color:'#f59e0b',lineWidth:2});
    const ema200Line=chart.addLineSeries({color:'#ef4444',lineWidth:3});

    let compare:any=null;
    if(compareSymbol) compare=chart.addLineSeries({color:'#f472b6',lineWidth:2});

    /* ---------------- RSI PANEL ---------------- */

    const rsiChart=createChart(rsiRef.current,{height:140,layout:{background:{color:'#020617'}}});
    const rsiLine=rsiChart.addLineSeries({color:'#a78bfa'});

    /* ---------------- MACD PANEL ---------------- */

    const macdChart=createChart(macdRef.current,{height:140,layout:{background:{color:'#020617'}}});
    const macdLine=macdChart.addLineSeries({color:'#22c55e'});
    const signalLine=macdChart.addLineSeries({color:'#ef4444'});
    const hist=macdChart.addHistogramSeries({});

    /* ---------------- HOVER AI ---------------- */

    /* ---------------- HOVER AI ---------------- */

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !barsRef.current.length) return;

      const bars = barsRef.current;
      const idx = bars.findIndex(b => b.t === param.time);
      if (idx < 0) return;

      const candle = {
        open: bars[idx].o,
        high: bars[idx].h,
        low: bars[idx].l,
        close: bars[idx].c,
        volume: bars[idx].v
      };

      // Get mouse position relative to viewport
      const rect = priceRef.current?.getBoundingClientRect();
      const mouseX = param.point?.x ? rect.left + param.point.x : 0;
      const mouseY = param.point?.y ? rect.top + param.point.y : 0;

      window.dispatchEvent(new CustomEvent("dm-hover-candle", {
        detail: { 
          candle, 
          market_state: marketStateRef.current,
          mouseX,
          mouseY
        }
      }));
    });

    /* ---------------- LOAD DATA ---------------- */

    (async()=>{

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';

      /* PRICE DATA */
      const ohlc=await fetch(`${API_URL}/market/ohlc?symbol=${symbol}&tf=${tf}`).then(r=>r.json());

      /* MULTI TIMEFRAME */
      const multi=await fetch(`${API_URL}/market/multi?symbol=${symbol}`).then(r=>r.json());

      /* OPTIONS */
      const options=await fetch(`${API_URL}/options/chain?symbol=${symbol}`).then(r=>r.json());

      /* MAP CANDLES */
      const bars:OHLCV[]=ohlc.candles.map((c:any)=>({
        t:Math.floor(new Date(c.time).getTime()/1000),
        o:c.open,h:c.high,l:c.low,c:c.close,v:c.volume
      }));

      barsRef.current=bars;
      marketStateRef.current=ohlc.market_state||{};
      multiStateRef.current=multi.combined||{};
      optionsRef.current=options.rows||[];

      const closes=bars.map(b=>b.c);

      /* DRAW PRICE */
      candles.setData(bars.map(b=>({time:b.t as UTCTimestamp,open:b.o,high:b.h,low:b.l,close:b.c})));
      volume.setData(bars.map(b=>({time:b.t as UTCTimestamp,value:b.v,color:b.c>b.o?'#22c55e':'#ef4444'})));

      /* INDICATORS */
      smaLine.setData(mapLine(sma(closes,settings.params.SMA.period),bars));
      vwapLine.setData(mapLine(vwap(bars),bars));

      const bb=bollinger(closes,settings.params.BOLL.period,settings.params.BOLL.stdev);
      bbU.setData(mapLine(bb.upper,bars));
      bbL.setData(mapLine(bb.lower,bars));

      ema9Line.setData(mapLine(ema(closes,9),bars));
      ema21Line.setData(mapLine(ema(closes,21),bars));
      ema50Line.setData(mapLine(ema(closes,50),bars));
      ema200Line.setData(mapLine(ema(closes,200),bars));

      /* RSI */
      rsiLine.setData(mapLine(rsi(closes,14),bars));

      /* MACD */
      const m=macd(closes,12,26,9);
      macdLine.setData(mapLine(m.line,bars));
      signalLine.setData(mapLine(m.signal,bars));
      hist.setData(m.hist.map((v,i)=>v!==null?{time:bars[i].t as UTCTimestamp,value:v}:null).filter(Boolean));

      /* COMPARE SYMBOL */
      if(compareSymbol){
        const cmp=await fetch(`${API_URL}/market/ohlc?symbol=${compareSymbol}&tf=${tf}`).then(r=>r.json());
        compare.setData(cmp.candles.map((c:any)=>({time:Math.floor(new Date(c.time).getTime()/1000) as UTCTimestamp,value:c.close})));
      }

      /* AI EXPLANATION */
      const payload={
        asset:symbol,
        timeframe:tf,
        candles:ohlc.candles,
        market_state:marketStateRef.current,
        multi_timeframe:multiStateRef.current,
        options:optionsRef.current
      };

      const hash=JSON.stringify(payload.market_state)+JSON.stringify(payload.multi_timeframe);

      if(hash!==lastHash.current && !loading){  // ADD !loading CHECK
        lastHash.current=hash;
        setLoading(true);  // SET LOADING

        try{
          const ai=await fetch(`${API_URL}/ai/explain`,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(payload)
          }).then(r=>r.json());

          const parsedExplanation = parseAiExplanation(ai?.explanation);
          setAiExplanation(parsedExplanation);
          setAiText(parsedExplanation.fallbackText || "");
        }catch(err){
          console.error("AI error:", err);
          setAiExplanation({ metrics: [], fallbackText: "AI analysis unavailable" });
          setAiText("AI analysis unavailable");
        } finally {
          setLoading(false);  // CLEAR LOADING
        }
      }

    })();

    return()=>{
      chart.remove();
      rsiChart.remove();
      macdChart.remove();
    };

  },[symbol,tf,compareSymbol,settings]);

  /* ---------------- TIME WINDOW ANALYSIS ---------------- */

  async function handleTimeWindow(startX: number, endX: number) {
    if (!barsRef.current.length) return;
    
    setAnalyzingWindow(true);
    setTimeWindowAnalysis("Analyzing this time period...");
    
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';
    const bars = barsRef.current;
    
    // Convert canvas-internal coords (0–800) → CSS pixels → timestamps via LightweightCharts
    const containerWidth = priceRef.current?.getBoundingClientRect().width || 800;
    const scaleBack = containerWidth / 800;
    const timeScale = chartRef.current?.timeScale();

    let startIdx: number;
    let endIdx: number;

    if (timeScale) {
      const startTime = timeScale.coordinateToTime(Math.min(startX, endX) * scaleBack);
      const endTime = timeScale.coordinateToTime(Math.max(startX, endX) * scaleBack);
      startIdx = startTime ? Math.max(0, bars.findIndex(b => b.t >= startTime)) : 0;
      endIdx = endTime
        ? Math.min(bars.length - 1, bars.findIndex(b => b.t >= endTime))
        : bars.length - 1;
      if (endIdx < 0) endIdx = bars.length - 1;
    } else {
      // Fallback: proportion of bar array
      const startRatio = Math.min(startX, endX) / 800;
      const endRatio = Math.max(startX, endX) / 800;
      startIdx = Math.max(0, Math.floor(startRatio * bars.length));
      endIdx = Math.min(bars.length - 1, Math.floor(endRatio * bars.length));
    }
    
    if (startIdx >= endIdx) {
      setTimeWindowAnalysis("Time window too small. Please drag across multiple days.");
      setAnalyzingWindow(false);
      return;
    }
    
    const windowCandles = bars.slice(startIdx, endIdx + 1);
    
    if (windowCandles.length < 2) {
      setTimeWindowAnalysis("Not enough data in this window. Try selecting a wider range.");
      setAnalyzingWindow(false);
      return;
    }
    
    const startPrice = windowCandles[0].c;
    const endPrice = windowCandles[windowCandles.length - 1].c;
    const priceChange = ((endPrice - startPrice) / startPrice * 100);
    
    const startDate = new Date(windowCandles[0].t * 1000).toLocaleDateString();
    const endDate = new Date(windowCandles[windowCandles.length - 1].t * 1000).toLocaleDateString();
    
    try {
      const payload = {
        symbol: symbol,
        start_date: startDate,
        end_date: endDate,
        start_price: startPrice,
        end_price: endPrice,
        price_change_pct: priceChange,
        candles: windowCandles.map(b => ({
          time: new Date(b.t * 1000).toISOString(),
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v
        })),
        market_state: marketStateRef.current
      };
      
      const response = await fetch(`${API_URL}/ai/analyze-period`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      setTimeWindowAnalysis(data?.analysis || "Analysis unavailable");
    } catch (err) {
      console.error("Time window analysis error:", err);
      setTimeWindowAnalysis("Unable to analyze this time period. Please try again.");
    } finally {
      setAnalyzingWindow(false);
    }
  }

  /* ---------------- UI ---------------- */

  return(
    <div>
      {/* Price chart with drawing overlay */}
      <div style={{position:'relative'}}>
        <div ref={priceRef}/>
        <DrawingOverlay 
          width={800} 
          height={520}
          currentPrice={barsRef.current.length > 0 ? barsRef.current[barsRef.current.length - 1].c : undefined}
          onDrawingComplete={(analysis) => setDrawingAnalysis(analysis)}
          onTimeWindowComplete={handleTimeWindow}
        />
      </div>

      {/* RSI and MACD panels */}
      <div ref={rsiRef}/>
      <div ref={macdRef}/>
      
      {/* Hover AI tooltip */}
      <HoverAI/>

      {/* AI Insight panel */}
      <div style={{
        marginTop:10,
        background:"#020617",
        border:"1px solid #1f2a44",
        padding:"12px",
        borderRadius:12,
        color:"#e5e7eb"
      }}>
        <b style={{color:"#22d3ee"}}>DeltaMind Insight</b>
        {aiExplanation.metrics.length > 0 && (
          <div style={{
            marginTop:10,
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',
            gap:10
          }}>
            {aiExplanation.metrics.map((metric, index) => {
              const evaluation = metric.evaluation.toLowerCase();
              const normalizedEvaluation = evaluation;
              const metricColors =
                normalizedEvaluation === 'positive'
                  ? { border: '#22c55e', background: 'rgba(34,197,94,0.10)', accent: '#86efac' }
                  : normalizedEvaluation === 'neutral'
                    ? { border: '#eab308', background: 'rgba(234,179,8,0.10)', accent: '#fde047' }
                    : normalizedEvaluation === 'negative'
                      ? { border: '#ef4444', background: 'rgba(239,68,68,0.10)', accent: '#fca5a5' }
                      : { border: '#475569', background: 'rgba(71,85,105,0.18)', accent: '#cbd5e1' };

              return (
                <div
                  key={`${metric.name}-${index}`}
                  style={{
                    border:`1px solid ${metricColors.border}`,
                    background:metricColors.background,
                    borderRadius:12,
                    padding:'10px 12px'
                  }}
                >
                  <div style={{fontSize:12,color:metricColors.accent,textTransform:'uppercase',letterSpacing:0.6}}>
                    {normalizedEvaluation}
                  </div>
                  <div style={{marginTop:4,fontWeight:700,color:'#f8fafc'}}>{metric.name}</div>
                  {metric.value && (
                    <div style={{marginTop:4,fontSize:18,color:'#e5e7eb'}}>{metric.value}</div>
                  )}
                  {metric.explanation && (
                    <div style={{marginTop:6,fontSize:13,color:'#cbd5e1',lineHeight:1.4}}>{metric.explanation}</div>
                  )}
                  {metric.evaluationExplanation && (
                    <div style={{marginTop:6,fontSize:12,color:'#94a3b8',lineHeight:1.4}}>
                      {metric.evaluationExplanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {aiExplanation.current && <div style={{marginTop:10,whiteSpace:"pre-wrap"}}><b>Current:</b> {aiExplanation.current}</div>}
        {aiExplanation.future && <div style={{marginTop:8,whiteSpace:"pre-wrap"}}><b>Future:</b> {aiExplanation.future}</div>}
        {aiExplanation.risks && <div style={{marginTop:8,whiteSpace:"pre-wrap"}}><b>Risks:</b> {aiExplanation.risks}</div>}
        {!aiExplanation.metrics.length && !aiExplanation.current && !aiExplanation.future && !aiExplanation.risks && (
          <div style={{marginTop:6,whiteSpace:"pre-wrap"}}>{aiText}</div>
        )}
      </div>

      {/* Drawing Analysis panel */}
      {drawingAnalysis && (
        <div style={{
          marginTop:10,
          background:"#020617",
          border:"1px solid #f59e0b",
          padding:"12px",
          borderRadius:12,
          color:"#e5e7eb"
        }}>
          <b style={{color:"#f59e0b"}}>📐 Drawing Analysis</b>
          <div style={{marginTop:6,whiteSpace:"pre-wrap",fontSize:14}}>{drawingAnalysis}</div>
        </div>
      )}

      {/* Time Window Analysis panel */}
      {timeWindowAnalysis && (
        <div style={{
          marginTop:10,
          background:"#020617",
          border:"1px solid #22d3ee",
          padding:"12px",
          borderRadius:12,
          color:"#e5e7eb"
        }}>
          <b style={{color:"#22d3ee"}}>📅 Time Period Analysis</b>
          {analyzingWindow && <div style={{marginTop:6, color:"#94a3b8"}}>Loading AI analysis...</div>}
          <div style={{marginTop:6,whiteSpace:"pre-wrap",fontSize:14}}>{timeWindowAnalysis}</div>
        </div>
      )}
    </div>
  );
}
