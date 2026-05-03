// ============================================================
// Phase 4: Event Configuration Types
// ============================================================

export type DurationMode = "fixed_weeks" | "end_date" | "indefinite";
export type Frequency = "weekly" | "biweekly" | "monthly";
export type GameType = "9_holes" | "18_holes";
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

/** Grouping algorithm method */
export type GroupingMethod = 'harmony' | 'flight_foursomes' | 'balanced_foursomes' | 'flight_teams' | 'balanced_teams';

/** For flight_teams: how to pair teams into foursomes */
export type FlightTeamPairing = 'similar' | 'random';

/** Whether a grouping method is handicap-based (overrides partner/tee time prefs) */
export function isHandicapMethod(method: GroupingMethod): boolean {
  return method !== 'harmony';
}

/** Whether a grouping method uses 2-person teams */
export function isTeamMethod(method: GroupingMethod): boolean {
  return method === 'flight_teams' || method === 'balanced_teams';
}

/** Default handicap index used when a golfer has no GHIN-synced handicap */
export const DEFAULT_HANDICAP_INDEX = 25.0;

/** Admin-facing labels for grouping methods */
export const GROUPING_METHOD_LABELS: Record<GroupingMethod, { label: string; description: string }> = {
  harmony: {
    label: 'Partner Preferences',
    description: 'Groups are optimized based on playing partner preferences and tee time requests. The original grouping method.',
  },
  flight_foursomes: {
    label: 'Flight Foursomes',
    description: 'Golfers are sorted by handicap and grouped by skill level. The best 4 play together, then the next 4, and so on.',
  },
  balanced_foursomes: {
    label: 'Balanced Foursomes',
    description: 'The field is split into skill quartiles (A, B, C, D). Each foursome gets one player from each quartile for balanced competition.',
  },
  flight_teams: {
    label: 'Flight 2-Person Teams',
    description: 'Two-person teams are formed within skill tiers (A+A, B+B, etc.), then paired into foursomes.',
  },
  balanced_teams: {
    label: 'Balanced 2-Person Teams',
    description: 'Two-person teams are formed by balancing combined handicaps (pairs A+D, B+C), then paired into foursomes with equal totals.',
  },
};

/** Admin-facing labels for flight team pairing modes */
export const FLIGHT_TEAM_PAIRING_LABELS: Record<FlightTeamPairing, { label: string; description: string }> = {
  similar: {
    label: 'Similar Skill Foursomes',
    description: 'Teams of similar skill are paired together (e.g., two A-tier teams share a tee time).',
  },
  random: {
    label: 'Mixed Skill Foursomes',
    description: 'Teams are paired randomly into foursomes regardless of skill tier.',
  },
};

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

  // Game time settings (for weather forecast scoping)
  game_type: GameType;
  first_tee_time: string; // HH:MM — when first group tees off

  // Feature flags (super admin only, all default OFF for MVP)
  allow_guest_requests: boolean;
  allow_tee_time_preferences: boolean;
  allow_playing_partner_preferences: boolean;
  allow_auto_grouping: boolean;

  // Grouping algorithm preference controls
  grouping_method: GroupingMethod;
  grouping_partner_pref_mode: GroupingPartnerPrefMode;
  grouping_tee_time_pref_mode: GroupingTeeTimePrefMode;
  grouping_promote_variety: boolean;
  flight_team_pairing: FlightTeamPairing;

  // GHIN Handicap Sync
  handicap_sync_enabled: boolean;

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

/** @deprecated Use ProShopDirectoryContact + EventProShopContactLink instead */
export interface ProShopContact {
  id: string;
  event_id: string;
  email: string;
  created_at: string;
}

