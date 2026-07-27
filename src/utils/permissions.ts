/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '../types';

// These two tabs both route to the Configuration/AdminSettings screen (KPI referentials, user
// management, SQL connector, audit log) — always admin-only, never grantable via `permissions`.
export const ADMIN_ONLY_TABS = ['admin', 'db-sync'];

export function hasModuleAccess(user: User, tabId: string): boolean {
  if (user.accessLevel === 'admin') return true;
  if (ADMIN_ONLY_TABS.includes(tabId)) return false;
  return user.permissions?.[tabId as keyof typeof user.permissions] ?? true;
}
