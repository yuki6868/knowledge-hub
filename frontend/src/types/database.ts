import type { ArticleStage, CardStatus, SiteType } from './knowledge'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      cards: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          site: SiteType
          status: CardStatus
          created_at: string
          updated_at: string
          device_id: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          body?: string
          site?: SiteType
          status?: CardStatus
          created_at?: string
          updated_at?: string
          device_id?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          site?: SiteType
          status?: CardStatus
          created_at?: string
          updated_at?: string
          device_id?: string | null
          deleted_at?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      card_tags: {
        Row: {
          card_id: string
          tag_id: string
        }
        Insert: {
          card_id: string
          tag_id: string
        }
        Update: {
          card_id?: string
          tag_id?: string
        }
        Relationships: []
      }
      card_histories: {
        Row: {
          id: string
          user_id: string
          card_id: string
          title: string
          body: string
          saved_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          title: string
          body: string
          saved_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          title?: string
          body?: string
          saved_at?: string
        }
        Relationships: []
      }
      conflicts: {
        Row: {
          id: string
          user_id: string
          card_id: string
          local_title: string | null
          local_body: string | null
          remote_title: string | null
          remote_body: string | null
          created_at: string
          resolved: boolean
        }
        Insert: {
          id?: string
          user_id: string
          card_id: string
          local_title?: string | null
          local_body?: string | null
          remote_title?: string | null
          remote_body?: string | null
          created_at?: string
          resolved?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          local_title?: string | null
          local_body?: string | null
          remote_title?: string | null
          remote_body?: string | null
          created_at?: string
          resolved?: boolean
        }
        Relationships: []
      }
      article_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          site: SiteType
          description: string
          fields: Json
          created_at: string
          updated_at: string
          device_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          site?: SiteType
          description?: string
          fields?: Json
          created_at?: string
          updated_at?: string
          device_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          site?: SiteType
          description?: string
          fields?: Json
          created_at?: string
          updated_at?: string
          device_id?: string | null
        }
        Relationships: []
      }
      article_drafts: {
        Row: {
          id: string
          user_id: string
          template_id: string | null
          title: string
          site: SiteType
          stage: ArticleStage
          summary: string
          sections: Json
          source_card_id: string | null
          created_at: string
          updated_at: string
          device_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          template_id?: string | null
          title?: string
          site?: SiteType
          stage?: ArticleStage
          summary?: string
          sections?: Json
          source_card_id?: string | null
          created_at?: string
          updated_at?: string
          device_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string | null
          title?: string
          site?: SiteType
          stage?: ArticleStage
          summary?: string
          sections?: Json
          source_card_id?: string | null
          created_at?: string
          updated_at?: string
          device_id?: string | null
        }
        Relationships: []
      }
      article_draft_cards: {
        Row: {
          draft_id: string
          card_id: string
          position: number
        }
        Insert: {
          draft_id: string
          card_id: string
          position?: number
        }
        Update: {
          draft_id?: string
          card_id?: string
          position?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
