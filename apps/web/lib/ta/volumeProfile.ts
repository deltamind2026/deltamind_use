
import type { OHLCV } from './series';

export type VPBin = { price:number; volume:number };
export type VPResult = {
  bins: VPBin[];
  poc: number;          // point of control (max vol price)
  valueAreaLow: number; // ~70% VA low
  valueAreaHigh: number;// ~70% VA high
};

export function volumeProfile(bars:OHLCV[], binSize:number): VPResult {
  // Bin by close price (simple baseline). Students can upgrade to intrabar distribution.
  const map = new Map<number, number>();
  for (const b of bars){
    const p = Math.round(b.c/binSize)*binSize;
    map.set(p, (map.get(p)||0) + b.v);
  }
  const bins = [...map.entries()].map(([price,volume])=>({price,volume})).sort((a,b)=>a.price-b.price);
  let poc = bins.length ? bins.reduce((m,x)=> x.volume>m.volume?x:m, bins[0]).price : 0;

  const total = bins.reduce((s,x)=>s+x.volume,0);
  const target = total*0.7;

  // Value area: expand outward from POC by volume until target reached
  const idx = bins.findIndex(b=>b.price===poc);
  let lo = idx, hi = idx, acc = bins[idx]?.volume||0;
  while (acc < target && (lo>0 || hi<bins.length-1)){
    const leftVol = lo>0 ? bins[lo-1].volume : -1;
    const rightVol = hi<bins.length-1 ? bins[hi+1].volume : -1;
    if (rightVol >= leftVol){
      hi = Math.min(bins.length-1, hi+1);
      acc += bins[hi].volume;
    } else {
      lo = Math.max(0, lo-1);
      acc += bins[lo].volume;
    }
  }
  return {
    bins,
    poc,
    valueAreaLow: bins[lo]?.price ?? poc,
    valueAreaHigh: bins[hi]?.price ?? poc
  };
}
