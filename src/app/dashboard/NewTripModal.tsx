'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { TripWithRelations } from '@/types/database';

// ─── Shared input class ────────────────────────────────────────────────────────

const INPUT =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white ' +
  'placeholder:text-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 ' +
  'focus:ring-green-500/40 transition disabled:opacity-50';

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
        {label}
        {required && <span className="text-green-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 whitespace-nowrap">
        {label}
      </p>
      <div className="flex-1 h-px bg-slate-700/70" />
    </div>
  );
}

// ─── NewTripModal ─────────────────────────────────────────────────────────────

export default function NewTripModal({
  onTripCreated,
  onClose,
}: {
  onTripCreated: (trip: TripWithRelations) => void;
  onClose: () => void;
}) {
  // Customer fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessType, setBusinessType] = useState('');

  // Trip fields
  const [loadDescription, setLoadDescription] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupTime, setPickupTime] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit =
    fullName.trim() &&
    phoneNumber.trim() &&
    loadDescription.trim() &&
    pickupLocation.trim() &&
    dropoffLocation.trim() &&
    pickupTime;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // ── Step 1: Check if customer already exists by phone number ──────────
      const { data: existing, error: lookupError } = await supabase
        .from('customers')
        .select('id')
        .eq('phone_number', phoneNumber.trim())
        .limit(1);

      if (lookupError) throw new Error(lookupError.message);

      // ── Step 2: Upsert customer ───────────────────────────────────────────
      let customerId: string;

      if (existing && existing.length > 0) {
        // Returning customer — reuse their id
        customerId = existing[0].id;
      } else {
        // New customer — insert and grab the new id
        const { data: newCustomer, error: insertCustomerError } = await supabase
          .from('customers')
          .insert({
            full_name: fullName.trim(),
            phone_number: phoneNumber.trim(),
            business_type: businessType.trim() || null,
          })
          .select('id')
          .single();

        if (insertCustomerError) throw new Error(insertCustomerError.message);
        customerId = newCustomer.id;
      }

      // ── Step 3: Insert the trip ───────────────────────────────────────────
      const { data: newTrip, error: tripError } = await supabase
        .from('trips')
        .insert({
          customer_id: customerId,
          load_description: loadDescription.trim(),
          pickup_location: pickupLocation.trim(),
          dropoff_location: dropoffLocation.trim(),
          pickup_time: new Date(pickupTime).toISOString(),
          status: 'Pending',
          driver_id: null,
          agreed_fare: null,
          commission_paid: false,
        })
        // Fetch back with joins so the card renders immediately
        .select('*, customer:customers(*), driver:drivers(*)')
        .single();

      if (tripError) throw new Error(tripError.message);

      onTripCreated(newTrip as TripWithRelations);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
      setSubmitting(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!submitting && e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      {/* Modal card */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-green-400" />
            <div>
              <h2 className="text-base font-bold text-white">New Trip</h2>
              <p className="text-xs text-slate-400 mt-0.5">Log an incoming request</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Customer Details */}
          <section className="space-y-4">
            <SectionDivider label="Customer Details" />

            <Field label="Full Name" required>
              <input
                type="text"
                placeholder="e.g. Amina Hassan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
                className={INPUT}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone Number" required>
                <input
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={submitting}
                  className={INPUT}
                  required
                />
              </Field>
              <Field label="Business Type">
                <input
                  type="text"
                  placeholder="e.g. Hardware"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  disabled={submitting}
                  className={INPUT}
                />
              </Field>
            </div>
          </section>

          {/* Trip Details */}
          <section className="space-y-4">
            <SectionDivider label="Trip Details" />

            <Field label="Load Description" required>
              <input
                type="text"
                placeholder="e.g. Cement bags (100 × 50 kg)"
                value={loadDescription}
                onChange={(e) => setLoadDescription(e.target.value)}
                disabled={submitting}
                className={INPUT}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup Location" required>
                <input
                  type="text"
                  placeholder="e.g. Westlands, Nairobi"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  disabled={submitting}
                  className={INPUT}
                  required
                />
              </Field>
              <Field label="Dropoff Location" required>
                <input
                  type="text"
                  placeholder="e.g. Mombasa CBD"
                  value={dropoffLocation}
                  onChange={(e) => setDropoffLocation(e.target.value)}
                  disabled={submitting}
                  className={INPUT}
                  required
                />
              </Field>
            </div>

            <Field label="Pickup Date & Time" required>
              <input
                type="datetime-local"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                disabled={submitting}
                // [color-scheme:dark] makes the native date-picker UI dark on Chromium
                className={`${INPUT} [color-scheme:dark]`}
                required
              />
            </Field>
          </section>

          {/* Inline error */}
          {submitError && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-300 leading-relaxed">{submitError}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-slate-700/60 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
              canSubmit && !submitting
                ? 'bg-[#25D366] hover:bg-[#1fbc59] text-white shadow-lg shadow-green-500/20 active:scale-[0.98]'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Logging Trip…
              </>
            ) : (
              <>
                Log Trip
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
