import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const CreditsContext = createContext({});

/** Uygulama açılışında tesis önce cache'den gelir; /auth/me gelene kadar kalan=0 görünüp yanlışlıkla paywall açılabiliyordu. Bu süre kadar bekleyip tekrar kontrol ediyoruz. */
const PAYWALL_AUTO_SHOW_DELAY_MS = 1800;

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
  const paywallDelayRef = useRef(null);

  useEffect(() => {
    const { show, reason } = shouldShowPaywall(tesis);
    if (paywallDelayRef.current) {
      clearTimeout(paywallDelayRef.current);
      paywallDelayRef.current = null;
    }
    if (show) {
      paywallDelayRef.current = setTimeout(() => {
        paywallDelayRef.current = null;
        const recheck = shouldShowPaywall(tesis);
        if (recheck.show) {
          setShowPaywall(true);
          setPaywallReason(recheck.reason ?? 'no_credits');
        }
      }, PAYWALL_AUTO_SHOW_DELAY_MS);
    } else {
      setShowPaywall(false);
    }
    return () => {
      if (paywallDelayRef.current) {
        clearTimeout(paywallDelayRef.current);
        paywallDelayRef.current = null;
      }
    };
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
