'use client';
import { useEffect, useState } from "react";

export default function HoverAI(){
  const [text,setText]=useState<string>("");
  
  useEffect(()=>{
    let lastTime=0;
    const handler=async(e:any)=>{
      const { candle, market_state }=e.detail;
      // throttle
      const now=Date.now();
      if(now-lastTime<150) return;
      lastTime=now;
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';
      
      try{
        const res=await fetch(`${API_URL}/ai/hover`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({candle,market_state})
        }).then(r=>r.json());
        setText(res.text);
      }catch(err){
        console.error("Hover AI error:", err);
      }
    };
    window.addEventListener("dm-hover-candle",handler);
    return()=>window.removeEventListener("dm-hover-candle",handler);
  },[]);
  
  if(!text) return null;
  
  return(
    <div style={{
      position:"absolute",
      top:10,
      right:10,
      background:"#020617",
      border:"1px solid #1f2a44",
      padding:"10px 12px",
      borderRadius:10,
      fontSize:13,
      maxWidth:260,
      color:"#e5e7eb",
      pointerEvents:"none"
    }}>
      {text}
    </div>
  );
}