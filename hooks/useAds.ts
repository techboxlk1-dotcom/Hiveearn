'use client';

import { useCallback } from 'react';

export interface AdResult {
  success: boolean;
  watched: boolean;
  clicked: boolean;
}

export function useAds() {
  const adsgramReady = useCallback(() => typeof window !== 'undefined' && !!window.Adsgram, []);

  // Block int-36139: auto-open interstitial, no reward, no error shown
  const showAutoAd = useCallback(async () => {
    if (!adsgramReady()) return;
    try {
      const controller = window.Adsgram!.init({ blockId: 'int-36139' });
      controller.show().catch(() => {});
    } catch {
      // silently ignore
    }
  }, [adsgramReady]);

  // Block 36138: rewarded ad — returns result
  const showRewardAd = useCallback((): Promise<AdResult> => {
    return new Promise((resolve) => {
      if (!adsgramReady()) {
        resolve({ success: false, watched: false, clicked: false });
        return;
      }
      try {
        const controller = window.Adsgram!.init({ blockId: '36138' });
        controller.show()
          .then((result) => {
            resolve({ success: result.done, watched: !result.error, clicked: result.done });
          })
          .catch(() => {
            resolve({ success: false, watched: false, clicked: false });
          });
      } catch {
        resolve({ success: false, watched: false, clicked: false });
      }
    });
  }, [adsgramReady]);

  // Monetag ad — returns after SDK call (no reliable done callback)
  const showMonetag = useCallback((): Promise<{ opened: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.show_11196790) {
        resolve({ opened: false });
        return;
      }
      try {
        window.show_11196790();
        resolve({ opened: true });
      } catch {
        resolve({ opened: false });
      }
    });
  }, []);

  // Gigapub ad — returns promise result
  const showGigapub = useCallback((): Promise<{ success: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.showGiga) {
        resolve({ success: false });
        return;
      }
      window.showGiga!()
        .then(() => resolve({ success: true }))
        .catch(() => resolve({ success: false }));
    });
  }, []);

  // Random network ad for daily/referral/reward code (picks randomly from available)
  const showRandomAd = useCallback(async (): Promise<void> => {
    const options = ['adsgram', 'monetag', 'gigapub'];
    const pick = options[Math.floor(Math.random() * options.length)];
    if (pick === 'adsgram' && adsgramReady()) {
      try {
        const controller = window.Adsgram!.init({ blockId: 'int-36139' });
        controller.show().catch(() => {});
        return;
      } catch { /* fall through */ }
    }
    if (pick === 'monetag' && typeof window !== 'undefined' && window.show_11196790) {
      try { window.show_11196790(); return; } catch { /* fall through */ }
    }
    if (typeof window !== 'undefined' && window.showGiga) {
      try { window.showGiga!().catch(() => {}); } catch { /* ignore */ }
    }
  }, [adsgramReady]);

  return { showAutoAd, showRewardAd, showMonetag, showGigapub, showRandomAd, adsgramReady };
}
