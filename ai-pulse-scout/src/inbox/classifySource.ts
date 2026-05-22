import { URL } from 'node:url';
import type { ClassifiedSource } from './types.js';

export function classifySource(rawUrl: string): ClassifiedSource {
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname;

  if (host.includes('youtube.com')) {
    return {
      kind: 'youtube',
      strategy: 'youtube_channel_resolution',
      platform: 'youtube',
      rationale: 'YouTube handle/channel URL requires channel resolution before item fetch.',
      traversable: true,
    };
  }

  if (host === 'github.com') {
    return {
      kind: 'github',
      strategy: 'github_release_feed',
      platform: 'github',
      rationale: 'GitHub repo URLs can be resolved to releases.atom or activity endpoints.',
      traversable: true,
    };
  }

  if (host === 'x.com' || host === 'twitter.com') {
    return {
      kind: 'x',
      strategy: 'x_profile_fetch',
      platform: 'x',
      rationale: 'X profile requires dedicated retrieval adapter or API-backed fetch.',
      traversable: true,
    };
  }

  if (host.includes('linkedin.com')) {
    return {
      kind: 'linkedin',
      strategy: 'social_profile_deferred',
      platform: 'linkedin',
      rationale: 'LinkedIn profile pages are auth-gated and should be removed if unreadable.',
      traversable: false,
    };
  }

  if (host.includes('facebook.com')) {
    return {
      kind: 'facebook',
      strategy: 'social_profile_deferred',
      platform: 'facebook',
      rationale: 'Facebook profile pages are auth-gated and should be removed if unreadable.',
      traversable: false,
    };
  }

  if (host.includes('arxiv.org') || host.includes('paperswithcode.com') || path.includes('/research')) {
    return {
      kind: 'research_listing',
      strategy: 'research_listing_discovery',
      platform: host,
      rationale: 'Research listings need discovery from listing pages or known feeds.',
      traversable: true,
    };
  }

  return {
    kind: 'generic_web',
    strategy: 'generic_web_discovery',
    platform: host,
    rationale: 'Default website/article discovery strategy.',
    traversable: true,
  };
}
