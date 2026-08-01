export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      chunks: {
        Row: {
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          idx: number
          owner_id: string
          page: number
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          idx?: number
          owner_id: string
          page?: number
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          idx?: number
          owner_id?: string
          page?: number
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          mime_type: string | null
          name: string
          owner_id: string
          pages: number
          size_bytes: number
          stage: string | null
          status: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          name: string
          owner_id: string
          pages?: number
          size_bytes?: number
          stage?: string | null
          status?: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string
          owner_id?: string
          pages?: number
          size_bytes?: number
          stage?: string | null
          status?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      entities: {
        Row: {
          canonical_key: string
          created_at: string
          document_id: string | null
          id: string
          mentions: number
          metadata: Json
          name: string
          owner_id: string
          page: number | null
          risk_level: string
          summary: string | null
          type: string
        }
        Insert: {
          canonical_key: string
          created_at?: string
          document_id?: string | null
          id?: string
          mentions?: number
          metadata?: Json
          name: string
          owner_id: string
          page?: number | null
          risk_level?: string
          summary?: string | null
          type: string
        }
        Update: {
          canonical_key?: string
          created_at?: string
          document_id?: string | null
          id?: string
          mentions?: number
          metadata?: Json
          name?: string
          owner_id?: string
          page?: number | null
          risk_level?: string
          summary?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          category: string | null
          created_at: string
          detail: string | null
          document_id: string | null
          entity_id: string | null
          id: string
          owner_id: string
          page: number | null
          severity: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          detail?: string | null
          document_id?: string | null
          entity_id?: string | null
          id?: string
          owner_id: string
          page?: number | null
          severity?: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          detail?: string | null
          document_id?: string | null
          entity_id?: string | null
          id?: string
          owner_id?: string
          page?: number | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer: string | null
          citations: Json
          confidence: number
          created_at: string
          graph_nodes: Json
          id: string
          owner_id: string
          question: string
          reasoning: string | null
          refused: boolean
        }
        Insert: {
          answer?: string | null
          citations?: Json
          confidence?: number
          created_at?: string
          graph_nodes?: Json
          id?: string
          owner_id: string
          question: string
          reasoning?: string | null
          refused?: boolean
        }
        Update: {
          answer?: string | null
          citations?: Json
          confidence?: number
          created_at?: string
          graph_nodes?: Json
          id?: string
          owner_id?: string
          question?: string
          reasoning?: string | null
          refused?: boolean
        }
        Relationships: []
      }
      relationships: {
        Row: {
          confidence: number
          created_at: string
          document_id: string | null
          evidence: string | null
          id: string
          owner_id: string
          page: number | null
          source_id: string
          target_id: string
          type: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          document_id?: string | null
          evidence?: string | null
          id?: string
          owner_id: string
          page?: number | null
          source_id: string
          target_id: string
          type: string
        }
        Update: {
          confidence?: number
          created_at?: string
          document_id?: string | null
          evidence?: string | null
          id?: string
          owner_id?: string
          page?: number | null
          source_id?: string
          target_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          document_id: string
          document_name: string
          id: string
          page: number
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
