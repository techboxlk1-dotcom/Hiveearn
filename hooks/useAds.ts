'use client';

import { useCallback, useRef } from 'react';

export interface AdResult {
  success: boolean;
  watched: boolean;
  clicked: boolean;
  watchTimeSeconds: number;
}

export interface AdCloseResult {
  opened: boolean;
  closed: boolean;
  watchTimeSeconds: number;
}

// Provider-specific minimum watch times
const PROVIDER_MIN_TIMES: Record<string, number> = {
  'adsgram-reward': 31,    // Adsgram Reward - 31+ seconds
  'adsgram-ai': 16,        // Adsgram AI - 16+ seconds
  'monetag': 0,            // Monetag - instant
  'gigapub': 0,            // Gigapub - instant
  'monetix': 0,            // Monetix - instant
};

export function useAds() {
  const adsgramReady = useCallback(() => typeof window !== 'undefined' && !!window.Adsgram, []);

  // Auto ad - just shows without tracking (for home page)
  const showAutoAd = useCallback(async () => {
    if (!adsgramReady()) return;
    try {
      const controller = window.Adsgram!.init({ blockId: 'int-36139' });
      controller.show().catch(() => {});
    } catch {
      // silently ignore
    }
  }, [adsgramReady]);

  // Get minimum watch time for provider
  const getMinWatchTime = useCallback((provider: {
    block_id?: string | null;
    network_type?: string | null;
    slug?: string | null;
    min_watch_seconds?: number | null;
  }): number => {
    // Use database value if set
    if (provider.min_watch_seconds && provider.min_watch_seconds > 0) {
      return provider.min_watch_seconds;
    }

    const blockId = provider.block_id ?? '';
    const slug = provider.slug ?? '';

    // Adsgram Reward (block ID 36138)
    if (blockId === '36138' || slug === 'adsgram-reward') {
      return PROVIDER_MIN_TIMES['adsgram-reward'];
    }

    // Adsgram AI / Interstitial (block ID int-36139)
    if (blockId === 'int-36139' || slug === 'adsgram-ai' || slug === 'adsgram') {
      return PROVIDER_MIN_TIMES['adsgram-ai'];
    }

    // Monetag
    if (slug === 'monetag' || provider.network_type === 'monetag') {
      return PROVIDER_MIN_TIMES['monetag'];
    }

    // Gigapub
    if (slug === 'gigapub' || provider.network_type === 'gigapub') {
      return PROVIDER_MIN_TIMES['gigapub'];
    }

    // Default 15 seconds
    return 15;
  }, []);

  // Track actual watch time using visibility API
  const startAdWithTimer = useCallback((provider: {
    block_id?: string | null;
    network_type?: string | null;
    slug?: string | null;
    min_watch_seconds?: number | null;
  }): Promise<AdCloseResult> => {
    return new Promise((resolve) => {
      const minWatchSeconds = getMinWatchTime(provider);
      const isInstantReward = minWatchSeconds === 0;

      let resolved = false;
      let adStartTime = 0;
      let totalWatchTime = 0;

      const cleanup = () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
      };

      const finish = (result: AdCloseResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      // Calculate watch time when user returns
      const calculateWatchTime = () => {
        if (adStartTime > 0) {
          totalWatchTime = Math.floor((Date.now() - adStartTime) / 1000);
        }
        return totalWatchTime;
      };

      // Track when app is hidden/visible
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          // User left the app (ad opened)
          adStartTime = Date.now();
        } else if (document.visibilityState === 'visible') {
          // User returned to app (ad closed)
          const watchTime = calculateWatchTime();
          finish({ opened: adStartTime > 0, closed: true, watchTimeSeconds: watchTime });
        }
      };

      // Also track blur/focus for non-Telegram environments
      const onBlur = () => {
        if (adStartTime === 0) {
          adStartTime = Date.now();
        }
      };

      const onFocus = () => {
        if (adStartTime > 0) {
          const watchTime = calculateWatchTime();
          finish({ opened: true, closed: true, watchTimeSeconds: watchTime });
        }
      };

      // Set up listeners
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);

      const blockId = provider.block_id ?? '';
      const slug = provider.slug ?? '';
      const isAdsgram = blockId === '36138' || blockId === 'int-36139' ||
        (provider.network_type === 'adsgram') || slug.includes('adsgram');
      const isMonetag = slug === 'monetag' || provider.network_type === 'monetag';
      const isGigapub = slug === 'gigapub' || provider.network_type === 'gigapub';
      const isMonetix = slug === 'monetix' || provider.network_type === 'monetix';

      // Safety timeout (3 minutes)
      const safetyTimer = setTimeout(() => {
        if (!resolved) {
          const watchTime = calculateWatchTime();
          finish({ opened: adStartTime > 0, closed: true, watchTimeSeconds: watchTime });
        }
      }, 180000);

      // Adsgram has its own promise - we track time via visibility
      if (isAdsgram && adsgramReady()) {
        try {
          const bid = blockId === '36138' ? '36138' : 'int-36139';
          const controller = window.Adsgram!.init({ blockId: bid });
          controller.show()
            .then((result) => {
              clearTimeout(safetyTimer);
              const watchTime = calculateWatchTime();
              // For instant reward providers (Monetag/Gigapub style), always give reward
              if (isInstantReward) {
                finish({ opened: !result.error, closed: true, watchTimeSeconds: watchTime || 1 });
              } else {
                finish({ opened: !result.error, closed: true, watchTimeSeconds: watchTime });
              }
            })
            .catch(() => {
              clearTimeout(safetyTimer);
              finish({ opened: false, closed: true, watchTimeSeconds: 0 });
            });
        } catch {
          clearTimeout(safetyTimer);
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Monetag - instant reward on return
      if (isMonetag && typeof window !== 'undefined' && window.show_11196790) {
        try {
          window.show_11196790();
          // Will resolve via visibility change when user returns
        } catch {
          clearTimeout(safetyTimer);
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Gigapub - instant reward on return
      if (isGigapub && typeof window !== 'undefined' && window.showGiga) {
        try {
          const result = window.showGiga();
          if (result && typeof result.then === 'function') {
            result.then(() => {
              clearTimeout(safetyTimer);
              const watchTime = calculateWatchTime();
              finish({ opened: true, closed: true, watchTimeSeconds: watchTime || 1 });
            }).catch(() => {
              clearTimeout(safetyTimer);
              finish({ opened: false, closed: true, watchTimeSeconds: 0 });
            });
          }
          // If not a promise, wait for visibility/focus events
        } catch {
          clearTimeout(safetyTimer);
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Monetix
      if (isMonetix && typeof window !== 'undefined' && window.showRewardAd) {
        try {
          window.showRewardAd((res: { status: string }) => {
            clearTimeout(safetyTimer);
            const watchTime = calculateWatchTime();
            finish({ opened: res.status === 'completed' || res.status === 'closed', closed: true, watchTimeSeconds: watchTime || 1 });
          });
        } catch {
          clearTimeout(safetyTimer);
          finish({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // Unknown provider - instant reward
      clearTimeout(safetyTimer);
      finish({ opened: false, closed: true, watchTimeSeconds: 0 });
    });
  }, [adsgramReady, getMinWatchTime]);

  // Simple reward ad (for backwards compatibility)
  const showRewardAd = useCallback((): Promise<AdResult> => {
    return new Promise((resolve) => {
      if (!adsgramReady()) {
        resolve({ success: false, watched: false, clicked: false, watchTimeSeconds: 0 });
        return;
      }
      try {
        const controller = window.Adsgram!.init({ blockId: '36138' });
        controller.show()
          .then((result) => {
            const done = result.done && !result.error;
            resolve({ success: done, watched: !result.error, clicked: done, watchTimeSeconds: 31 });
          })
          .catch(() => {
            resolve({ success: false, watched: false, clicked: false, watchTimeSeconds: 0 });
          });
      } catch {
        resolve({ success: false, watched: false, clicked: false, watchTimeSeconds: 0 });
      }
    });
  }, [adsgramReady]);

  // Random network ad - instant reward (for daily bonus)
  const showRandomAd = useCallback(async (): Promise<{ success: boolean; network: string }> => {
    // Just show adsgram interstitial
    if (adsgramReady()) {
      try {
        const controller = window.Adsgram!.init({ blockId: 'int-36139' });
        await controller.show();
        return { success: true, network: 'adsgram' };
      } catch { /* ignore */ }
    }
    return { success: true, network: 'skipped' }; // Always succeed for daily bonus
  }, [adsgramReady]);

  return {
    showAutoAd,
    showRewardAd,
    showRandomAd,
    startAdWithTimer,
    adsgramReady,
    getMinWatchTime
  };
}
