// ============================================================
// Phase 4: Event Configuration Types
// ============================================================

export type DurationMode = "fixed_weeks" | "end_date" | "indefinite";
export type Frequency = "weekly" | "biweekly" | "monthly";
export type AlertType =
  | "new_registration"
  | "capacity_reached"
  | "spot_opened"
  | "low_response";
export type EmailType =
  | "invite"
  | "reminder"
  | "golfer_confirmation"
  | "pro_shop_detail";
export type AdminRole = "primary" | "secondary";

export interface Event {
  id: string;
  name: string;
  description: string | null;
  frequency: Frequency;
  day_of_week: number; // 0=Sun, 6=Sat
  default_capacity: number;
  min_players: number | null;
  timezone: string;

  // Duration
  duration_mode: DurationMode;
  start_date: string | null; // YYYY-MM-DD
  duration_weeks: number | null;
  end_date: string | null; // YYYY-MM-DD

  // Email schedule (legacy columns — primary reminder)
  invite_day: number;
  invite_time: string; // HH:MM
  num_reminders: number; // 0–3
  reminder_day: number;
  reminder_time: string;
  reminder2_day: number | null;
  reminder2_time: string | null;
  reminder3_day: number | null;
  reminder3_time: string | null;
  cutoff_day: number;
  cutoff_time: string;
  confirmation_day: number;
  confirmation_time: string;

  // Feature flags (super admin only, all default OFF for MVP)
  allow_guest_requests: boolean;
  allow_tee_time_preferences: boolean;
  allow_playing_partner_preferences: boolean;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventSchedule {
  id: string;
  event_id: string;
  game_date: string; // YYYY-MM-DD
  capacity: number | null;
  min_players_override: number | null;
  status: "scheduled" | "cancelled";
  admin_notes: string | null;
  invite_sent: boolean;
  reminder_sent: boolean;
  reminder_2_sent: boolean;
  reminder_3_sent: boolean;
  golfer_confirmation_sent: boolean;
  pro_shop_sent: boolean;
  confirmation_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailScheduleConfig {
  id: string;
  event_id: string;
  email_type: EmailType;
  is_enabled: boolean;
  send_day_offset: number; // Negative = before game day
  send_time: string; // HH:MM
  priority_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventAlertSetting {
  id: string;
  event_id: string;
  alert_type: AlertType;
  is_enabled: boolean;
  config: LowResponseConfig | null;
  created_at: string;
  updated_at: string;
}

export interface LowResponseConfig {
  day: number; // Day of week (0–6)
  time: string; // HH:MM
}

export interface EventAdminAssignment {
  id: string;
  event_id: string;
  profile_id: string;
  role: AdminRole;
  created_at: string;
  // Joined profile fields (optional, from select queries)
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ProShopContact {
  id: string;
  event_id: string;
  email: string;
  created_at: string;
}

// ============================================================
// Form/action helper types
// ============================================================

export interface CreateEventInput {
  name: string;
  description: string;
  frequency: Frequency;
  day_of_week: number;
  default_capacity: number;
  min_players: number | null;
  timezone: string;
  duration_mode: DurationMode;
  start_date: string | null;
  duration_weeks: number | null;
  end_date: string | null;
  // Email schedule
  invite_day: number;
  invite_time: string;
  num_reminders: number;
  reminder_day: number;
  reminder_time: string;
  reminder2_day: number | null;
  reminder2_time: string | null;
  reminder3_day: number | null;
  reminder3_time: string | null;
  cutoff_day: number;
  cutoff_time: string;
  confirmation_day: number;
  confirmation_time: string;
}

export interface UpdateEventSettingsInput {
  name?: string;
  description?: string;
  frequency?: Frequency;
  day_of_week?: number;
  default_capacity?: number;
  min_players?: number | null;
  duration_mode?: DurationMode;
  start_date?: string | null;
  duration_weeks?: number | null;
  end_date?: string | null;
  num_reminders?: number;
  reminder_day?: number;
  reminder_time?: string;
  reminder2_day?: number | null;
  reminder2_time?: string | null;
  reminder3_day?: number | null;
  reminder3_time?: string | null;
  cutoff_day?: number;
  cutoff_time?: string;
  confirmation_day?: number;
  confirmation_time?: string;
}