/** Global pro shop contact (platform-level, not event-scoped) */
export interface ProShopDirectoryContact {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

/** Junction linking a global pro shop contact to a specific event */
export interface EventProShopContactLink {
  id: string;
  event_id: string;
  contact_id: string;
  created_at: string;
  // Joined from pro_shop_contacts_directory
  contact?: ProShopDirectoryContact;
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

// ============================================================
// Grouping Engine Types
// ============================================================

export type TeeTimePreference = 'early' | 'late' | 'no_preference';

// ============================================================
// Grouping Engine Preference Modes
// ============================================================

/** How much partner preferences influence groupings */
export type GroupingPartnerPrefMode = 'off' | 'light' | 'moderate' | 'full';

/** How much tee time preferences influence group placement */
export type GroupingTeeTimePrefMode = 'off' | 'light' | 'moderate' | 'full';

/** Configuration for partner preference mode behavior */
export interface PartnerPrefModeConfig {
  harmonyMultiplier: number;  // 0 to 1.0 — scales all pair scores
  perGroupCap: number;        // max preferred partners per group (Infinity for unlimited)
}

/** Map of partner preference modes to their config */
export const PARTNER_PREF_MODE_CONFIG: Record<GroupingPartnerPrefMode, PartnerPrefModeConfig> = {
  off:      { harmonyMultiplier: 0,    perGroupCap: 0 },
  light:    { harmonyMultiplier: 0.25, perGroupCap: 1 },
  moderate: { harmonyMultiplier: 0.6,  perGroupCap: 2 },
  full:     { harmonyMultiplier: 1.0,  perGroupCap: Infinity },
};

/** Admin-facing labels for partner preference modes */
export const PARTNER_PREF_MODE_LABELS: Record<GroupingPartnerPrefMode, { label: string; description: string }> = {
  off:      { label: 'Fully Random',        description: 'Partner preferences are ignored. Groups are randomized.' },
  light:    { label: 'Lightly Weighted',     description: 'The grouping engine strives to match each golfer with up to 1 preferred partner per group.' },
  moderate: { label: 'Moderately Weighted',  description: 'The grouping engine strives to match each golfer with up to 2 preferred partners per group.' },
  full:     { label: 'Fully Weighted',       description: 'The grouping engine strives to maximize grouping each golfer with their preferred partners. Golfers without defined preferences are randomly assigned to remaining spots.' },
};

/** Admin-facing labels for tee time preference modes */
export const TEE_TIME_PREF_MODE_LABELS: Record<GroupingTeeTimePrefMode, { label: string; description: string }> = {
  off:      { label: 'Ignore Tee Times',  description: 'Tee time preferences are ignored entirely.' },
  light:    { label: 'Priority-Based',     description: 'Infrequent requesters get priority. Habitual requesters are deprioritized.' },
  moderate: { label: 'Balanced',           description: 'Preferences are honored but infrequent requesters get higher priority.' },
  full:     { label: 'Honor All',          description: 'All tee time preferences are honored equally.' },
};

/** Tee time history for a single golfer over the lookback window */
export interface TeeTimeHistoryEntry {
  earlyCount: number;
  lateCount: number;
  totalWeeks: number;
}

/** Options passed to the grouping engine (all historical data pre-fetched) */
export interface GroupingOptions {
  /** Which algorithm to use */
  groupingMethod: GroupingMethod;
  /** For flight_teams: how to pair teams into foursomes */
  flightTeamPairing: FlightTeamPairing;
  partnerPreferenceMode: GroupingPartnerPrefMode;
  teeTimePreferenceMode: GroupingTeeTimePrefMode;
  promoteVariety: boolean;
  /** Per-golfer tee time request history (profileId → counts). Empty map if no history. */
  teeTimeHistory: Map<string, TeeTimeHistoryEntry>;
  /** Recent pairings for variety promotion (pairKey → array of weeks-ago values). Empty map if disabled. */
  recentPairings: Map<string, number[]>;
  /** Whether to shuffle golfer order for randomization */
  shuffle: boolean;
}

/** Input to the grouping engine — one per confirmed golfer */
export interface GroupingGolfer {
  profileId: string;
  teeTimePreference: TeeTimePreference;
  /** Resolved handicap index: handicap_index ?? DEFAULT_HANDICAP_INDEX */
  handicapIndex: number;
}

/** A ranked partner preference */
export interface PartnerPreference {
  profileId: string;          // the golfer who set the preference
  preferredPartnerId: string; // the partner they want
  rank: number;               // 1 = most preferred, up to 10
}

/** Output from the grouping engine — one per golfer assignment */
export interface GroupingAssignment {
  groupNumber: number;  // 1-based group number
  teeOrder: number;     // 1 = first off, 2 = second off, etc.
  profileId: string;
  teamNumber?: number;  // 1 or 2 within a group (team methods only)
  guestRequestId?: string; // future: for guest assignments
}

/** A complete group with its golfers and score */
export interface GroupResult {
  groupNumber: number;
  teeOrder: number;       // tee position (1 = first off)
  golfers: string[];      // profile IDs
  harmonyScore: number;   // sum of pairwise partner scores (0 for handicap methods)
  /** Team assignments within this group (team methods only) */
  teams?: { teamNumber: number; golfers: string[] }[];
}

/** Full engine output */
export interface GroupingResult {
  groups: GroupResult[];
  assignments: GroupingAssignment[];
  totalHarmonyScore: number;
  /** Which method produced these groupings */
  method: GroupingMethod;
}

/** Stored grouping row (matches DB schema) */
export interface Grouping {
  id: string;
  schedule_id: string;
  group_number: number;
  tee_order: number;
  profile_id: string | null;
  guest_request_id: string | null;
  harmony_score: number | null;
  team_number: number | null;
  created_at: string;
}

// ============================================================
// Handicap History Types
// ============================================================

/** A single handicap history record for trend tracking */
export interface HandicapHistoryEntry {
  id: string;
  profile_id: string;
  handicap_index: number;
  source: 'ghin_sync' | 'manual';
  recorded_at: string;
}

// ============================================================
// Weather Forecast Types
// ============================================================

export interface HourlyForecast {
  hour: number;         // 0-23 in Pacific Time
  time: string;         // "7 AM", "8 AM", etc.
  temperature: number;  // Fahrenheit
  apparentTemperature: number; // "Feels like" in Fahrenheit
  precipitationProbability: number; // 0-100
  weatherCode: number;  // WMO weather code
  weatherDescription: string; // "Sunny", "Partly Cloudy", etc.
  windSpeed: number;    // mph
  windDirection: string; // "N", "NE", "E", etc.
  uvIndex: number;
  isDay: boolean;
}

export interface GameWeatherForecast {
  gameDate: string;           // YYYY-MM-DD
  fetchedAt: string;          // ISO timestamp
  daysUntilGame: number;
  sunrise: string;            // "6:12 AM"
  hourlyForecasts: HourlyForecast[];
  summary: {
    highTemp: number;
    lowTemp: number;
    maxWindSpeed: number;
    maxWindGust: number;
    avgWindSpeed: number;
    dominantWindDirection: string;
    maxPrecipProbability: number;
    maxUvIndex: number;
    condition: string;           // "Sunny", "Partly Cloudy", "Rain"
    golfabilityScore: number;    // 1-5 (5 = perfect)
    golfabilityLabel: string;    // "Great conditions", "Bring rain gear", etc.
  };
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
  // Grouping algorithm preference controls
  grouping_method?: GroupingMethod;
  grouping_partner_pref_mode?: GroupingPartnerPrefMode;
  grouping_tee_time_pref_mode?: GroupingTeeTimePrefMode;
  grouping_promote_variety?: boolean;
  flight_team_pairing?: FlightTeamPairing;
}
