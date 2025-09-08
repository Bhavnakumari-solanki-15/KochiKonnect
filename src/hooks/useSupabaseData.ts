import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSupabaseDataOptions {
  table: string;
  select?: string;
  realtime?: boolean;
  filter?: {
    column: string;
    operator: string;
    value: any;
  };
}

interface UseSupabaseDataResult<T> {
  data: T[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSupabaseData<T = any>({
  table,
  select = '*',
  realtime = false,
  filter
}: UseSupabaseDataOptions): UseSupabaseDataResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from(table).select(select);

      if (filter) {
        query = query[filter.operator](filter.column, filter.value);
      }

      const { data: result, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (realtime) {
      const subscription = supabase
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [table, select, realtime, filter]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
