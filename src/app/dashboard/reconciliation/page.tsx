'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnsettledTrip {
  id: string;
  driver_id: string;
  load_description: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  agreed_fare: number | null;
  platform_commission: number | null;
  driver: {
    id: string;
    full_name: string;
    phone_number: string;
  } | null;
}

interface DriverStatement {
  driver: {
    id: string;
    full_name: string;
    phone_number: string;
  };
  trips: UnsettledTrip[];
  totalFare: number;
  totalCommission: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKSh(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPickupTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupByDriver(trips: UnsettledTrip[]): DriverStatement[] {
  const map = new Map<string, DriverStatement>();

  for (const trip of trips) {
    if (!trip.driver_id || !trip.driver) continue;
    const driverId = trip.driver_id;

    if (!map.has(driverId)) {
      map.set(driverId, {
        driver: trip.driver,
        trips: [],
        totalFare: 0,
        totalCommission: 0,
      });
    }

    const statement = map.get(driverId)!;
    statement.trips.push(trip);
    statement.totalFare += trip.agreed_fare ?? 0;
    statement.totalCommission += trip.platform_commission ?? (trip.agreed_fare ?? 0) * 0.12;
  }

  return Array.from(map.values()).sort((a, b) =>
    b.totalCommission - a.totalCommission
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-5 shadow-lg animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-36" />
          <div className="h-3 bg-slate-700/60 rounded w-24" />
        </div>
        <div className="h-6 bg-slate-700 rounded w-16" />
      </div>
      <div className="h-px bg-slate-700/50 mb-4" />
      <div className="space-y-1 mb-4">
        <div className="h-2.5 bg-slate-700/60 rounded w-20" />
        <div className="h-9 bg-slate-700 rounded w-40" />
      </div>
      <div className="h-10 bg-slate-700 rounded-xl w-full" />
    </div>
  );
}

// ─── Trip Row ─────────────────────────────────────────────────────────────────

function TripRow({ trip }: { trip: UnsettledTrip }) {
  const commission = trip.platform_commission ?? (trip.agreed_fare ?? 0) * 0.12;
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        <span className="w-px flex-1 bg-slate-700/60 my-0.5" style={{ minHeight: 8 }} />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 truncate">{trip.pickup_location}</p>
        <p className="text-xs text-slate-300 truncate">{trip.dropoff_location}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{formatPickupTime(trip.pickup_time)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-400">Fare</p>
        <p className="text-sm font-semibold text-white">
          {trip.agreed_fare !== null ? formatKSh(trip.agreed_fare) : 'TBD'}
        </p>
        <p className="text-[10px] text-green-400 font-medium">{formatKSh(commission)} comm.</p>
      </div>
    </div>
  );
}

// ─── Driver Statement Card ────────────────────────────────────────────────────

function DriverCard({
  statement,
  onSettle,
}: {
  statement: DriverStatement;
  onSettle: (driverId: string, tripIds: string[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [settling, setSettling] = useState(false);

  async function handleSettle() {
    setSettling(true);
    try {
      await onSettle(
        statement.driver.id,
        statement.trips.map((t) => t.id)
      );
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-lg overflow-hidden border-l-4 border-l-green-500">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">
              {statement.driver.full_name}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">{statement.driver.phone_number}</p>
          </div>
          <span className="text-xs font-bold bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
            {statement.trips.length} trip{statement.trips.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4 text-sm text-slate-400">
          <span>
            Total Fare:{' '}
            <span className="text-white font-medium">{formatKSh(statement.totalFare)}</span>
          </span>
        </div>

        {/* Commission owed — hero number */}
        <div className="bg-slate-900/60 rounded-xl px-4 py-3 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">
            Commission Owed
          </p>
          <p className="text-3xl font-black text-green-400 leading-none">
            {formatKSh(statement.totalCommission)}
          </p>
        </div>

        {/* Accordion toggle */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
        >
          <span>{expanded ? 'Hide Trips' : 'View Trips'}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Settle button */}
        <button
          onClick={handleSettle}
          disabled={settling}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
            settling
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20'
          }`}
        >
          {settling ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Settling…
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Settle Balance
            </>
          )}
        </button>
      </div>

      {/* Accordion body */}
      {expanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/40 divide-y divide-slate-700/40">
          {statement.trips.map((trip) => (
            <TripRow key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const pathname = usePathname();
  const [statements, setStatements] = useState<DriverStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setFetchError(null);

      const { data, error } = await supabase
        .from('trips')
        .select('*, driver:drivers(id, full_name, phone_number)')
        .eq('status', 'Completed')
        .eq('commission_settled', false)
        .order('created_at', { ascending: true });

      if (error) {
        setFetchError(error.message);
        setLoading(false);
        return;
      }

      setStatements(groupByDriver((data as UnsettledTrip[]) ?? []));
      setLoading(false);
    }

    fetchData();
  }, []);

  async function handleSettle(driverId: string, tripIds: string[]) {
    const { error } = await supabase
      .from('trips')
      .update({ commission_settled: true })
      .in('id', tripIds);

    if (error) {
      showToast('Error settling balance. Please try again.');
      throw error;
    }

    setStatements((prev) => prev.filter((s) => s.driver.id !== driverId));
    showToast('Balance settled successfully');
  }

  const today = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalCommission = statements.reduce((sum, s) => sum + s.totalCommission, 0);
  const totalTrips = statements.reduce((sum, s) => sum + s.trips.length, 0);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700/60 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Shaana Transporters</h1>
          <p className="text-sm text-slate-400">Dispatcher Dashboard</p>
        </div>
        <nav className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
          <Link
            href="/dashboard"
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              pathname === '/dashboard'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dispatch Board
          </Link>
          <Link
            href="/dashboard/reconciliation"
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              pathname === '/dashboard/reconciliation'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Reconciliation
          </Link>
        </nav>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-300">{today}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? 'Loading…' : `${statements.length} driver${statements.length !== 1 ? 's' : ''} with outstanding balances`}
          </p>
        </div>
      </header>

      <main className="p-6">
        {/* Fetch error */}
        {fetchError && (
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-red-950/60 border border-red-800/60 px-5 py-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-300">Failed to load reconciliation data</p>
              <p className="text-xs text-red-400/80 mt-0.5">{fetchError}</p>
            </div>
          </div>
        )}

        {/* Summary chips */}
        {!loading && statements.length > 0 && (
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                Drivers Outstanding
              </p>
              <p className="text-2xl font-black text-white">{statements.length}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                Unsettled Trips
              </p>
              <p className="text-2xl font-black text-white">{totalTrips}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-0.5">
                Total Commission Due
              </p>
              <p className="text-2xl font-black text-green-400">{formatKSh(totalCommission)}</p>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Driver cards */}
        {!loading && statements.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {statements.map((statement) => (
              <DriverCard
                key={statement.driver.id}
                statement={statement}
                onSettle={handleSettle}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && statements.length === 0 && !fetchError && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">All Commissions Settled</h2>
            <p className="text-slate-400 text-sm max-w-xs">
              No outstanding balances. Every driver&apos;s commission has been collected.
            </p>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 bg-slate-900 border border-white/10 text-white px-5 py-3.5 rounded-xl shadow-2xl">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <p className="text-sm font-medium">{toast}</p>
          <button onClick={() => setToast(null)} className="ml-1 text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
