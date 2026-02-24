import { supabase } from '@/lib/supabase';
import type { TripStatus } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TripForTracking {
  id: string;
  load_description: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: TripStatus;
  agreed_fare: number | null;
  driver: {
    full_name: string;
    phone_number: string;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_ORDER: TripStatus[] = ['Pending', 'Confirmed', 'In Progress', 'Completed'];

const STATUS_LABELS: Record<TripStatus, string> = {
  Pending: 'Finding Driver',
  Confirmed: 'Driver Assigned',
  'In Progress': 'On The Road',
  Completed: 'Delivered',
};

const STATUS_DESCRIPTIONS: Record<TripStatus, string> = {
  Pending: 'We are matching your load with the best available truck.',
  Confirmed: 'A driver has been assigned and will collect your load at the scheduled time.',
  'In Progress': 'Your load is currently in transit.',
  Completed: 'Your load has been delivered successfully.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPickupTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        Shaana Transporters
      </p>
      <h1 className="text-2xl font-black text-white mb-2">Trip Not Found</h1>
      <p className="text-sm text-slate-400 max-w-xs">
        This tracking link is invalid or the trip has been removed. Please contact your dispatcher for assistance.
      </p>
    </div>
  );
}

function StatusTimeline({ currentStatus }: { currentStatus: TripStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="relative">
      {STATUS_ORDER.map((status, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isUpcoming = index > currentIndex;

        return (
          <div key={status} className="flex items-start gap-4">
            {/* Spine */}
            <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
              {/* Node */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all z-10 ${
                  isCompleted
                    ? 'bg-green-500 border-green-500'
                    : isCurrent
                    ? 'bg-slate-900 border-green-400 shadow-[0_0_0_4px_rgba(74,222,128,0.15)]'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                {isCompleted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                )}
              </div>
              {/* Connector line */}
              {index < STATUS_ORDER.length - 1 && (
                <div
                  className={`w-px flex-1 my-1 ${
                    isCompleted ? 'bg-green-500/60' : 'bg-slate-700/60'
                  }`}
                  style={{ minHeight: 32 }}
                />
              )}
            </div>

            {/* Label */}
            <div className="pb-8">
              <p
                className={`text-sm font-bold leading-tight ${
                  isCurrent
                    ? 'text-green-400'
                    : isCompleted
                    ? 'text-slate-300'
                    : isUpcoming
                    ? 'text-slate-600'
                    : 'text-slate-400'
                }`}
              >
                {STATUS_LABELS[status]}
              </p>
              {isCurrent && (
                <p className="text-xs text-slate-400 mt-0.5 leading-snug max-w-[220px]">
                  {STATUS_DESCRIPTIONS[status]}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TripTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: trip } = await supabase
    .from('trips')
    .select('id, load_description, pickup_location, dropoff_location, pickup_time, status, agreed_fare, driver:drivers(full_name, phone_number)')
    .eq('id', id)
    .single<TripForTracking>();

  if (!trip) return <NotFound />;

  const hasDriver = trip.driver !== null && trip.status !== 'Pending';

  const statusBadgeColor: Record<TripStatus, string> = {
    Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'In Progress': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    Completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700/60 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-1">
            Shaana Transporters
          </p>
          <h1 className="text-base font-black text-white leading-none">Cargo Tracking</h1>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live Tracking
        </span>
      </header>

      {/* Body */}
      <main className="flex-1 px-5 py-6 space-y-5 max-w-lg mx-auto w-full">

        {/* Current status badge */}
        <div className={`inline-flex items-center gap-2 text-sm font-bold px-3.5 py-1.5 rounded-full border ${statusBadgeColor[trip.status]}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {STATUS_LABELS[trip.status]}
        </div>

        {/* Trip Details card */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden">
          {/* Load */}
          <div className="px-5 pt-5 pb-4 border-b border-slate-700/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Load
            </p>
            <p className="text-base font-semibold text-white leading-snug">
              {trip.load_description}
            </p>
          </div>

          {/* Route */}
          <div className="px-5 py-4 border-b border-slate-700/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Route
            </p>
            <div className="flex gap-3">
              <div className="flex flex-col items-center shrink-0 pt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="w-px flex-1 bg-slate-600 my-1" style={{ minHeight: 20 }} />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              </div>
              <div className="flex flex-col justify-between gap-3 flex-1">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">From</p>
                  <p className="text-sm font-semibold text-white leading-tight">{trip.pickup_location}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">To</p>
                  <p className="text-sm font-semibold text-white leading-tight">{trip.dropoff_location}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pickup time */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              Scheduled Pickup
            </p>
            <p className="text-sm font-semibold text-white">{formatPickupTime(trip.pickup_time)}</p>
          </div>
        </div>

        {/* Status timeline */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl px-5 pt-5 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-5">
            Trip Progress
          </p>
          <StatusTimeline currentStatus={trip.status} />
        </div>

        {/* Driver section */}
        <div className="bg-slate-800 border border-slate-700/60 rounded-2xl px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
            Your Driver
          </p>

          {hasDriver && trip.driver ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-bold text-white leading-tight">{trip.driver.full_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{trip.driver.phone_number}</p>
                </div>
              </div>
              <a
                href={`tel:${trip.driver.phone_number}`}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-400 active:scale-95 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-green-500/20 transition-all shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
                </svg>
                Call Driver
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-300 leading-snug">
                Finding the perfect truck for your load&hellip;
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="px-5 py-5 text-center border-t border-slate-800">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest">
          Shaana Transporters &mdash; Powered by Dispatch Pro
        </p>
      </footer>
    </div>
  );
}
