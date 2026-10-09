/**
 * Version shown on the For grown-ups page.
 * The build (scripts/build.mjs) replaces __APP_VERSION__ with the version in package.json.
 * When running from source it shows "dev".
 */
/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
