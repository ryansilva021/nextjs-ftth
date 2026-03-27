import { useMemo } from 'react'

// Role rank — higher = more access
const ROLE_RANK = { superadmin: 4, admin: 3, tecnico: 2, noc: 2, user: 1 }

/**
 * Returns permission flags derived from the given role string.
 *
 * Roles:
 *   superadmin — full system access
 *   admin      — full tenant access
 *   noc        — monitoring + OLT commands, no topology edits or deletes
 *   tecnico    — field work, ONU provisioning, no admin actions
 *   user       — read-only view
 *
 * @param {string} role - 'superadmin' | 'admin' | 'noc' | 'tecnico' | 'user'
 * @returns {object} Permission flags
 */
export function usePermissions(role) {
  return useMemo(() => {
    const rank        = ROLE_RANK[role] ?? 0
    const isAdmin     = rank >= 3
    const isNoc       = role === 'noc'
    const isTecnico   = role === 'tecnico'
    const isSuperAdmin = role === 'superadmin'

    return {
      // ── Legacy flags (backwards compat) ──────────────────────────────────
      canEdit:      isAdmin,
      canViewField: rank >= 2,
      isAdmin,
      isTecnico,
      isNoc,
      isSuperAdmin,
      role: role ?? 'user',

      // ── Granular RBAC permissions ─────────────────────────────────────────

      // Map & topology
      view_map:        rank >= 1,
      edit_topology:   isAdmin,
      delete_topology: isAdmin,

      // Client / ONU management
      create_client:   rank >= 2,               // tecnico, noc, admin, superadmin
      delete_client:   isAdmin,
      provision_onu:   isAdmin || isNoc || isTecnico,

      // NOC & OLT
      access_noc:      isAdmin || isNoc,
      run_olt_commands: isAdmin || isNoc,
      view_olt:        rank >= 2,
      view_alarms:     isAdmin || isNoc,
      view_signal:     rank >= 2,

      // User management
      manage_users:    isAdmin,
    }
  }, [role])
}
