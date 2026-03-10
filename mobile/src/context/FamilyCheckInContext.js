import React, { createContext, useContext, useRef, useCallback } from 'react';

const FamilyCheckInContext = createContext(null);

/**
 * Aile girişi modunda MRZ okunduğunda eklenmek üzere callback.
 * FamilyCheckInScreen mount olduğunda set edilir; MrzScanScreen mode='family' iken sonuç gelince bu callback çağrılır.
 */
export function FamilyCheckInProvider({ children }) {
  const addMemberRef = useRef(null);

  const setAddMemberCallback = useCallback((cb) => {
    addMemberRef.current = cb;
  }, []);

  const addMemberFromScan = useCallback((memberData) => {
    if (addMemberRef.current) addMemberRef.current(memberData);
  }, []);

  return (
    <FamilyCheckInContext.Provider value={{ setAddMemberCallback, addMemberFromScan }}>
      {children}
    </FamilyCheckInContext.Provider>
  );
}

export function useFamilyCheckIn() {
  const ctx = useContext(FamilyCheckInContext);
  return ctx;
}
