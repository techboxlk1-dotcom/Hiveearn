'use client';

import { useCallback, useRef } from 'react';

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
  watchTimeSeconds: number; // How long the ad was actually visible
}

export function useAds() {
  const adsgramReady = useCallback(() => typeof window !== 'undefined' && !!window.Adsgram, []);

  // Auto ad - just shows without complex tracking
  const showAutoAd = useCallback(async () => {
    if (!adsgramReady()) return;
    try {
      const controller = window.Adsgram!.init({ blockId: 'int-36139' });
      controller.show().catch(() => {});
    } catch {
      // silently ignore
    }
  }, [adsgramReady]);

  // Reward ad with proper tracking
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

  // Random network ad
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

  // Track actual watch time using visibility API
  const startAdWithTimer = useCallback((provider: {
    block_id?: string | null;
    network_type?: string | null;
    slug?: string | null;
    min_watch_seconds?: number | null;
  }): Promise<AdCloseResult> => {
    return new Promise((resolve) => {
      const minWatchSeconds = provider.min_watch_seconds || 5;
      let resolved = false;
      let adOpened = false;
      let adStartTime = 0;
      let totalWatchTime = 0;
      let timerInterval: ReturnType<typeof setInterval> | undefined;
      let safetyTimer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timerInterval) clearInterval(timerInterval);
        // Visibility listeners keep running to detect when user returns
      };

      const finish = (result: AdCloseResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (safetyTimer) clearTimeout(safetyTimer);
        resolve(result);
      };

      // Track when app is hidden/visible
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          // User left the app (ad opened or switched away)
          if (!adOpened) {
            adOpened = true;
            adStartTime = Date.now();
          } else {
            // Pause counting - user left while ad was playing
          }
        } else if (document.visibilityState === 'visible') {
          // User returned to app
          if (adOpened) {
            // Ad closed - user came back from ad
            totalWatchTime = Math.floor((Date.now() - adStartTime) / 1000);
            finish({ opened: adOpened, closed: true, watchTimeSeconds: totalWatchTime });
          }
        }
      };

      // Also track blur/focus for web
      const onBlur = () => {
        if (!adOpened) {
          adOpened = true;
          adStartTime = Date.now();
        }
      };

      const onFocus = () => {
        if (adOpened) {
          totalWatchTime = Math.floor((Date.now() - adStartTime) / 1000);
          finish({ opened: adOpened, closed: true, watchTimeSeconds: totalWatchTime });
        }
      };

      // Set up listeners
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);

      const blockId = provider.block_id ?? '';
      const isAdsgram = blockId === '36138' || blockId === 'int-36139' ||
        (provider.network_type === 'adsgram' && (provider.slug === 'adsgram' || !provider.slug));
      const isMonetag = provider.network_type === 'monetag' || provider.slug === 'monetag';
      const isGigapub = provider.network_type === 'gigapub' || provider.slug === 'gigapub';
      const isMonetix = provider.network_type === 'monetix' || provider.slug === 'monetix';

      // Safety timeout for cleanup
      safetyTimer = setTimeout(() => {
        if (!resolved) {
          if (adOpened) {
            totalWatchTime = Math.floor((Date.now() - adStartTime) / 1000);
          }
          finish({ opened: adOpened, closed: true, watchTimeSeconds: totalWatchTime });
        }
      }, 180000); // 3 minutes max

      // Adsgram has its own promise
      if (isAdsgram && adsgramReady()) {
        try {
          const bid = blockId === '36138' ? '36138' : 'int-36139';
          const controller = window.Adsgram!.init({ blockId: bid });
          controller.show()
            .then((result) => {
              // Calculate watch time from when ad opened
              if (adOpened && adStartTime > 0) {
                totalWatchTime = Math.floor((Date.now() - adStartTime) / 1000);
              }
              finish({ opened: !result.error, closed: true, watchTimeSeconds: totalWatchTime });
            })
            .catch(() => {
              finish({ opened: false, closed: true, watchTimeSeconds: 0 });
            });
        } catch {
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Monetag - call the show function
      if (isMonetag && typeof window !== 'undefined' && window.show_11196790) {
        try {
          window.show_11196790();
          // Will be resolved when user returns (visibility change or focus)
        } catch {
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Gigapub - call the show function
      if (isGigapub && typeof window !== 'undefined' && window.showGiga) {
        try {
          const result = window.showGiga();
          if (result && typeof result.then === 'function') {
            result.then(() => {
              if (adOpened && adStartTime > 0) {
                totalWatchTime = Math.floor((Date.now() - adStartTime) / 1000);
              }
              finish({ opened: adOpened, closed: true, watchTimeSeconds: totalWatchTime });
            }).catch(() => {
              finish({ opened: false, closed: true, watchTimeSeconds: 0 });
            });
          }
          // If not a promise, wait for visibility/focus events
        } catch {
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Monetix - use showRewardAd global function
      if (isMonetix && typeof window !== 'undefined') {
        try {
          // Monetix ads handle via script in layout
          // Will resolve via visibility events
          if (window.showRewardAd) {
            window.showRewardAd((res: { status: string }) => {
              if (adOpened && adStartTime > 0) {
                totalWatchTime = Math.floor((Date.now() - adStartTime) / 1000);
              }
              finish({ opened: res.status === 'completed' || res.status === 'closed', closed: true, watchTimeSeconds: totalWatchTime });
            });
          }
        } catch {
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Unknown provider or SDK not available
      finish({ opened: false, closed: true, watchTimeSeconds: 0 });
    });
  }, [adsgramReady]);

  return { showAutoAd, showRewardAd, showRandomAd, startAdWithTimer, adsgramReady };
}
