'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { TripStatus, TripWithRelations, Driver } from '@/types/database';
import NewTripModal from './NewTripModal';

// ─── Extended Driver Type (with corridor preferences from driver_corridors) ───

interface AvailableDriver extends Driver {
  corridors: string[];
}

// ─── Column Config ────────────────────────────────────────────────────────────

const STATUSES: TripStatus[] = ['Pending', 'Confirmed', 'In Progress', 'Completed'];

const STATUS_CONFIG: Record<
  TripStatus,
  { topBorder: string; headerBg: string; headerText: string; badge: string }
> = {
  Pending: {
    topBorder: 'border-t-4 border-amber-400',
    headerBg: 'bg-amber-50',
    headerText: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
  Confirmed: {
    topBorder: 'border-t-4 border-blue-500',
    headerBg: 'bg-blue-50',
    headerText: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-700',
  },
  'In Progress': {
    topBorder: 'border-t-4 border-indigo-500',
    headerBg: 'bg-indigo-50',
    headerText: 'text-indigo-800',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  Completed: {
    topBorder: 'border-t-4 border-green-500',
    headerBg: 'bg-green-50',
    headerText: 'text-green-800',
    badge: 'bg-green-100 text-green-700',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPickupTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFare(fare: number | null): string {
  if (fare === null) return 'TBD';
  return `KSh ${fare.toLocaleString('en-KE')}`;
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 space-y-3 animate-pulse">
      <div className="flex justify-between gap-2">
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 bg-gray-200 rounded w-2/3" />
          <div className="h-2.5 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="h-5 bg-gray-100 rounded w-16 shrink-0" />
      </div>
      <div className="space-y-1">
        <div className="h-2 bg-gray-100 rounded w-8" />
        <div className="h-3 bg-gray-200 rounded w-full" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2 bg-gray-100 rounded w-10" />
        <div className="h-3 bg-gray-200 rounded w-4/5" />
        <div className="h-3 bg-gray-200 rounded w-3/5" />
      </div>
      <div className="flex justify-between pt-2 border-t border-gray-100">
        <div className="h-3 bg-gray-100 rounded w-28" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
    </div>
  );
}

function SkeletonColumn({ status }: { status: TripStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className={`flex flex-col rounded-xl bg-gray-50 ${cfg.topBorder} overflow-hidden`}>
      <div className={`${cfg.headerBg} px-4 py-3 flex items-center justify-between`}>
        <div className="h-3.5 bg-gray-200 rounded w-20 animate-pulse" />
        <div className="h-5 w-6 bg-gray-200 rounded-full animate-pulse" />
      </div>
      <div className="p-3 space-y-3">
        {[1, 2].map((i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}

// ─── Advance button config ────────────────────────────────────────────────────

const ADVANCE_CONFIG: Partial<Record<TripStatus, {
  label: string;
  next: TripStatus;
  cls: string;
  activeCls: string;
}>> = {
  Confirmed: {
    label: 'Mark In Progress',
    next: 'In Progress',
    cls: 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300',
    activeCls: 'border border-indigo-300 bg-indigo-50 text-indigo-600',
  },
  'In Progress': {
    label: 'Mark Completed',
    next: 'Completed',
    cls: 'border border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300',
    activeCls: 'border border-green-300 bg-green-50 text-green-600',
  },
};

// ─── TripCard ─────────────────────────────────────────────────────────────────

function TripCard({
  trip,
  onClick,
  onAdvance,
}: {
  trip: TripWithRelations;
  onClick?: () => void;
  onAdvance?: () => Promise<void>;
}) {
  const isPending = trip.status === 'Pending';
  const advanceCfg = ADVANCE_CONFIG[trip.status];
  const [advancing, setAdvancing] = useState(false);

  async function handleAdvance(e: React.MouseEvent) {
    e.stopPropagation(); // don't bubble up to the card's onClick
    if (!onAdvance || advancing) return;
    setAdvancing(true);
    try {
      await onAdvance();
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border shadow-sm p-4 space-y-3 transition-all
        ${isPending
          ? 'border-amber-200 cursor-pointer hover:shadow-md hover:border-amber-400 hover:-translate-y-0.5'
          : 'border-gray-100 cursor-default hover:shadow-md'
        }`}
    >
      {/* Customer name + fare */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {trip.customer.full_name}
          </p>
          {trip.customer.business_type && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{trip.customer.business_type}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-gray-600 bg-gray-100 rounded px-2 py-0.5">
          {formatFare(trip.agreed_fare)}
        </span>
      </div>

      {/* Load */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Load</p>
        <p className="text-sm text-gray-700 leading-snug">{trip.load_description}</p>
      </div>

      {/* Route */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Route</p>
        <div className="flex items-start gap-1.5">
          <div className="flex flex-col items-center pt-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="w-px flex-1 bg-gray-200 my-0.5" style={{ minHeight: 10 }} />
            <span className="w-2 h-2 rounded-full bg-gray-700" />
          </div>
          <div className="text-sm text-gray-700 space-y-1.5 leading-tight">
            <p>{trip.pickup_location}</p>
            <p className="font-medium">{trip.dropoff_location}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{formatPickupTime(trip.pickup_time)}</span>
        </div>

        {isPending ? (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Assign Driver
          </span>
        ) : trip.driver ? (
          <div className="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 max-w-[130px]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <span className="truncate">{trip.driver.full_name}</span>
          </div>
        ) : null}
      </div>

      {/* Advance status button — Confirmed and In Progress only */}
      {advanceCfg && onAdvance && (
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className={`w-full mt-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5
            ${advancing ? advanceCfg.activeCls : advanceCfg.cls}
            disabled:opacity-60`}
        >
          {advancing ? (
            <>
              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Updating…
            </>
          ) : (
            <>
              {advanceCfg.label}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({
  status, trips, onCardClick, onAdvance,
}: {
  status: TripStatus;
  trips: TripWithRelations[];
  onCardClick?: (trip: TripWithRelations) => void;
  onAdvance?: (trip: TripWithRelations) => Promise<void>;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className={`flex flex-col rounded-xl bg-gray-50 ${cfg.topBorder} overflow-hidden`}>
      <div className={`${cfg.headerBg} px-4 py-3 flex items-center justify-between`}>
        <h2 className={`text-sm font-bold tracking-wide ${cfg.headerText}`}>{status}</h2>
        <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.badge}`}>
          {trips.length}
        </span>
      </div>
      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-180px)]">
        {trips.length === 0 ? (
          <p className="text-xs text-gray-400 text-center pt-10 italic">No trips</p>
        ) : (
          trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onClick={onCardClick ? () => onCardClick(trip) : undefined}
              onAdvance={onAdvance ? () => onAdvance(trip) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── MatchmakingModal ─────────────────────────────────────────────────────────

function MatchmakingModal({
  trip, drivers, onConfirm, onClose,
}: {
  trip: TripWithRelations;
  drivers: AvailableDriver[];
  onConfirm: (driver: AvailableDriver, agreedFare: number) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [fareInput, setFareInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? null;
  const parsedFare = parseFloat(fareInput);
  const commission = !isNaN(parsedFare) && parsedFare > 0 ? parsedFare * 0.12 : null;
  const canConfirm = selectedDriver !== null && !isNaN(parsedFare) && parsedFare > 0;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!submitting && e.target === e.currentTarget) onClose();
  }

  async function handleConfirm() {
    if (!selectedDriver || !canConfirm) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirm(selectedDriver, parsedFare);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Assignment failed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Assign Driver</h2>
            <p className="text-xs text-gray-400 mt-0.5">Matchmaking — Trip #{trip.id.slice(-4)}</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Trip Summary */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Trip Summary
            </p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3.5">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Customer</p>
                <p className="text-sm font-semibold text-gray-900">{trip.customer.full_name}</p>
                {trip.customer.business_type && (
                  <p className="text-xs text-gray-500">{trip.customer.business_type}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Load</p>
                <p className="text-sm text-gray-700">{trip.load_description}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Route</p>
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="w-px bg-gray-300 my-1" style={{ minHeight: 12 }} />
                    <span className="w-2 h-2 rounded-full bg-gray-800" />
                  </div>
                  <div className="text-sm text-gray-700 space-y-2 leading-tight">
                    <p>{trip.pickup_location}</p>
                    <p className="font-medium">{trip.dropoff_location}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Pickup Time</p>
                <p className="text-sm text-gray-700">{formatPickupTime(trip.pickup_time)}</p>
              </div>
            </div>
          </section>

          {/* Driver Selection */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Select Driver
            </p>
            {drivers.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">No drivers found in the database.</p>
            ) : (
              <div className="space-y-2">
                {drivers.map((driver) => {
                  const isSelected = driver.id === selectedDriverId;
                  const scoreColor =
                    driver.reliability_score >= 90
                      ? 'text-green-700 bg-green-100'
                      : driver.reliability_score >= 80
                      ? 'text-amber-700 bg-amber-100'
                      : 'text-red-700 bg-red-100';

                  return (
                    <button
                      key={driver.id}
                      onClick={() => setSelectedDriverId(driver.id)}
                      disabled={submitting}
                      className={`w-full text-left rounded-xl border-2 p-3 transition-all duration-150 disabled:opacity-60 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold leading-tight ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                            {driver.full_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {driver.vehicle_type} · {driver.registration_number}
                          </p>
                          {driver.sacco_affiliation && (
                            <p className="text-xs text-gray-400">{driver.sacco_affiliation}</p>
                          )}
                          {driver.corridors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {driver.corridors.map((corridor) => (
                                <span key={corridor} className="text-[10px] bg-gray-200 text-gray-600 rounded px-1.5 py-0.5 leading-none">
                                  {corridor}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor}`}>
                            ★ {driver.reliability_score}
                          </span>
                          {isSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Agreed Fare */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Agreed Fare
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none">
                KSh
              </span>
              <input
                type="number"
                min="0"
                step="500"
                placeholder="Enter amount"
                value={fareInput}
                disabled={submitting}
                onChange={(e) => setFareInput(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition disabled:opacity-60"
              />
            </div>
            {commission !== null && (
              <div className="mt-2.5 flex items-center justify-between text-xs px-1">
                <span className="text-gray-400">Platform commission (12%)</span>
                <span className="font-semibold text-gray-700">
                  KSh {commission.toLocaleString('en-KE')}
                </span>
              </div>
            )}
          </section>

          {/* Inline error */}
          {submitError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-700">{submitError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
              canConfirm && !submitting
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-[0.98]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Confirming…
              </>
            ) : (
              'Confirm Assignment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [trips, setTrips] = useState<TripWithRelations[]>([]);
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripWithRelations | null>(null);
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  function handleTripCreated(newTrip: TripWithRelations) {
    // Prepend so it appears at the top of the Pending column immediately
    setTrips((prev) => [newTrip, ...prev]);
    setShowNewTripModal(false);
    showToast('Trip logged successfully');
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setFetchError(null);

      const [tripsRes, driversRes] = await Promise.all([
        supabase
          .from('trips')
          .select('*, customer:customers(*), driver:drivers(*)')
          .order('pickup_time', { ascending: true }),
        supabase
          .from('drivers')
          .select('*, driver_corridors(corridor:corridors(name))')
          .order('reliability_score', { ascending: false }),
      ]);

      if (tripsRes.error || driversRes.error) {
        setFetchError((tripsRes.error ?? driversRes.error)!.message);
        setLoading(false);
        return;
      }

      setTrips((tripsRes.data as TripWithRelations[]) ?? []);

      // Flatten corridor names from the junction table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDrivers((driversRes.data ?? []).map((d: any) => ({
        ...d,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        corridors: (d.driver_corridors ?? []).map((dc: any) => dc.corridor?.name).filter(Boolean),
      })));

      setLoading(false);
    }

    fetchData();
  }, []);

  async function handleConfirmAssignment(driver: AvailableDriver, agreedFare: number) {
    if (!selectedTrip) return;

    // Write to Supabase — the DB trigger will auto-calculate platform_commission
    const { error } = await supabase
      .from('trips')
      .update({
        driver_id: driver.id,
        agreed_fare: agreedFare,
        status: 'Confirmed',
      })
      .eq('id', selectedTrip.id);

    if (error) throw new Error(error.message);

    // Optimistic UI update — reflect change immediately without a re-fetch
    setTrips((prev) =>
      prev.map((t) =>
        t.id === selectedTrip.id
          ? {
              ...t,
              status: 'Confirmed' as TripStatus,
              driver_id: driver.id,
              driver,
              agreed_fare: agreedFare,
              platform_commission: agreedFare * 0.12,
              updated_at: new Date().toISOString(),
            }
          : t
      )
    );

    setSelectedTrip(null);
  }

  async function handleAdvanceStatus(trip: TripWithRelations) {
    const cfg = ADVANCE_CONFIG[trip.status];
    if (!cfg) return;

    const { error } = await supabase
      .from('trips')
      .update({ status: cfg.next })
      .eq('id', trip.id);

    if (error) throw new Error(error.message);

    setTrips((prev) =>
      prev.map((t) =>
        t.id === trip.id
          ? { ...t, status: cfg.next, updated_at: new Date().toISOString() }
          : t
      )
    );
  }

  const tripsByStatus = STATUSES.reduce<Record<TripStatus, TripWithRelations[]>>(
    (acc, status) => {
      acc[status] = trips.filter((t) => t.status === status);
      return acc;
    },
    { Pending: [], Confirmed: [], 'In Progress': [], Completed: [] }
  );

  const today = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Shaana Transporters</h1>
          <p className="text-sm text-gray-500">Dispatcher Dashboard</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{today}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? 'Loading…' : `${trips.length} trip${trips.length !== 1 ? 's' : ''} on board`}
            </p>
          </div>
          <button
            onClick={() => setShowNewTripModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all active:scale-95 hover:brightness-110"
            style={{ backgroundColor: '#25D366' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create New Trip
          </button>
        </div>
      </header>

      {/* Board */}
      <main className="p-6">
        {/* Fetch error banner */}
        {fetchError && (
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-5 py-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Failed to load data</p>
              <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-5">
          {loading
            ? STATUSES.map((status) => <SkeletonColumn key={status} status={status} />)
            : STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  trips={tripsByStatus[status]}
                  onCardClick={status === 'Pending' ? setSelectedTrip : undefined}
                  onAdvance={
                    status === 'Confirmed' || status === 'In Progress'
                      ? handleAdvanceStatus
                      : undefined
                  }
                />
              ))}
        </div>
      </main>

      {/* Matchmaking Modal */}
      {selectedTrip && (
        <MatchmakingModal
          trip={selectedTrip}
          drivers={drivers}
          onConfirm={handleConfirmAssignment}
          onClose={() => setSelectedTrip(null)}
        />
      )}

      {/* New Trip Modal */}
      {showNewTripModal && (
        <NewTripModal
          onTripCreated={handleTripCreated}
          onClose={() => setShowNewTripModal(false)}
        />
      )}

      {/* Success Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 bg-gray-900 border border-white/10 text-white px-5 py-3.5 rounded-xl shadow-2xl">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <p className="text-sm font-medium">{toast}</p>
          <button onClick={() => setToast(null)} className="ml-1 text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
