// ─── Enums / Literals ────────────────────────────────────────────────────────

export type TripStatus = 'Pending' | 'Confirmed' | 'In Progress' | 'Completed';

// ─── Row Types (mirror the Supabase schema exactly) ───────────────────────────

export interface Customer {
  id: string;
  full_name: string;
  phone_number: string;
  business_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  full_name: string;
  phone_number: string;
  vehicle_type: string;
  registration_number: string;
  sacco_affiliation: string | null;
  reliability_score: number;
  created_at: string;
  updated_at: string;
}

export interface Corridor {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  customer_id: string;
  driver_id: string | null;
  load_description: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string; // ISO 8601 timestamp string from Supabase
  agreed_fare: number | null;
  platform_commission: number | null;
  status: TripStatus;
  customer_verified_amount: number | null;
  driver_verified_amount: number | null;
  commission_paid: boolean;
  commission_settled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Joined / Enriched Types (used in the UI after relational queries) ────────

export interface TripWithRelations extends Trip {
  customer: Customer;
  driver: Driver | null;
}
