'use client';
import { useEffect, useState } from "react";

export default function HoverAI(){
  const [text, setText] = useState<string>("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    let lastTime = 0;
    
    const handler = async (e: any) => {
      const { candle, market_state, mouseX, mouseY } = e.detail;
      
      // Update position
      if (mouseX !== undefined && mouseY !== undefined) {
        setPos({ x: mouseX, y: mouseY });
      }
      
      // Throttle API calls
      const now = Date.now();
      if (now - lastTime < 150) return;
      lastTime = now;
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8040';
      
      try {
        const res = await fetch(`${API_URL}/ai/hover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candle, market_state })
        }).then(r => r.json());
        setText(res.text);
      } catch (err) {
        console.error("Hover AI error:", err);
      }
    };
    
    window.addEventListener("dm-hover-candle", handler);
    return () => window.removeEventListener("dm-hover-candle", handler);
  }, []);
  
  if (!text) return null;
  
  return (
    <div style={{
      position: "fixed",
      left: pos.x + 15,
      top: pos.y + 15,
      background: "#020617",
      border: "1px solid #1f2a44",
      padding: "10px 12px",
      borderRadius: 10,
      fontSize: 13,
      maxWidth: 260,
      color: "#e5e7eb",
      pointerEvents: "none",
      zIndex: 9999,
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
    }}>
      {text}
    </div>
  );
}