
export type OHLCV = { t:number; o:number; h:number; l:number; c:number; v:number };

export function sma(values:number[], period:number) {
  const out: (number|null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i=0;i<values.length;i++){
    sum += values[i];
    if (i>=period) sum -= values[i-period];
    if (i>=period-1) out[i]= sum/period;
  }
  return out;
}

export function ema(values:number[], period:number) {
  const out: (number|null)[] = new Array(values.length).fill(null);
  const k = 2/(period+1);
  let prev: number|undefined = undefined;
  for (let i=0;i<values.length;i++){
    const v = values[i];
    if (prev === undefined) prev = v;
    else prev = v*k + prev*(1-k);
    if (i>=period-1) out[i]=prev;
  }
  return out;
}

export function rsi(values:number[], period:number) {
  const out:(number|null)[] = new Array(values.length).fill(null);
  let gain=0, loss=0;
  for (let i=1;i<values.length;i++){
    const ch = values[i]-values[i-1];
    const g = Math.max(0, ch);
    const l = Math.max(0, -ch);
    if (i<=period){ gain += g; loss += l; }
    if (i===period){
      let rs = (gain/period) / Math.max(1e-9,(loss/period));
      out[i]= 100 - (100/(1+rs));
    }
    if (i>period){
      gain = (gain*(period-1)+g)/period;
      loss = (loss*(period-1)+l)/period;
      const rs = (gain) / Math.max(1e-9,loss);
      out[i]= 100 - (100/(1+rs));
    }
  }
  return out;
}

export function macd(values:number[], fast:number, slow:number, signal:number){
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line:(number|null)[] = values.map((_,i)=> (ef[i]!==null && es[i]!==null) ? (ef[i] as number)-(es[i] as number) : null);
  const lineVals = line.map(v=> v===null?0:v);
  const sig = ema(lineVals, signal).map((v,i)=> line[i]===null?null:v);
  const hist = line.map((v,i)=> (v===null || sig[i]===null) ? null : v-(sig[i] as number));
  return { line, signal: sig, hist };
}

export function bollinger(values:number[], period:number, stdev:number){
  const m = sma(values, period);
  const out = { mid:m as (number|null)[], upper:new Array(values.length).fill(null) as (number|null)[], lower:new Array(values.length).fill(null) as (number|null)[] };
  for (let i=0;i<values.length;i++){
    if (i<period-1 || m[i]===null) continue;
    const mean = m[i] as number;
    let sum=0;
    for (let j=i-period+1;j<=i;j++){
      const d = values[j]-mean;
      sum += d*d;
    }
    const sd = Math.sqrt(sum/period);
    out.upper[i]= mean + stdev*sd;
    out.lower[i]= mean - stdev*sd;
  }
  return out;
}

// Session VWAP (simple: cumulative typical price*vol / cumulative vol)
export function vwap(bars:OHLCV[]) {
  const out:(number|null)[] = new Array(bars.length).fill(null);
  let pv=0, vv=0;
  for (let i=0;i<bars.length;i++){
    const tp = (bars[i].h+bars[i].l+bars[i].c)/3;
    pv += tp*bars[i].v;
    vv += bars[i].v;
    out[i] = pv/Math.max(1e-9,vv);
  }
  return out;
}
