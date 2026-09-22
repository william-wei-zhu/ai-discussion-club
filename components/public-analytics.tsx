'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { publicAnalyticsPath, safePageview } from '@/lib/analytics-privacy';
import type { PostHog } from 'posthog-js';

let client: PostHog | undefined;
let loading: Promise<PostHog> | undefined;
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let marker = '';
let anonymousId = '';

async function analytics(): Promise<PostHog> {
  if (client) return client;
  if (loading) return loading;
  loading = import('posthog-js').then(({ default: posthog }) => {
    marker = crypto.randomUUID();
    // Runtime RequestInit values are forwarded by the installed SDK. The SDK's
    // narrow fetch_options type omits referrerPolicy, so use a typed variable.
    const fetchOptions: RequestInit = { cache: 'no-store', referrerPolicy: 'no-referrer' };
    posthog.init(key!, {
      api_host: 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      enable_recording_console_log: false,
      disable_surveys: true,
      disable_product_tours: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      advanced_disable_feature_flags: true,
      advanced_disable_feature_flags_on_first_load: true,
      person_profiles: 'never',
      disable_persistence: true,
      persistence: 'memory',
      save_referrer: false,
      save_campaign_params: false,
      ip: false,
      respect_dnt: true,
      request_batching: false,
      disable_beacon: true,
      api_transport: 'fetch',
      fetch_options: fetchOptions,
      before_send: (event) => {
        if (!event) return null;
        const safe = safePageview(event, { currentPath: window.location.pathname, marker, key: key!, anonymousId });
        return safe ? { uuid: crypto.randomUUID(), ...safe } : null;
      },
    });
    client = posthog;
    return posthog;
  });
  return loading;
}

export function PublicAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    const path = publicAnalyticsPath(pathname);
    if (!key || !path) return;
    let cancelled = false;
    void analytics().then((posthog) => {
      if (cancelled || window.location.pathname !== path) return;
      anonymousId = crypto.randomUUID();
      posthog.capture('$pageview', { public_path: path, club_pageview: marker });
    }).catch(() => { /* Analytics must never affect the page. */ });
    return () => { cancelled = true; };
  }, [pathname]);
  return null;
}
