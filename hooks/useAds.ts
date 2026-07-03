'use client';

import { useCallback } from 'react';

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
  'adsgram-reward': 31,
  'adsgram-ai': 16,
  'monetag': 0,
  'gigapub': 0,
  'monetix': 0,
};

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

  const getMinWatchTime = useCallback((provider: {
    block_id?: string | null;
    network_type?: string | null;
    slug?: string | null;
    min_watch_seconds?: number | null;
  }): number => {
    const blockId = provider.block_id ?? '';
    const slug = provider.slug ?? '';

    // Gigapub and Monetag are always instant regardless of DB value
    if (slug === 'gigapub' || provider.network_type === 'gigapub') return 0;
    if (slug === 'monetag' || provider.network_type === 'monetag') return 0;
    if (slug === 'monetix' || provider.network_type === 'monetix') return 0;

    // Use database value if set (for Adsgram providers)
    if (provider.min_watch_seconds && provider.min_watch_seconds > 0) {
      return provider.min_watch_seconds;
    }

    // Adsgram Reward (block ID 36138)
    if (blockId === '36138' || slug === 'adsgram-reward') {
      return PROVIDER_MIN_TIMES['adsgram-reward'];
    }

    // Adsgram AI / Interstitial (block ID int-36139)
    if (blockId === 'int-36139' || slug === 'adsgram-ai' || slug === 'adsgram') {
      return PROVIDER_MIN_TIMES['adsgram-ai'];
    }

    return 15;
  }, []);

  const startAdWithTimer = useCallback((provider: {
    block_id?: string | null;
    network_type?: string | null;
    slug?: string | null;
    min_watch_seconds?: number | null;
  }): Promise<AdCloseResult> => {
    return new Promise((resolve) => {
      const minWatchSeconds = getMinWatchTime(provider);

      const blockId = provider.block_id ?? '';
      const slug = provider.slug ?? '';
      const isAdsgram = blockId === '36138' || blockId === 'int-36139' ||
        provider.network_type === 'adsgram' || slug.includes('adsgram');
      const isMonetag = slug === 'monetag' || provider.network_type === 'monetag';
      const isGigapub = slug === 'gigapub' || provider.network_type === 'gigapub';
      const isMonetix = slug === 'monetix' || provider.network_type === 'monetix';

      // ── Adsgram ────────────────────────────────────────────────────────────
      // Trust the SDK promise — the Telegram WebApp overlay does NOT fire
      // visibilitychange reliably, so we never use wall-clock timing for Adsgram.
      // When the promise resolves with done=true, the SDK already enforced the
      // minimum watch time internally. When it rejects or errors, ad failed.
      if (isAdsgram) {
        if (!adsgramReady()) {
          resolve({ opened: false, closed: true, watchTimeSeconds: 0 });
          return;
        }
        const bid = blockId === '36138' ? '36138' : 'int-36139';
        try {
          const controller = window.Adsgram!.init({ blockId: bid });
          controller.show()
            .then((result) => {
              if (result.done && !result.error) {
                // SDK confirmed ad was fully watched
                resolve({ opened: true, closed: true, watchTimeSeconds: minWatchSeconds + 1 });
              } else {
                // User closed early or ad errored
                resolve({ opened: true, closed: true, watchTimeSeconds: 0 });
              }
            })
            .catch(() => {
              resolve({ opened: false, closed: true, watchTimeSeconds: 0 });
            });
        } catch {
          resolve({ opened: false, closed: true, watchTimeSeconds: 0 });
        }
        return;
      }

      // ── Gigapub ────────────────────────────────────────────────────────────
      if (isGigapub) {
        const tryShow = () => {
          if (typeof window !== 'undefined' && typeof window.showGiga === 'function') {
            try {
              const gigaResult = window.showGiga();
              const p = gigaResult as unknown as Promise<unknown> | undefined;
              if (p && typeof p.then === 'function') {
                p.then(() => {
                  resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
                }).catch(() => {
                  // No ad fill or error — still give reward for instant provider
                  resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
                });
              } else {
                resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
              }
            } catch {
              resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
            }
          } else {
            // Script not yet loaded — give instant reward
            resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
          }
        };

        // Give script a moment to initialize if needed
        if (typeof window !== 'undefined' && typeof window.showGiga === 'function') {
          tryShow();
        } else {
          setTimeout(tryShow, 1000);
        }
        return;
      }

      // ── Monetag ────────────────────────────────────────────────────────────
      if (isMonetag) {
        if (typeof window !== 'undefined' && typeof window.show_11196790 === 'function') {
          try {
            window.show_11196790();
          } catch {
            // ignore
          }
        }
        // Monetag is fire-and-forget — give instant reward
        resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
        return;
      }

      // ── Monetix ────────────────────────────────────────────────────────────
      if (isMonetix) {
        if (typeof window !== 'undefined' && typeof window.showRewardAd === 'function') {
          try {
            window.showRewardAd((res: { status: string }) => {
              const ok = res.status === 'completed' || res.status === 'closed';
              resolve({ opened: ok, closed: true, watchTimeSeconds: ok ? 1 : 0 });
            });
            return;
          } catch {
            // fall through to instant reward
          }
        }
        resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
        return;
      }

      // ── Unknown provider — instant reward ──────────────────────────────────
      resolve({ opened: true, closed: true, watchTimeSeconds: 1 });
    });
  }, [adsgramReady, getMinWatchTime]);

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
            resolve({ success: done, watched: !result.error, clicked: done, watchTimeSeconds: done ? 31 : 0 });
          })
          .catch(() => {
            resolve({ success: false, watched: false, clicked: false, watchTimeSeconds: 0 });
          });
      } catch {
        resolve({ success: false, watched: false, clicked: false, watchTimeSeconds: 0 });
      }
    });
  }, [adsgramReady]);

  const showRandomAd = useCallback(async (): Promise<{ success: boolean; network: string }> => {
    if (adsgramReady()) {
      try {
        const controller = window.Adsgram!.init({ blockId: 'int-36139' });
        await controller.show();
        return { success: true, network: 'adsgram' };
      } catch { /* ignore */ }
    }
    return { success: true, network: 'skipped' };
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
