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

// Minimum watch time for ALL providers — no exceptions
const UNIVERSAL_MIN_WATCH_SECONDS = 10;

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
    // Always enforce at least 10 seconds for every provider
    // If the database specifies a higher value (e.g. Adsgram 31s), use that
    if (provider.min_watch_seconds && provider.min_watch_seconds > UNIVERSAL_MIN_WATCH_SECONDS) {
      return provider.min_watch_seconds;
    }

    const blockId = provider.block_id ?? '';
    const slug = provider.slug ?? '';

    // Adsgram Reward (block ID 36138) — 31 seconds
    if (blockId === '36138' || slug === 'adsgram-reward') {
      return 31;
    }

    // Adsgram AI / Interstitial (block ID int-36139) — 16 seconds
    if (blockId === 'int-36139' || slug === 'adsgram-ai' || slug === 'adsgram') {
      return 16;
    }

    // All other providers (Monetag, Gigapub, Monetix, etc.) — 10 seconds minimum
    return UNIVERSAL_MIN_WATCH_SECONDS;
  }, []);

  // Wall-clock timer that tracks how long the ad overlay was visible.
  // Used for non-Adsgram providers where we can't trust SDK promises.
  const trackWatchTime = useCallback((): { start: () => void; stop: () => number } => {
    let startTime = 0;
    let elapsed = 0;
    let tracking = false;

    const onVisibilityChange = () => {
      if (document.hidden && tracking) {
        // Ad overlay closed or tab switched — stop tracking
        elapsed += (Date.now() - startTime) / 1000;
        tracking = false;
      } else if (!document.hidden && tracking) {
        // Came back — restart
        startTime = Date.now();
      }
    };

    return {
      start: () => {
        startTime = Date.now();
        elapsed = 0;
        tracking = true;
        document.addEventListener('visibilitychange', onVisibilityChange);
      },
      stop: () => {
        if (tracking) {
          elapsed += (Date.now() - startTime) / 1000;
          tracking = false;
        }
        document.removeEventListener('visibilitychange', onVisibilityChange);
        return Math.floor(elapsed);
      }
    };
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
      // Trust the SDK promise — when it resolves with done=true, the SDK
      // already enforced the minimum watch time internally.
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
                resolve({ opened: true, closed: true, watchTimeSeconds: minWatchSeconds + 1 });
              } else {
                // User closed early or ad errored — no reward
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
      // Must track wall-clock time — no reward unless ad was visible for minWatchSeconds
      if (isGigapub) {
        const tracker = trackWatchTime();
        let resolved = false;

        const finish = (opened: boolean) => {
          if (resolved) return;
          resolved = true;
          const watched = tracker.stop();
          resolve({ opened, closed: true, watchTimeSeconds: opened ? watched : 0 });
        };

        const tryShow = () => {
          if (typeof window !== 'undefined' && typeof window.showGiga === 'function') {
            try {
              tracker.start();
              const gigaResult = window.showGiga!();
              const p = gigaResult as unknown as Promise<unknown> | undefined;
              if (p && typeof p.then === 'function') {
                p.then(() => finish(true)).catch(() => finish(true));
              } else {
                // Non-promise result — wait for visibility change to detect close
                // Fallback: resolve after minWatchSeconds if no close detected
                setTimeout(() => finish(true), (minWatchSeconds + 2) * 1000);
              }
            } catch {
              finish(false);
            }
          } else {
            // Script not loaded — ad did NOT play, no reward
            finish(false);
          }
        };

        if (typeof window !== 'undefined' && typeof window.showGiga === 'function') {
          tryShow();
        } else {
          // Wait briefly for script, but don't give reward if it never loads
          setTimeout(() => {
            if (typeof window.showGiga === 'function') {
              tryShow();
            } else {
              finish(false);
            }
          }, 1500);
        }
        return;
      }

      // ── Monetag ────────────────────────────────────────────────────────────
      // Must track wall-clock time — no reward unless ad was visible for minWatchSeconds
      if (isMonetag) {
        const tracker = trackWatchTime();
        let resolved = false;

        const finish = (opened: boolean) => {
          if (resolved) return;
          resolved = true;
          const watched = tracker.stop();
          resolve({ opened, closed: true, watchTimeSeconds: opened ? watched : 0 });
        };

        if (typeof window !== 'undefined' && typeof window.show_11196790 === 'function') {
          try {
            tracker.start();
            window.show_11196790!();
            // Monetag is fire-and-forget — track via visibility change
            // If the overlay doesn't close within minWatchSeconds+5, assume it's still open
            setTimeout(() => finish(true), (minWatchSeconds + 5) * 1000);
          } catch {
            finish(false);
          }
        } else {
          // Script not loaded — ad did NOT play, no reward
          finish(false);
        }
        return;
      }

      // ── Monetix ────────────────────────────────────────────────────────────
      if (isMonetix) {
        const tracker = trackWatchTime();
        let resolved = false;

        const finish = (opened: boolean) => {
          if (resolved) return;
          resolved = true;
          const watched = tracker.stop();
          resolve({ opened, closed: true, watchTimeSeconds: opened ? watched : 0 });
        };

        if (typeof window !== 'undefined' && typeof window.showRewardAd === 'function') {
          try {
            tracker.start();
            window.showRewardAd!((res: { status: string }) => {
              const ok = res.status === 'completed' || res.status === 'closed';
              finish(ok);
            });
            // Fallback timeout
            setTimeout(() => finish(true), (minWatchSeconds + 5) * 1000);
          } catch {
            finish(false);
          }
        } else {
          finish(false);
        }
        return;
      }

      // ── Taddy ────────────────────────────────────────────────────────────
      if (slug === 'taddy' || provider.network_type === 'taddy') {
        const tracker = trackWatchTime();
        let resolved = false;

        const finish = (opened: boolean, watched: number) => {
          if (resolved) return;
          resolved = true;
          const w = tracker.stop();
          resolve({ opened, closed: true, watchTimeSeconds: opened ? Math.max(watched, w) : 0 });
        };

        try {
          if (typeof window !== 'undefined' && typeof (window as unknown as { Taddy?: { showAd: (opts: Record<string, unknown>) => Promise<unknown> } }).Taddy !== 'undefined') {
            tracker.start();
            const taddy = (window as unknown as { Taddy: { showAd: (opts: Record<string, unknown>) => Promise<unknown> } }).Taddy;
            taddy.showAd({
              pubId: '633a828ff467ad548911c3d994f8a1a7',
              onReward: () => finish(true, minWatchSeconds + 1),
              onClose: () => finish(true, 0),
              onError: () => finish(false, 0),
            }).catch(() => finish(false, 0));
            // Fallback timeout
            setTimeout(() => finish(true, 0), (minWatchSeconds + 10) * 1000);
          } else {
            finish(false, 0);
          }
        } catch {
          finish(false, 0);
        }
        return;
      }

      // ── TowerAds ──────────────────────────────────────────────────────────
      if (slug === 'towerads' || provider.network_type === 'towerads') {
        const tracker = trackWatchTime();
        let resolved = false;

        const finish = (opened: boolean, watched: number) => {
          if (resolved) return;
          resolved = true;
          const w = tracker.stop();
          resolve({ opened, closed: true, watchTimeSeconds: opened ? Math.max(watched, w) : 0 });
        };

        try {
          if (typeof window !== 'undefined' && typeof (window as unknown as { TowerAds?: new (opts: Record<string, unknown>) => { loadAndShow: () => Promise<void> } }).TowerAds !== 'undefined') {
            tracker.start();
            const TowerAdsClass = (window as unknown as { TowerAds: new (opts: Record<string, unknown>) => { loadAndShow: () => Promise<void> } }).TowerAds;
            const ads = new TowerAdsClass({
              apiKey: '2bc95b5bc8910b981e62ae629e056cc8',
              placementId: 'plc_2a9a008268fa8fdc',
              onRewardEarned: () => finish(true, minWatchSeconds + 1),
              onError: () => finish(false, 0),
            });
            ads.loadAndShow().catch(() => finish(true, 0));
            setTimeout(() => finish(true, 0), (minWatchSeconds + 10) * 1000);
          } else {
            finish(false, 0);
          }
        } catch {
          finish(false, 0);
        }
        return;
      }

      // ── Unknown provider — NO instant reward, ad must actually play ────────
      resolve({ opened: false, closed: true, watchTimeSeconds: 0 });
    });
  }, [adsgramReady, getMinWatchTime, trackWatchTime]);

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

  // showRandomAd is used by RewardCodePage — must NOT return success if no ad plays
  const showRandomAd = useCallback(async (): Promise<{ success: boolean; network: string }> => {
    // Try Adsgram first
    if (adsgramReady()) {
      try {
        const controller = window.Adsgram!.init({ blockId: 'int-36139' });
        const result = await controller.show();
        if (result.done && !result.error) {
          return { success: true, network: 'adsgram' };
        }
        // Ad played but user closed early — treat as failure
        return { success: false, network: 'adsgram' };
      } catch {
        // Adsgram failed — try fallback providers below
      }
    }

    // Try Gigapub as fallback
    if (typeof window !== 'undefined' && typeof window.showGiga === 'function') {
      const tracker = trackWatchTime();
      return new Promise((resolve) => {
        let resolved = false;
        const finish = (opened: boolean) => {
          if (resolved) return;
          resolved = true;
          const watched = tracker.stop();
          resolve({ success: opened && watched >= UNIVERSAL_MIN_WATCH_SECONDS, network: opened ? 'gigapub' : 'none' });
        };
        try {
          tracker.start();
          const gigaResult = window.showGiga!();
          const p = gigaResult as unknown as Promise<unknown> | undefined;
          if (p && typeof p.then === 'function') {
            p.then(() => finish(true)).catch(() => finish(false));
          } else {
            setTimeout(() => finish(true), (UNIVERSAL_MIN_WATCH_SECONDS + 2) * 1000);
          }
        } catch {
          finish(false);
        }
      });
    }

    // Try Monetag as fallback
    if (typeof window !== 'undefined' && typeof window.show_11196790 === 'function') {
      const tracker = trackWatchTime();
      return new Promise((resolve) => {
        let resolved = false;
        const finish = (opened: boolean) => {
          if (resolved) return;
          resolved = true;
          const watched = tracker.stop();
          resolve({ success: opened && watched >= UNIVERSAL_MIN_WATCH_SECONDS, network: opened ? 'monetag' : 'none' });
        };
        try {
          tracker.start();
          window.show_11196790!();
          setTimeout(() => finish(true), (UNIVERSAL_MIN_WATCH_SECONDS + 5) * 1000);
        } catch {
          finish(false);
        }
      });
    }

    // No ad provider available — return failure, NO reward
    return { success: false, network: 'none' };
  }, [adsgramReady, trackWatchTime]);

  return {
    showAutoAd,
    showRewardAd,
    showRandomAd,
    startAdWithTimer,
    adsgramReady,
    getMinWatchTime
  };
}
