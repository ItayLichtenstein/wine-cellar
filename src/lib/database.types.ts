
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_actions": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"id": number,"reason": string | null,"target_name": string | null,"target_user": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_name"?: string | null,"target_user"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"id"?: never,"reason"?: string | null,"target_name"?: string | null,"target_user"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_edit_grants": {
                  Row: {
                    "client_id": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_admins": {
                  Row: {
                    "added_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bottle_prices": {
                  Row: {
                    "bottle_id": string,"cellar_id": string,"is_gift": boolean,"paid": number | null,"regular": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bottle_id": string,"cellar_id": string,"is_gift"?: boolean,"paid"?: number | null,"regular"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "bottle_id"?: string,"cellar_id"?: string,"is_gift"?: boolean,"paid"?: number | null,"regular"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bottle_prices_bottle_id_cellar_id_fkey"
      columns: ["bottle_id","cellar_id"]
isOneToOne: false
      referencedRelation: "bottles"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"bottles": {
                  Row: {
                    "added_on": string,"cellar_id": string,"consumed_on": string | null,"created_at": string,"id": string,"import_id": string | null,"link_url": string | null,"note": string | null,"slot": number | null,"status": Database["public"]['Enums']["bottle_status"],"updated_at": string,"vintage_id": string,"zone_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_on"?: string,"cellar_id": string,"consumed_on"?: string | null,"created_at"?: string,"id"?: string,"import_id"?: string | null,"link_url"?: string | null,"note"?: string | null,"slot"?: number | null,"status"?: Database["public"]['Enums']["bottle_status"],"updated_at"?: string,"vintage_id": string,"zone_id"?: string | null
                  }
                  Update: {
                    "added_on"?: string,"cellar_id"?: string,"consumed_on"?: string | null,"created_at"?: string,"id"?: string,"import_id"?: string | null,"link_url"?: string | null,"note"?: string | null,"slot"?: number | null,"status"?: Database["public"]['Enums']["bottle_status"],"updated_at"?: string,"vintage_id"?: string,"zone_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bottles_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bottles_vintage_id_cellar_id_fkey"
      columns: ["vintage_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wine_vintages"
      referencedColumns: ["id","cellar_id"]
    },{
      foreignKeyName: "bottles_zone_id_cellar_id_fkey"
      columns: ["zone_id","cellar_id"]
isOneToOne: false
      referencedRelation: "shelf_zones"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"cellar_invites": {
                  Row: {
                    "cellar_id": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"role": Database["public"]['Enums']["member_role"],"token_hash": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"token_hash": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "cellar_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"token_hash"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cellar_invites_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cellar_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cellar_invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cellar_members": {
                  Row: {
                    "cellar_id": string,"joined_at": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "cellar_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cellar_members_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cellar_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cellars": {
                  Row: {
                    "created_at": string,"custom_name": string | null,"id": string,"name": string,"name_is_custom": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"custom_name"?: string | null,"id"?: string,"name": string,"name_is_custom"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"custom_name"?: string | null,"id"?: string,"name"?: string,"name_is_custom"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"critic_scores": {
                  Row: {
                    "cellar_id": string,"created_at": string,"critic": string,"id": string,"score": number,"vintage_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"created_at"?: string,"critic": string,"id"?: string,"score": number,"vintage_id": string
                  }
                  Update: {
                    "cellar_id"?: string,"created_at"?: string,"critic"?: string,"id"?: string,"score"?: number,"vintage_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "critic_scores_vintage_id_cellar_id_fkey"
      columns: ["vintage_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wine_vintages"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"drafts": {
                  Row: {
                    "applied_by_ai": boolean,"cellar_id": string,"created_at": string,"created_by": string | null,"decided_at": string | null,"id": string,"kind": Database["public"]['Enums']["draft_kind"],"payload": NonNullable<Json>,"source": Database["public"]['Enums']["draft_source"],"status": Database["public"]['Enums']["draft_status"],"undo": Json | null,"undone_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_by_ai"?: boolean,"cellar_id": string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["draft_kind"],"payload": NonNullable<Json>,"source": Database["public"]['Enums']["draft_source"],"status"?: Database["public"]['Enums']["draft_status"],"undo"?: Json | null,"undone_at"?: string | null
                  }
                  Update: {
                    "applied_by_ai"?: boolean,"cellar_id"?: string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["draft_kind"],"payload"?: NonNullable<Json>,"source"?: Database["public"]['Enums']["draft_source"],"status"?: Database["public"]['Enums']["draft_status"],"undo"?: Json | null,"undone_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "drafts_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drafts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fridge_models": {
                  Row: {
                    "brand": string,"created_at": string,"id": string,"layout": NonNullable<Json>,"model": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand": string,"created_at"?: string,"id"?: string,"layout": NonNullable<Json>,"model": string
                  }
                  Update: {
                    "brand"?: string,"created_at"?: string,"id"?: string,"layout"?: NonNullable<Json>,"model"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fridges": {
                  Row: {
                    "brand": string | null,"cellar_id": string,"created_at": string,"id": string,"kind": string,"model": string | null,"model_id": string | null,"name": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"cellar_id": string,"created_at"?: string,"id"?: string,"kind"?: string,"model"?: string | null,"model_id"?: string | null,"name": string,"position"?: number,"updated_at"?: string
                  }
                  Update: {
                    "brand"?: string | null,"cellar_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"model"?: string | null,"model_id"?: string | null,"name"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fridges_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fridges_model_id_fkey"
      columns: ["model_id"]
isOneToOne: false
      referencedRelation: "fridge_models"
      referencedColumns: ["id"]
    }
                  ]
                },"friend_invites": {
                  Row: {
                    "cellar_id": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"max_uses": number,"shows_prices": boolean,"token_hash": string,"use_count": number,"used_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"shows_prices"?: boolean,"token_hash": string,"use_count"?: number,"used_at"?: string | null
                  }
                  Update: {
                    "cellar_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"max_uses"?: number,"shows_prices"?: boolean,"token_hash"?: string,"use_count"?: number,"used_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "friend_invites_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friend_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"friend_links": {
                  Row: {
                    "created_at": string,"friend_cellar_id": string,"owner_cellar_id": string,"shows_prices": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"friend_cellar_id": string,"owner_cellar_id": string,"shows_prices"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"friend_cellar_id"?: string,"owner_cellar_id"?: string,"shows_prices"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "friend_links_friend_cellar_id_fkey"
      columns: ["friend_cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friend_links_owner_cellar_id_fkey"
      columns: ["owner_cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    }
                  ]
                },"imports": {
                  Row: {
                    "bottles": number,"cellar_id": string,"created_at": string,"created_by": string | null,"file_hash": string | null,"id": string,"source": string,"undone_at": string | null,"wines": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bottles"?: number,"cellar_id": string,"created_at"?: string,"created_by"?: string | null,"file_hash"?: string | null,"id"?: string,"source": string,"undone_at"?: string | null,"wines"?: number
                  }
                  Update: {
                    "bottles"?: number,"cellar_id"?: string,"created_at"?: string,"created_by"?: string | null,"file_hash"?: string | null,"id"?: string,"source"?: string,"undone_at"?: string | null,"wines"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "imports_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"first_steps": string | null,"id": string,"locale": string,"onboarded_at": string | null,"theme": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"first_steps"?: string | null,"id": string,"locale"?: string,"onboarded_at"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"first_steps"?: string | null,"id"?: string,"locale"?: string,"onboarded_at"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ratings": {
                  Row: {
                    "cellar_id": string,"created_at": string,"id": string,"rater_id": string | null,"score": number,"updated_at": string,"vintage_id": string | null,"wine_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"created_at"?: string,"id"?: string,"rater_id"?: string | null,"score": number,"updated_at"?: string,"vintage_id"?: string | null,"wine_id": string
                  }
                  Update: {
                    "cellar_id"?: string,"created_at"?: string,"id"?: string,"rater_id"?: string | null,"score"?: number,"updated_at"?: string,"vintage_id"?: string | null,"wine_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ratings_rater_id_fkey"
      columns: ["rater_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_vintage_id_cellar_id_fkey"
      columns: ["vintage_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wine_vintages"
      referencedColumns: ["id","cellar_id"]
    },{
      foreignKeyName: "ratings_wine_id_cellar_id_fkey"
      columns: ["wine_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wines"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"share_links": {
                  Row: {
                    "cellar_id": string,"created_at": string,"created_by": string | null,"hide_prices": boolean,"id": string,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"created_at"?: string,"created_by"?: string | null,"hide_prices"?: boolean,"id"?: string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "cellar_id"?: string,"created_at"?: string,"created_by"?: string | null,"hide_prices"?: boolean,"id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "share_links_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "share_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shelf_zones": {
                  Row: {
                    "capacity": number,"cellar_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["zone_kind"],"label": string | null,"position": number,"shelf_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity": number,"cellar_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["zone_kind"],"label"?: string | null,"position": number,"shelf_id": string
                  }
                  Update: {
                    "capacity"?: number,"cellar_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["zone_kind"],"label"?: string | null,"position"?: number,"shelf_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shelf_zones_shelf_id_cellar_id_fkey"
      columns: ["shelf_id","cellar_id"]
isOneToOne: false
      referencedRelation: "shelves"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"shelves": {
                  Row: {
                    "cellar_id": string,"created_at": string,"fridge_id": string,"id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"created_at"?: string,"fridge_id": string,"id"?: string,"position": number
                  }
                  Update: {
                    "cellar_id"?: string,"created_at"?: string,"fridge_id"?: string,"id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "shelves_fridge_id_cellar_id_fkey"
      columns: ["fridge_id","cellar_id"]
isOneToOne: false
      referencedRelation: "fridges"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"tastings": {
                  Row: {
                    "bottle_id": string | null,"cellar_id": string,"created_at": string,"id": string,"last_location": string | null,"notes": string | null,"place": string | null,"tasted_on": string,"updated_at": string,"vintage_id": string | null,"wine_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bottle_id"?: string | null,"cellar_id": string,"created_at"?: string,"id"?: string,"last_location"?: string | null,"notes"?: string | null,"place"?: string | null,"tasted_on"?: string,"updated_at"?: string,"vintage_id"?: string | null,"wine_id": string
                  }
                  Update: {
                    "bottle_id"?: string | null,"cellar_id"?: string,"created_at"?: string,"id"?: string,"last_location"?: string | null,"notes"?: string | null,"place"?: string | null,"tasted_on"?: string,"updated_at"?: string,"vintage_id"?: string | null,"wine_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tastings_bottle_id_cellar_id_fkey"
      columns: ["bottle_id","cellar_id"]
isOneToOne: false
      referencedRelation: "bottles"
      referencedColumns: ["id","cellar_id"]
    },{
      foreignKeyName: "tastings_vintage_id_cellar_id_fkey"
      columns: ["vintage_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wine_vintages"
      referencedColumns: ["id","cellar_id"]
    },{
      foreignKeyName: "tastings_wine_id_cellar_id_fkey"
      columns: ["wine_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wines"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"wine_vintages": {
                  Row: {
                    "alcohol": number | null,"cellar_id": string,"created_at": string,"drink_from": number | null,"drink_to": number | null,"id": string,"import_id": string | null,"peak_from": number | null,"peak_to": number | null,"updated_at": string,"window_source": Database["public"]['Enums']["window_source"] | null,"wine_id": string,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alcohol"?: number | null,"cellar_id": string,"created_at"?: string,"drink_from"?: number | null,"drink_to"?: number | null,"id"?: string,"import_id"?: string | null,"peak_from"?: number | null,"peak_to"?: number | null,"updated_at"?: string,"window_source"?: Database["public"]['Enums']["window_source"] | null,"wine_id": string,"year"?: number | null
                  }
                  Update: {
                    "alcohol"?: number | null,"cellar_id"?: string,"created_at"?: string,"drink_from"?: number | null,"drink_to"?: number | null,"id"?: string,"import_id"?: string | null,"peak_from"?: number | null,"peak_to"?: number | null,"updated_at"?: string,"window_source"?: Database["public"]['Enums']["window_source"] | null,"wine_id"?: string,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "wine_vintages_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wine_vintages_wine_id_cellar_id_fkey"
      columns: ["wine_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wines"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                },"wines": {
                  Row: {
                    "cellar_id": string,"country": string | null,"created_at": string,"grape": string | null,"id": string,"import_id": string | null,"kosher": Database["public"]['Enums']["kosher_status"],"label_image_path": string | null,"label_thumb": string | null,"name": string,"region": string | null,"shape": Database["public"]['Enums']["bottle_shape"],"type": Database["public"]['Enums']["wine_type"],"updated_at": string,"winery": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"country"?: string | null,"created_at"?: string,"grape"?: string | null,"id"?: string,"import_id"?: string | null,"kosher"?: Database["public"]['Enums']["kosher_status"],"label_image_path"?: string | null,"label_thumb"?: string | null,"name": string,"region"?: string | null,"shape"?: Database["public"]['Enums']["bottle_shape"],"type"?: Database["public"]['Enums']["wine_type"],"updated_at"?: string,"winery": string
                  }
                  Update: {
                    "cellar_id"?: string,"country"?: string | null,"created_at"?: string,"grape"?: string | null,"id"?: string,"import_id"?: string | null,"kosher"?: Database["public"]['Enums']["kosher_status"],"label_image_path"?: string | null,"label_thumb"?: string | null,"name"?: string,"region"?: string | null,"shape"?: Database["public"]['Enums']["bottle_shape"],"type"?: Database["public"]['Enums']["wine_type"],"updated_at"?: string,"winery"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wines_cellar_id_fkey"
      columns: ["cellar_id"]
isOneToOne: false
      referencedRelation: "cellars"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wines_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["id"]
    }
                  ]
                },"wishlist_items": {
                  Row: {
                    "cellar_id": string,"created_at": string,"id": string,"link_url": string | null,"note": string | null,"source_note": string | null,"wine_id": string,"year": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cellar_id": string,"created_at"?: string,"id"?: string,"link_url"?: string | null,"note"?: string | null,"source_note"?: string | null,"wine_id": string,"year"?: number | null
                  }
                  Update: {
                    "cellar_id"?: string,"created_at"?: string,"id"?: string,"link_url"?: string | null,"note"?: string | null,"source_note"?: string | null,"wine_id"?: string,"year"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_wine_id_cellar_id_fkey"
      columns: ["wine_id","cellar_id"]
isOneToOne: false
      referencedRelation: "wines"
      referencedColumns: ["id","cellar_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_friend_invite":
{ Args: { "p_shows_prices"?: boolean,"p_token": string }; Returns: string
                           },
"accept_invite":
{ Args: { "p_bring_data"?: boolean,"p_token": string }; Returns: string
                           },
"account_deletion_plan":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"add_bottles":
{ Args: { "p_drink_from"?: number,"p_drink_to"?: number,"p_is_gift"?: boolean,"p_name": string,"p_paid"?: number,"p_places"?: Json,"p_quantity": number,"p_regular"?: number,"p_rest_status"?: Database["public"]['Enums']["bottle_status"],"p_type"?: Database["public"]['Enums']["wine_type"],"p_winery": string,"p_year"?: number }; Returns: (string)[]
                           },
"add_friend_wine_to_wishlist":
{ Args: { "p_wine_id": string,"p_year"?: number }; Returns: string
                           },
"add_to_wishlist":
{ Args: { "p_link"?: string,"p_name": string,"p_note"?: string,"p_source"?: string,"p_type"?: Database["public"]['Enums']["wine_type"],"p_winery": string,"p_year"?: number }; Returns: string
                           },
"admin_delete_user":
{ Args: { "p_reason"?: string,"p_user": string }; Returns: undefined
                           },
"admin_log":
{ Args: { "p_action": string,"p_reason": string,"p_user": string }; Returns: undefined
                           },
"admin_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_set_admin":
{ Args: { "p_on": boolean,"p_user": string }; Returns: undefined
                           },
"admin_set_ban":
{ Args: { "p_ban": boolean,"p_reason"?: string,"p_user": string }; Returns: undefined
                           },
"admin_sign_out":
{ Args: { "p_reason"?: string,"p_user": string }; Returns: undefined
                           },
"admin_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "banned": boolean,"bottles": number,"cellar_name": string,"created_at": string,"display_name": string,"is_admin": boolean,"is_me": boolean,"last_active": string,"members": number,"user_id": string
            }[]
                           },
"ai_create_fridge":
{ Args: { "p_brand"?: string,"p_kind"?: string,"p_model"?: string,"p_name": string,"p_shelves": Json }; Returns: string
                           },
"ai_delete_bottle":
{ Args: { "p_bottle_id": string }; Returns: Json
                           },
"ai_edit_wine":
{ Args: { "p_bottle_ids": (string)[],"p_changes": Json,"p_vintage_id": string }; Returns: Json
                           },
"can_read_cellar":
{ Args: { "p_cellar_id": string }; Returns: boolean
                           },
"can_read_prices":
{ Args: { "p_cellar_id": string }; Returns: boolean
                           },
"can_read_profile":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"create_fridge":
{ Args: { "p_brand"?: string,"p_model"?: string,"p_name": string,"p_shelves": Json }; Returns: string
                           },
"create_friend_invite":
{ Args: { "p_shows_prices"?: boolean }; Returns: string
                           },
"create_invite":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"create_share_link":
{ Args: { "p_hide_prices"?: boolean }; Returns: string
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"drink_bottle":
{ Args: { "p_bottle_id": string,"p_notes"?: string,"p_tasted_on"?: string }; Returns: string
                           },
"friend_cellar_names":
{ Args: Record<PropertyKey, never>; Returns: {
              "cellar_id": string,"custom_name": string
            }[]
                           },
"friend_invite_status":
{ Args: { "p_token": string }; Returns: {
              "cellar_id": string,"names": (string)[],"status": string
            }[]
                           },
"give_new_cellar":
{ Args: { "p_user_id": string }; Returns: string
                           },
"hash_token":
{ Args: { "p_token": string }; Returns: string
                           },
"import_cellar":
{ Args: { "p_bottles": Json,"p_file_hash": string,"p_source": string }; Returns: Json
                           },
"is_app_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_cellar_editor":
{ Args: { "p_cellar_id": string }; Returns: boolean
                           },
"is_cellar_member":
{ Args: { "p_cellar_id": string }; Returns: boolean
                           },
"is_friend_cellar":
{ Args: { "p_cellar_id": string }; Returns: boolean
                           },
"is_member_of":
{ Args: { "p_cellar_id": string,"p_user_id": string }; Returns: boolean
                           },
"leave_cellar":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"limit_oauth_clients":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"log_tasting":
{ Args: { "p_name": string,"p_notes"?: string,"p_place"?: string,"p_score"?: number,"p_tasted_on"?: string,"p_type"?: Database["public"]['Enums']["wine_type"],"p_winery": string,"p_year"?: number }; Returns: string
                           },
"move_bottle":
{ Args: { "p_bottle_id": string,"p_slot"?: number,"p_zone_id": string }; Returns: undefined
                           },
"move_cellar_data":
{ Args: { "p_from": string,"p_to": string }; Returns: undefined
                           },
"my_cellar_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_friends":
{ Args: Record<PropertyKey, never>; Returns: {
              "cellar_id": string,"i_show_prices": boolean,"names": (string)[],"they_show_prices": boolean
            }[]
                           },
"peek_cellar_names":
{ Args: { "p_cellar": string }; Returns: (string)[]
                           },
"readable_cellar_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"remove_friend":
{ Args: { "p_friend_cellar": string }; Returns: undefined
                           },
"remove_member":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"require_app_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"revoke_share_link":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"set_friend_prices":
{ Args: { "p_friend_cellar": string,"p_shows": boolean }; Returns: undefined
                           },
"set_rating":
{ Args: { "p_rater_id"?: string,"p_score": number,"p_vintage_id"?: string,"p_wine_id": string }; Returns: undefined
                           },
"shared_cellar":
{ Args: { "p_token": string }; Returns: Json
                           },
"shared_cellar_name":
{ Args: { "p_token": string }; Returns: string
                           },
"undo_ai_change":
{ Args: { "p_draft_id": string }; Returns: undefined
                           },
"undo_last_import":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"update_bottle":
{ Args: { "p_bottle_id": string,"p_drink_from": number,"p_drink_to": number,"p_is_gift": boolean,"p_name": string,"p_note": string,"p_paid": number,"p_regular": number,"p_type": Database["public"]['Enums']["wine_type"],"p_winery": string,"p_year": number }; Returns: undefined
                           },
"update_fridge":
{ Args: { "p_brand"?: string,"p_fridge_id": string,"p_model"?: string,"p_name": string,"p_shelves": Json }; Returns: undefined
                           },
"update_wine_details":
{ Args: { "p_alcohol": number,"p_country": string,"p_critics"?: Json,"p_grape": string,"p_kosher": Database["public"]['Enums']["kosher_status"],"p_peak_from": number,"p_peak_to": number,"p_region": string,"p_shape": Database["public"]['Enums']["bottle_shape"],"p_vintage_id": string,"p_window_source": Database["public"]['Enums']["window_source"],"p_wine_id": string }; Returns: undefined
                           },
"user_last_active":
{ Args: { "p_user": string }; Returns: string
                           }
          }
          Enums: {
            "bottle_shape": "standard"|"burgundy","bottle_status": "stored"|"unplaced"|"in_transit"|"consumed","draft_kind": "add_bottles"|"drink"|"move"|"delete"|"edit"|"wishlist"|"taste"|"fridge"|"label","draft_source": "mcp"|"paste","draft_status": "pending"|"approved"|"rejected","kosher_status": "yes"|"no"|"unknown","member_role": "member"|"viewer","window_source": "critic"|"estimate","wine_type": "red"|"white"|"rose"|"orange"|"sparkling"|"dessert"|"fortified"|"other","zone_kind": "row"|"stack"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "bottle_shape": ["standard", "burgundy"],"bottle_status": ["stored", "unplaced", "in_transit", "consumed"],"draft_kind": ["add_bottles", "drink", "move", "delete", "edit", "wishlist", "taste", "fridge", "label"],"draft_source": ["mcp", "paste"],"draft_status": ["pending", "approved", "rejected"],"kosher_status": ["yes", "no", "unknown"],"member_role": ["member", "viewer"],"window_source": ["critic", "estimate"],"wine_type": ["red", "white", "rose", "orange", "sparkling", "dessert", "fortified", "other"],"zone_kind": ["row", "stack"]
          }
        }
} as const
