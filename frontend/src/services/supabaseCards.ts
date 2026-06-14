import { supabase } from "../lib/supabase";
import type {
  CardHistory,
  CardWithTags,
  Conflict,
  Tag,
} from "../types/knowledge";
import type { Database } from "../types/database";

type CardRow = Database["public"]["Tables"]["cards"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type CardTagRow = Database["public"]["Tables"]["card_tags"]["Row"];
type CardHistoryRow = Database["public"]["Tables"]["card_histories"]["Row"];
type ConflictRow = Database["public"]["Tables"]["conflicts"]["Row"];

type UserId = string;

function toCardRow(card: CardWithTags, userId: UserId): CardRow {
  return {
    id: card.id,
    title: card.title,
    body: card.body,
    site: card.site,
    status: card.status,
    created_at: card.created_at,
    updated_at: card.updated_at,
    device_id: card.device_id,
    deleted_at:
      card.deleted_at ?? (card.status === "trash" ? card.updated_at : null),
    user_id: userId,
  };
}

function toTagRows(cards: CardWithTags[], userId: UserId): TagRow[] {
  const tagMap = new Map<string, Tag>();

  cards.forEach((card) => {
    card.tags.forEach((tag) => {
      const current = tagMap.get(tag.name);
      if (!current || tag.created_at < current.created_at) {
        tagMap.set(tag.name, tag);
      }
    });
  });

  return Array.from(tagMap.values()).map((tag) => ({
    id: tag.id,
    name: tag.name,
    created_at: tag.created_at,
    user_id: userId,
  }));
}

function toCardTagRows(cards: CardWithTags[]): CardTagRow[] {
  return cards.flatMap((card) =>
    card.tags.map((tag) => ({
      card_id: card.id,
      tag_id: tag.id,
    })),
  );
}

function toCardHistoryRow(history: CardHistory, userId: UserId): CardHistoryRow {
  return {
    id: history.id,
    card_id: history.card_id,
    title: history.title,
    body: history.body,
    saved_at: history.saved_at,
    user_id: userId,
  };
}

function toCardHistory(row: CardHistoryRow): CardHistory {
  return {
    id: row.id,
    card_id: row.card_id,
    title: row.title,
    body: row.body,
    saved_at: row.saved_at,
  };
}

function toConflictRow(conflict: Conflict, userId: UserId): ConflictRow {
  return {
    id: conflict.id,
    card_id: conflict.card_id,
    local_title: conflict.local_title,
    local_body: conflict.local_body,
    remote_title: conflict.remote_title,
    remote_body: conflict.remote_body,
    created_at: conflict.created_at,
    resolved: conflict.resolved,
    user_id: userId,
  };
}

function toConflict(row: ConflictRow): Conflict {
  return {
    id: row.id,
    card_id: row.card_id,
    local_title: row.local_title,
    local_body: row.local_body,
    remote_title: row.remote_title,
    remote_body: row.remote_body,
    created_at: row.created_at,
    resolved: row.resolved,
  };
}

export async function fetchCardsFromSupabase(userId: UserId): Promise<CardWithTags[]> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const [cardsResult, tagsResult, cardTagsResult] = await Promise.all([
    supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase.from("tags").select("*").eq("user_id", userId),
    supabase.from("card_tags").select("*"),
  ]);

  if (cardsResult.error) throw cardsResult.error;
  if (tagsResult.error) throw tagsResult.error;
  if (cardTagsResult.error) throw cardTagsResult.error;

  const tagsById = new Map((tagsResult.data ?? []).map((tag) => [tag.id, tag]));
  const tagIdsByCardId = new Map<string, string[]>();

  (cardTagsResult.data ?? []).forEach((row) => {
    const current = tagIdsByCardId.get(row.card_id) ?? [];
    current.push(row.tag_id);
    tagIdsByCardId.set(row.card_id, current);
  });

  return (cardsResult.data ?? []).map((card) => ({
    id: card.id,
    title: card.title,
    body: card.body,
    site: card.site,
    status: card.status,
    created_at: card.created_at,
    updated_at: card.updated_at,
    device_id: card.device_id,
    deleted_at: card.deleted_at,
    tags: (tagIdsByCardId.get(card.id) ?? [])
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is TagRow => Boolean(tag))
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        created_at: tag.created_at,
      })),
  }));
}

export async function fetchCardHistoriesFromSupabase(userId: UserId): Promise<CardHistory[]> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const { data, error } = await supabase
    .from("card_histories")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(toCardHistory);
}

export async function fetchConflictsFromSupabase(userId: UserId): Promise<Conflict[]> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const { data, error } = await supabase
    .from("conflicts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(toConflict);
}

export async function pushCardsToSupabase(
  cards: CardWithTags[],
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const cardRows = cards.map((card) => toCardRow(card, userId));
  const tagRows = toTagRows(cards, userId);
  const cardTagRows = toCardTagRows(cards);

  if (cardRows.length > 0) {
    const { error } = await supabase
      .from("cards")
      .upsert(cardRows, { onConflict: "id" });
    if (error) throw error;
  }

  if (tagRows.length > 0) {
    const { error } = await supabase
      .from("tags")
      .upsert(tagRows, { onConflict: "id" });
    if (error) throw error;
  }

  const cardIds = cards.map((card) => card.id);
  if (cardIds.length > 0) {
    const { error } = await supabase
      .from("card_tags")
      .delete()
      .in("card_id", cardIds);
    if (error) throw error;
  }

  if (cardTagRows.length > 0) {
    const { error } = await supabase
      .from("card_tags")
      .upsert(cardTagRows, { onConflict: "card_id,tag_id" });
    if (error) throw error;
  }
}


