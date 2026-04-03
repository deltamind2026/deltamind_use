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
  const marketStateRef = useRef<any>({});
  const multiStateRef = useRef<any>({});
  const optionsRef = useRef<any[]>([]);

  const [aiText,setAiText]=useState("Analyzing market...");
  const [drawingAnalysis, setDrawingAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);  // ADD THIS
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

    chart.subscribeCrosshairMove(param=>{
      if(!param.time || !barsRef.current.length) return;

      const bars=barsRef.current;
      const idx=bars.findIndex(b=>b.t===param.time);
      if(idx<0) return;

      const candle={
        open:bars[idx].o,
        high:bars[idx].h,
        low:bars[idx].l,
        close:bars[idx].c,
        volume:bars[idx].v
      };

      window.dispatchEvent(new CustomEvent("dm-hover-candle",{
        detail:{candle,market_state:marketStateRef.current}
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

          setAiText(ai?.explanation||"AI unavailable");
        }catch(err){
          console.error("AI error:", err);
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
        <div style={{marginTop:6,whiteSpace:"pre-wrap"}}>{aiText}</div>
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
    </div>
  );
}