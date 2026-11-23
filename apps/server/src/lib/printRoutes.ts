/**
 * Boot diagnostics: the mounted-route manifest. createApp records every
 * mounted router; index.ts prints the table at boot (smoke-check output).
 */
import type { Router } from 'express';

export interface RouteInfo {
  methods: string[];
  path: string;
}

interface StackLayer {
  route?: { path?: string | RegExp; methods?: Record<string, boolean> };
}

/** Flattens one router's route layers (routers here are flat by design). */
export function collectRoutes(prefix: string, router: Router): RouteInfo[] {
  const out: RouteInfo[] = [];
  const stack = (router as unknown as { stack?: ReadonlyArray<StackLayer> }).stack ?? [];
  for (const layer of stack) {
    const route = layer.route;
    if (route && typeof route.path === 'string' && route.methods) {
      const methods = Object.keys(route.methods)
        .filter((m) => m !== '_middleware') // route.all layers register every verb; we don't use route.all
        .map((m) => m.toUpperCase())
        .sort();
      const suffix = route.path === '/' ? '' : route.path;
      out.push({ methods: methods.length > 0 ? methods : ['ALL'], path: `${prefix}${suffix}` });
    }
  }
  return out;
}

export function printRoutes(routes: ReadonlyArray<RouteInfo>): void {
  console.log('[boot] mounted routes:');
  for (const route of routes) {
    console.log(`  ${route.methods.join(',').padEnd(18)} ${route.path}`);
  }
}