export async function permanentlyDeleteCardFromSupabase(
  cardId: string,
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const { error: articleDraftCardError } = await supabase
    .from("article_draft_cards")
    .delete()
    .eq("card_id", cardId);
  if (articleDraftCardError) throw articleDraftCardError;

  const { error: articleDraftError } = await supabase
    .from("article_drafts")
    .update({ source_card_id: null })
    .eq("source_card_id", cardId)
    .eq("user_id", userId);
  if (articleDraftError) throw articleDraftError;

  const { error: cardTagError } = await supabase
    .from("card_tags")
    .delete()
    .eq("card_id", cardId);
  if (cardTagError) throw cardTagError;

  const { error: historyError } = await supabase
    .from("card_histories")
    .delete()
    .eq("card_id", cardId)
    .eq("user_id", userId);
  if (historyError) throw historyError;

  const { error: conflictError } = await supabase
    .from("conflicts")
    .delete()
    .eq("card_id", cardId)
    .eq("user_id", userId);
  if (conflictError) throw conflictError;

  const { error: cardError } = await supabase
    .from("cards")
    .delete()
    .eq("id", cardId)
    .eq("user_id", userId);
  if (cardError) throw cardError;
}

export async function pushCardHistoriesToSupabase(
  histories: CardHistory[],
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  if (histories.length === 0) return;

  const { error } = await supabase
    .from("card_histories")
    .upsert(histories.map((history) => toCardHistoryRow(history, userId)), { onConflict: "id" });

  if (error) throw error;
}

export async function insertCardHistoryToSupabase(
  history: CardHistory,
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const { error } = await supabase
    .from("card_histories")
    .upsert(toCardHistoryRow(history, userId), { onConflict: "id" });

  if (error) throw error;
}

export async function pushConflictsToSupabase(
  conflicts: Conflict[],
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  if (conflicts.length === 0) return;

  const { error } = await supabase
    .from("conflicts")
    .upsert(conflicts.map((conflict) => toConflictRow(conflict, userId)), { onConflict: "id" });

  if (error) throw error;
}

export async function insertConflictToSupabase(
  conflict: Conflict,
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const { error } = await supabase
    .from("conflicts")
    .upsert(toConflictRow(conflict, userId), { onConflict: "id" });

  if (error) throw error;
}

export async function resolveConflictInSupabase(
  conflictId: string,
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const { error } = await supabase
    .from("conflicts")
    .update({ resolved: true })
    .eq("id", conflictId)
    .eq("user_id", userId);

  if (error) throw error;
}

type RealtimeStatus = "connecting" | "connected" | "disconnected" | "error";

type CardsRealtimeOptions = {
  deviceId: string;
  userId: UserId;
  onStatusChange?: (status: RealtimeStatus) => void;
  onRemoteCards: (
    cards: CardWithTags[],
    histories: CardHistory[],
    conflicts: Conflict[],
    eventLabel: string,
  ) => void;
  onError?: (message: string) => void;
};

export function subscribeCardsRealtime(
  options: CardsRealtimeOptions,
): () => void {
  if (!supabase) {
    options.onStatusChange?.("disconnected");
    options.onError?.("Supabase URL または anon key が設定されていません。");
    return () => undefined;
  }

  const client = supabase;
  let disposed = false;
  let reloadTimerId: number | null = null;

  const reloadRemoteCards = (eventLabel: string) => {
    if (reloadTimerId !== null) {
      window.clearTimeout(reloadTimerId);
    }

    reloadTimerId = window.setTimeout(async () => {
      reloadTimerId = null;
      if (disposed) return;

      try {
        const [cards, histories, conflicts] = await Promise.all([
          fetchCardsFromSupabase(options.userId),
          fetchCardHistoriesFromSupabase(options.userId),
          fetchConflictsFromSupabase(options.userId),
        ]);
        if (!disposed) {
          options.onRemoteCards(cards, histories, conflicts, eventLabel);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Realtime更新後の再読込に失敗しました。";
        options.onStatusChange?.("error");
        options.onError?.(message);
      }
    }, 450);
  };

  const handlePostgresChange = (payload: {
    eventType: string;
    new?: { device_id?: string | null } | null;
  }) => {
    if (payload.new?.device_id && payload.new.device_id === options.deviceId) {
      return;
    }

    reloadRemoteCards(payload.eventType);
  };

  options.onStatusChange?.("connecting");

  const channel = client
    .channel("knowledge-hub-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cards", filter: `user_id=eq.${options.userId}` },
      handlePostgresChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tags", filter: `user_id=eq.${options.userId}` },
      () => reloadRemoteCards("TAG_CHANGE"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "card_tags" },
      () => reloadRemoteCards("CARD_TAG_CHANGE"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conflicts", filter: `user_id=eq.${options.userId}` },
      () => reloadRemoteCards("CONFLICT_CHANGE"),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        options.onStatusChange?.("connected");
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        options.onStatusChange?.("error");
        options.onError?.("Supabase Realtimeの接続に失敗しました。");
        return;
      }

      if (status === "CLOSED") {
        options.onStatusChange?.("disconnected");
      }
    });

  return () => {
    disposed = true;
    if (reloadTimerId !== null) {
      window.clearTimeout(reloadTimerId);
    }
    options.onStatusChange?.("disconnected");
    void client.removeChannel(channel);
  };
}
