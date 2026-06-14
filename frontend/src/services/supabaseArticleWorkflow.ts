import { supabase } from "../lib/supabase";
import type { ArticleDraft, ArticleTemplate } from "../types/knowledge";
import type { Database, Json } from "../types/database";

type UserId = string;
type TemplateRow = Database["public"]["Tables"]["article_templates"]["Row"];
type DraftRow = Database["public"]["Tables"]["article_drafts"]["Row"];
type DraftCardRow = Database["public"]["Tables"]["article_draft_cards"]["Row"];

const asJson = <T>(value: T): Json => value as Json;

function toTemplateRow(template: ArticleTemplate, userId: UserId): TemplateRow {
  return {
    id: template.id,
    user_id: userId,
    name: template.name,
    site: template.site,
    description: template.description,
    fields: asJson(template.fields),
    created_at: template.created_at,
    updated_at: template.updated_at,
    device_id: template.device_id,
  };
}

function toTemplate(row: TemplateRow): ArticleTemplate {
  return {
    id: row.id,
    name: row.name,
    site: row.site,
    description: row.description,
    fields: Array.isArray(row.fields) ? row.fields as ArticleTemplate["fields"] : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    device_id: row.device_id,
  };
}

function toDraftRow(draft: ArticleDraft, userId: UserId): DraftRow {
  return {
    id: draft.id,
    user_id: userId,
    template_id: draft.template_id,
    title: draft.title,
    site: draft.site,
    stage: draft.stage,
    summary: draft.summary,
    sections: asJson(draft.sections),
    source_card_id: draft.source_card_id,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    device_id: draft.device_id,
  };
}

function toDraft(row: DraftRow, attachedCardIds: string[]): ArticleDraft {
  return {
    id: row.id,
    template_id: row.template_id,
    title: row.title,
    site: row.site,
    stage: row.stage,
    summary: row.summary,
    sections: Array.isArray(row.sections) ? row.sections as ArticleDraft["sections"] : [],
    source_card_id: row.source_card_id,
    attached_card_ids: attachedCardIds,
    created_at: row.created_at,
    updated_at: row.updated_at,
    device_id: row.device_id,
  };
}

export async function fetchArticleTemplatesFromSupabase(userId: UserId): Promise<ArticleTemplate[]> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const { data, error } = await supabase
    .from("article_templates")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toTemplate);
}

export async function fetchArticleDraftsFromSupabase(userId: UserId): Promise<ArticleDraft[]> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  const [draftResult, linkResult] = await Promise.all([
    supabase
      .from("article_drafts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase.from("article_draft_cards").select("*"),
  ]);

  if (draftResult.error) throw draftResult.error;
  if (linkResult.error) throw linkResult.error;

  const cardIdsByDraftId = new Map<string, string[]>();
  (linkResult.data ?? []).forEach((row) => {
    const current = cardIdsByDraftId.get(row.draft_id) ?? [];
    current.push(row.card_id);
    cardIdsByDraftId.set(row.draft_id, current);
  });

  return (draftResult.data ?? []).map((draft) => toDraft(draft, cardIdsByDraftId.get(draft.id) ?? []));
}

export async function pushArticleTemplatesToSupabase(
  templates: ArticleTemplate[],
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  if (templates.length === 0) return;

  const { error } = await supabase
    .from("article_templates")
    .upsert(templates.map((template) => toTemplateRow(template, userId)), { onConflict: "id" });

  if (error) throw error;
}

export async function pushArticleDraftsToSupabase(
  drafts: ArticleDraft[],
  userId: UserId,
): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase URL または anon key が設定されていません。");
  }

  if (drafts.length === 0) return;

  const draftRows = drafts.map((draft) => toDraftRow(draft, userId));
  const draftCardRows: DraftCardRow[] = drafts.flatMap((draft) =>
    draft.attached_card_ids.map((cardId, index) => ({
      draft_id: draft.id,
      card_id: cardId,
      position: index,
    })),
  );

  const { error: draftError } = await supabase
    .from("article_drafts")
    .upsert(draftRows, { onConflict: "id" });
  if (draftError) throw draftError;

  const draftIds = drafts.map((draft) => draft.id);
  if (draftIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("article_draft_cards")
      .delete()
      .in("draft_id", draftIds);
    if (deleteError) throw deleteError;
  }

  if (draftCardRows.length > 0) {
    const { error: linkError } = await supabase
      .from("article_draft_cards")
      .upsert(draftCardRows, { onConflict: "draft_id,card_id" });
    if (linkError) throw linkError;
  }
}
