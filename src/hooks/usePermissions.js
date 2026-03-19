import { useMemo } from 'react'

const ROLE_RANK = { superadmin: 4, admin: 3, tecnico: 2, user: 1 }

/**
 * Returns permission flags derived from the given role string.
 *
 * @param {string} role - 'superadmin' | 'admin' | 'tecnico' | 'user'
 * @returns {{
 *   canEdit:      boolean,
 *   canViewField: boolean,
 *   isAdmin:      boolean,
 *   isTecnico:    boolean,
 *   isSuperAdmin: boolean,
 *   role:         string,
 * }}
 *
 * @example
 * const { canEdit, canViewField } = usePermissions(session.user.role)
 */
export function usePermissions(role) {
  return useMemo(() => {
    const rank = ROLE_RANK[role] ?? 0
    return {
      canEdit:      rank >= 3,   // admin, superadmin
      canViewField: rank >= 2,   // tecnico, admin, superadmin
      isAdmin:      rank >= 3,
      isTecnico:    role === 'tecnico',
      isSuperAdmin: role === 'superadmin',
      role:         role ?? 'user',
    }
  }, [role])
}
