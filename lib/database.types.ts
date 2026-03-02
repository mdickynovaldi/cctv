// Database types - manually defined to match Supabase schema
// In production, generate with: supabase gen types typescript --local > lib/database.types.ts

export type UserRole = 'admin' | 'receptionist' | 'host'
export type VisitStatus = 'registered' | 'arrived' | 'departed' | 'canceled' | 'no_show'
export type ScanAction = 'scan_arrive' | 'scan_depart' | 'manual_arrive' | 'manual_depart'
export type ScanResult = 'success' | 'error' | 'warning'
export type OccupancyEventType = 'enter' | 'exit' | 'count'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  department: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Visit {
  id: string
  visitor_name: string
  visitor_email: string | null
  visitor_phone: string
  purpose: string
  host_id: string | null
  qr_token: string
  status: VisitStatus
  planned_date: string
  planned_time: string | null
  valid_from: string | null
  valid_until: string | null
  arrived_at: string | null
  departed_at: string | null
  notes: string | null
  registered_by: string | null
  created_at: string
  updated_at: string
}

export interface VisitWithHost extends Visit {
  host: Pick<Profile, 'id' | 'full_name' | 'department' | 'email'> | null
}

export interface ScanLog {
  id: string
  visit_id: string
  action: ScanAction
  result: ScanResult
  error_message: string | null
  scanned_by: string | null
  scan_duration_ms: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AppSetting {
  id: string
  key: string
  value: Record<string, unknown> | string
  updated_at: string
  updated_by: string | null
}

export interface OccupancyEvent {
  id: string
  event_type: OccupancyEventType
  count: number
  source: string
  camera_id: string | null
  confidence: number | null
  metadata: Record<string, unknown>
  created_at: string
}

// Supabase Database type helper
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      visits: {
        Row: Visit
        Insert: Omit<Visit, 'id' | 'qr_token' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Visit, 'id' | 'qr_token' | 'created_at'>>
      }
      scan_logs: {
        Row: ScanLog
        Insert: Omit<ScanLog, 'id' | 'created_at'>
        Update: never
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
      app_settings: {
        Row: AppSetting
        Insert: Omit<AppSetting, 'id' | 'updated_at'>
        Update: Partial<Pick<AppSetting, 'value' | 'updated_by'>>
      }
      occupancy_events: {
        Row: OccupancyEvent
        Insert: Omit<OccupancyEvent, 'id' | 'created_at'>
        Update: never
      }
    }
  }
}
