'use client';

import { useCallback } from 'react';

export interface AdResult {
  success: boolean;
  watched: boolean;
  clicked: boolean;
}

export interface RandomAdResult {
  success: boolean;
  network: string;
}

export function useAds() {
  const adsgramReady = useCallback(() => typeof window !== 'undefined' && !!window.Adsgram, []);

  const showAutoAd = useCallback(async () => {
    if (!adsgramReady()) return;
    try {
      const controller = window.Adsgram!.init({ blockId: 'int-36139' });
      controller.show().catch(() => {});
    } catch {
      // silently ignore
    }
  }, [adsgramReady]);

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
            const done = result.done && !result.error;
            resolve({ success: done, watched: !result.error, clicked: done });
          })
          .catch(() => {
            resolve({ success: false, watched: false, clicked: false });
          });
      } catch {
        resolve({ success: false, watched: false, clicked: false });
      }
    });
  }, [adsgramReady]);

  // Monetag: shows ad and waits minimum 5 seconds to confirm it actually played
  const showMonetag = useCallback((): Promise<{ opened: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.show_11196790) {
        resolve({ opened: false });
        return;
      }
      try {
        window.show_11196790();
        // Wait 5 seconds before resolving — ensures the ad actually displayed
        // If the SDK throws or the function doesn't exist, we resolve immediately with false
        setTimeout(() => resolve({ opened: true }), 5000);
      } catch {
        resolve({ opened: false });
      }
    });
  }, []);

  // Gigapub: shows ad and waits to confirm
  const showGigapub = useCallback((): Promise<{ success: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.showGiga) {
        resolve({ success: false });
        return;
      }
      try {
        const result = window.showGiga!();
        if (result && typeof result.then === 'function') {
          result
            .then(() => resolve({ success: true }))
            .catch(() => resolve({ success: false }));
        } else {
          // If showGiga doesn't return a promise, wait 5s then resolve
          setTimeout(() => resolve({ success: true }), 5000);
        }
      } catch {
        resolve({ success: false });
      }
    });
  }, []);

  // Random network ad — returns whether ad actually played
  const showRandomAd = useCallback(async (): Promise<RandomAdResult> => {
    const options = ['adsgram', 'monetag', 'gigapub'];
    // Shuffle and try each until one works
    const shuffled = [...options].sort(() => Math.random() - 0.5);

    for (const pick of shuffled) {
      if (pick === 'adsgram' && adsgramReady()) {
        try {
          const controller = window.Adsgram!.init({ blockId: 'int-36139' });
          await controller.show();
          return { success: true, network: 'adsgram' };
        } catch { /* try next */ }
      }
      if (pick === 'monetag' && typeof window !== 'undefined' && window.show_11196790) {
        try {
          window.show_11196790();
          // Wait 5 seconds to confirm ad played
          await new Promise(r => setTimeout(r, 5000));
          return { success: true, network: 'monetag' };
        } catch { /* try next */ }
      }
      if (pick === 'gigapub' && typeof window !== 'undefined' && window.showGiga) {
        try {
          const result = window.showGiga!();
          if (result && typeof result.then === 'function') {
            await result;
          } else {
            await new Promise(r => setTimeout(r, 5000));
          }
          return { success: true, network: 'gigapub' };
        } catch { /* try next */ }
      }
    }
    return { success: false, network: 'none' };
  }, [adsgramReady]);

  return { showAutoAd, showRewardAd, showMonetag, showGigapub, showRandomAd, adsgramReady };
}
