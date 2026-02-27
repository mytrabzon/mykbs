import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';

const CreditsContext = createContext({});

function shouldShowPaywall(tesis) {
  if (!tesis || tesis.kota == null) return { show: false };
  const used = tesis.kullanilanKota ?? 0;
  const kalan = tesis.kota - used;
  const trialEnded =
    tesis.paket === 'deneme' &&
    tesis.trialEndsAt &&
    new Date(tesis.trialEndsAt) < new Date();
  if (kalan <= 0 || trialEnded) {
    return { show: true, reason: trialEnded ? 'trial_ended' : 'no_credits' };
  }
  return { show: false };
}

function isTrialActive(tesis) {
  if (!tesis || tesis.paket !== 'deneme') return false;
  if (!tesis.trialEndsAt) return true;
  return new Date(tesis.trialEndsAt) >= new Date();
}

export function CreditsProvider({ children }) {
  const { tesis } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState('no_credits');
  const [dismissedWelcomeTrial, setDismissedWelcomeTrial] = useState(false);

  useEffect(() => {
    const { show, reason } = shouldShowPaywall(tesis);
    if (show) {
      setShowPaywall(true);
      setPaywallReason(reason ?? 'no_credits');
    } else {
      setShowPaywall(false);
    }
  }, [tesis?.id, tesis?.kota, tesis?.kullanilanKota, tesis?.paket, tesis?.trialEndsAt]);

  const triggerPaywall = (reason = 'no_credits') => {
    setPaywallReason(reason);
    setShowPaywall(true);
  };

  const kalan = tesis && tesis.kota != null ? Math.max(0, tesis.kota - (tesis.kullanilanKota ?? 0)) : 0;
  const showWelcomeTrial =
    isTrialActive(tesis) && kalan > 0 && !dismissedWelcomeTrial;
  const dismissWelcomeTrial = () => setDismissedWelcomeTrial(true);

  const value = useMemo(
    () => ({
      showPaywall,
      setShowPaywall,
      paywallReason,
      setPaywallReason,
      triggerPaywall,
      showWelcomeTrial,
      dismissWelcomeTrial,
    }),
    [showPaywall, paywallReason, showWelcomeTrial]
  );

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  return ctx || {};
}
