import { useCallback, useEffect, useState } from 'react';
import type { NavTabId } from '../core';

export type AppRoute =
  | { page: 'dashboard'; tab: NavTabId }
  | { page: 'accounts'; tab: NavTabId }
  | { page: 'account_flow'; tab: NavTabId; accountId: string }
  | { page: 'village_detail'; tab: NavTabId; villageId: string }
  | { page: 'planner'; tab: NavTabId }
  | { page: 'reports'; tab: NavTabId }
  | { page: 'settings'; tab: NavTabId }
  | { page: 'not_found'; tab: NavTabId; rawPath: string };

export function parseRoutePath(pathname: string): AppRoute {
  const clean = String(pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';

  if (clean === '/' || clean === '/dashboard') {
    return { page: 'dashboard', tab: 'dashboard' };
  }
  if (clean === '/accounts') {
    return { page: 'accounts', tab: 'accounts' };
  }
  if (clean.startsWith('/accounts/')) {
    const rawId = clean.slice('/accounts/'.length).split('/')[0];
    if (rawId) {
      return {
        page: 'account_flow',
        tab: 'accounts',
        accountId: decodeURIComponent(rawId)
      };
    }
  }
  if (clean.startsWith('/villages/')) {
    const rawId = clean.slice('/villages/'.length).split('/')[0];
    if (rawId) {
      return {
        page: 'village_detail',
        tab: 'dashboard',
        villageId: decodeURIComponent(rawId)
      };
    }
  }
  if (clean === '/planner') {
    return { page: 'planner', tab: 'planner' };
  }
  if (clean === '/reports') {
    return { page: 'reports', tab: 'reports' };
  }
  if (clean === '/settings') {
    return { page: 'settings', tab: 'settings' };
  }
  return { page: 'not_found', tab: 'dashboard', rawPath: clean };
}

export function buildRoutePath(route: AppRoute): string {
  switch (route.page) {
    case 'dashboard':
      return '/dashboard';
    case 'accounts':
      return '/accounts';
    case 'account_flow':
      return `/accounts/${encodeURIComponent(route.accountId)}`;
    case 'village_detail':
      return `/villages/${encodeURIComponent(route.villageId)}`;
    case 'planner':
      return '/planner';
    case 'reports':
      return '/reports';
    case 'settings':
      return '/settings';
    case 'not_found':
      return route.rawPath || '/';
  }
}

export function useAppRouter() {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [search, setSearch] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.search : ''
  );

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const raw = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
    const qIdx = raw.indexOf('?');
    const nextPathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    const nextSearch = qIdx >= 0 ? raw.slice(qIdx) : '';
    const fullTarget = `${nextPathname}${nextSearch}`;

    if (
      typeof window !== 'undefined' &&
      `${window.location.pathname}${window.location.search}` !== fullTarget
    ) {
      window.history.pushState({}, '', fullTarget);
    }
    setPathname(nextPathname);
    setSearch(nextSearch);
  }, []);

  const route = parseRoutePath(pathname);

  return { route, pathname, search, navigate };
}
