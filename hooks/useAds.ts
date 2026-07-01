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

export interface AdCloseResult {
  opened: boolean;
  closed: boolean;
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

  // Random network ad — returns whether ad actually played
  const showRandomAd = useCallback(async (): Promise<RandomAdResult> => {
    const options = ['adsgram', 'monetag', 'gigapub'];
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

  // ─── Concurrent ad display with close detection ────────────────────────────
  //
  // This function calls the ad SDK AND sets up close detection simultaneously.
  // It returns a promise that resolves when the ad is closed/skipped.
  // The caller should race this against a countdown timer:
  //   - If timer completes first → ad watched → give reward
  //   - If ad closes first → ad skipped → no reward
  //
  // For Adsgram: uses the SDK's own promise (resolves on close)
  // For Monetag/Gigapub: uses blur/focus + visibilitychange to detect close

  const startAdAndDetectClose = useCallback((provider: {
    block_id?: string | null;
    network_type?: string | null;
    slug?: string | null;
  }): Promise<AdCloseResult> => {
    return new Promise((resolve) => {
      let resolved = false;
      let adOpened = false;
      let listenersAttached = false;
      let noOpenTimer: ReturnType<typeof setTimeout> | undefined;
      let safetyTimer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (listenersAttached) {
          window.removeEventListener('blur', onBlur);
          window.removeEventListener('focus', onFocus);
          document.removeEventListener('visibilitychange', onVisChange);
          listenersAttached = false;
        }
      };

      const finish = (result: AdCloseResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (noOpenTimer) clearTimeout(noOpenTimer);
        if (safetyTimer) clearTimeout(safetyTimer);
        resolve(result);
      };

      const onBlur = () => { adOpened = true; };
      const onFocus = () => { finish({ opened: adOpened, closed: true }); };
      const onVisChange = () => {
        if (document.visibilityState === 'hidden') adOpened = true;
        if (document.visibilityState === 'visible') finish({ opened: adOpened, closed: true });
      };

      const blockId = provider.block_id ?? '';
      const isAdsgram = blockId === '36138' || blockId === 'int-36139' ||
        (provider.network_type === 'adsgram' && (provider.slug === 'adsgram' || !provider.slug));
      const isMonetag = provider.network_type === 'monetag' || provider.slug === 'monetag';
      const isGigapub = provider.network_type === 'gigapub' || provider.slug === 'gigapub';

      // For Adsgram: use SDK's own close callback
      if (isAdsgram && adsgramReady()) {
        try {
          const bid = blockId === '36138' ? '36138' : 'int-36139';
          const controller = window.Adsgram!.init({ blockId: bid });
          controller.show()
            .then((result) => {
              // Adsgram resolves when ad closes — check if it was watched
              const opened = !result.error;
              finish({ opened, closed: true });
            })
            .catch(() => {
              finish({ opened: false, closed: true });
            });
        } catch {
          finish({ opened: false, closed: true });
        }
        return;
      }

      // For Monetag/Gigapub: detect close via blur/focus + visibilitychange
      if ((isMonetag || isGigapub) && typeof window !== 'undefined') {
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisChange);
        listenersAttached = true;

        try {
          if (isMonetag && window.show_11196790) {
            window.show_11196790();
          } else if (isGigapub && window.showGiga) {
            const result = window.showGiga();
            if (result && typeof result.then === 'function') {
              result.then(() => finish({ opened: adOpened, closed: true }))
                    .catch(() => finish({ opened: false, closed: true }));
            }
          } else {
            // SDK function doesn't exist
            finish({ opened: false, closed: true });
            return;
          }
        } catch {
          finish({ opened: false, closed: true });
          return;
        }

        // If no blur event within 4 seconds, ad probably didn't open
        const noOpenTimer = setTimeout(() => {
          if (!resolved && !adOpened) {
            finish({ opened: false, closed: true });
          }
        }, 4000);

        // Safety timeout: 120 seconds
        const safetyTimer = setTimeout(() => {
          finish({ opened: adOpened, closed: true });
        }, 120000);

        return;
      }

      // Unknown provider
      finish({ opened: false, closed: true });
    });
  }, [adsgramReady]);

  return { showAutoAd, showRewardAd, showRandomAd, startAdAndDetectClose, adsgramReady };
}
