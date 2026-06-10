import { useCallback, useEffect, useState } from "react";

import { DEFAULT_HAKI_BOND_STATE, type HakiBondEvent, type HakiBondState } from "./hakiMascotState";
import { hakiBondStore } from "@/services/hakiBondService";

let returnVisitRecordedThisSession = false;

export function useHakiBond() {
  const [bondState, setBondState] = useState<HakiBondState>(DEFAULT_HAKI_BOND_STATE);

  useEffect(() => {
    let mounted = true;
    void hakiBondStore.getBondState()
      .then(async (state) => {
        const lastInteraction = state.lastInteractionAt ? Date.parse(state.lastInteractionAt) : 0;
        const isReturnVisit = lastInteraction > 0 && Date.now() - lastInteraction > 12 * 60 * 60 * 1000;
        if (isReturnVisit && !returnVisitRecordedThisSession) {
          returnVisitRecordedThisSession = true;
          return hakiBondStore.recordBondEvent("returnVisit");
        }
        return state;
      })
      .then((state) => {
        if (mounted) setBondState(state);
      })
      .catch(() => {
        if (mounted) setBondState(DEFAULT_HAKI_BOND_STATE);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const recordBondEvent = useCallback((event: HakiBondEvent) => {
    void hakiBondStore.recordBondEvent(event)
      .then(setBondState)
      .catch(() => {
        /* Bond state is decorative; do not interrupt campus workflows. */
      });
  }, []);

  return {
    bondState,
    recordBondEvent
  };
}
