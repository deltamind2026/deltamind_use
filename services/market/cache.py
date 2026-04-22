from cachetools import TTLCache
from datetime import datetime
import json

cache = TTLCache(maxsize=1000, ttl=900)

def get_cache_key(symbol: str, timeframe: str) -> str:
    return f"ohlc:{symbol}:{timeframe}"

def get_cached_data(symbol: str, timeframe: str):
    key = get_cache_key(symbol, timeframe)
    return cache.get(key)

def set_cached_data(symbol: str, timeframe: str, data: dict):
    key = get_cache_key(symbol, timeframe)
    data['cached_at'] = datetime.now().isoformat()
    cache[key] = data
    return data

def clear_cache():
    cache.clear()