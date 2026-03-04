"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtimeTable<T extends Record<string, unknown>>(
  table: string,
  filter: string,
  event: "INSERT" | "UPDATE" | "DELETE" | "*",
  onPayload: (payload: { new: T; old: T; eventType: string }) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`${table}:${filter}`)
      .on("postgres_changes", {
        event,
        schema: "public",
        table,
        filter,
      }, (payload) => {
        onPayload({
          new: payload.new as T,
          old: payload.old as T,
          eventType: payload.eventType,
        });
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, event]);
}
