
import { getSupabaseClient } from './client';
import type { Holding } from '@/lib/portfolio';

type NewHolding = Pick<Holding, 'symbol' | 'shares' | 'buyPrice'>;

async function authenticatedClient() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error('Please sign in to manage your holdings.');
  }

  return { supabase, userId: data.user.id };
}

// Retrieve the current user's stock holdings.
export async function getSupabaseHoldings(): Promise<Holding[]> {
  const { supabase, userId } = await authenticatedClient();

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select('id, symbol, shares, buy_price, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(row => ({
    id: row.id,
    symbol: row.symbol,
    shares: Number(row.shares),
    buyPrice: Number(row.buy_price),
    addedAt: row.added_at,
  }));
}

// Save a new holding for the authenticated user.
export async function addSupabaseHolding(
  holding: NewHolding
): Promise<Holding> {
  const { supabase, userId } = await authenticatedClient();

  const symbol = holding.symbol.trim().toUpperCase();

  if (
    !symbol ||
    symbol.length > 20 ||
    !Number.isFinite(holding.shares) ||
    holding.shares <= 0 ||
    !Number.isFinite(holding.buyPrice) ||
    holding.buyPrice <= 0
  ) {
    throw new Error('Enter a valid symbol, shares, and buy price.');
  }

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .insert({
      user_id: userId,
      symbol,
      shares: holding.shares,
      buy_price: holding.buyPrice,
    })
    .select('id, symbol, shares, buy_price, added_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    symbol: data.symbol,
    shares: Number(data.shares),
    buyPrice: Number(data.buy_price),
    addedAt: data.added_at,
  };
}

// Delete a holding belonging to the current user.
export async function removeSupabaseHolding(id: string): Promise<void> {
  const { supabase, userId } = await authenticatedClient();

  const { error } = await supabase
    .from('portfolio_holdings')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}
