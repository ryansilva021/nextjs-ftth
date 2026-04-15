/**
 * src/lib/permissions.js
 * Sistema central de RBAC para FiberOps.
 *
 * Uso em qualquer componente (client ou server) ou action:
 *   import { hasPermission, PERM } from '@/lib/permissions'
 *   if (hasPermission(role, PERM.ACCESS_NOC)) { ... }
 *
 * Para listas de roles em server actions:
 *   import { getRolesWithPermission, PERM } from '@/lib/permissions'
 *   await requireActiveEmpresa(getRolesWithPermission(PERM.VIEW_SERVICE_ORDERS))
 */

// ── Permissões disponíveis ──────────────────────────────────────────────────

export const PERM = {
  // Mapa e visualização
  VIEW_MAP:              'view_map',

  // Topologia de rede
  VIEW_TOPOLOGY:         'view_topology',
  EDIT_TOPOLOGY:         'edit_topology',

  // Fusões / Diagramas
  VIEW_FUSIONS:          'view_fusions',
  EDIT_FUSIONS:          'edit_fusions',

  // Campo / técnico
  VIEW_FIELD:            'view_field',
  VIEW_CALCULATIONS:     'view_calculations',

  // NOC / OLT / ONU
  ACCESS_NOC:            'access_noc',
  VIEW_OLT:              'view_olt',
  RUN_OLT_COMMANDS:      'run_olt_commands',
  VIEW_ONUS:             'view_onus',

  // Ordens de Serviço
  VIEW_SERVICE_ORDERS:   'view_service_orders',
  CREATE_SERVICE_ORDER:  'create_service_order',
  EXECUTE_SERVICE_ORDER: 'execute_service_order',

  // Clientes / dados de campo
  VIEW_CLIENTS:          'view_clients',
  EDIT_CLIENTS:          'edit_clients',

  // Administração
  MANAGE_USERS:          'manage_users',
  VIEW_IMPORT:           'view_import',
  VIEW_LOGS:             'view_logs',
}

// ── Mapa de permissões por role ─────────────────────────────────────────────

const ALL_PERMS = Object.values(PERM)

export const ROLE_PERMISSIONS = {
  superadmin: ALL_PERMS,

  admin: ALL_PERMS,

  tecnico: [
    PERM.VIEW_MAP,
    PERM.VIEW_TOPOLOGY,
    PERM.VIEW_FUSIONS,
    PERM.VIEW_CALCULATIONS,
    PERM.VIEW_SERVICE_ORDERS,
    PERM.EXECUTE_SERVICE_ORDER,
    PERM.VIEW_CLIENTS,
  ],

  noc: [
    PERM.VIEW_MAP,
    PERM.VIEW_TOPOLOGY,
    PERM.VIEW_FUSIONS,
    PERM.ACCESS_NOC,
    PERM.VIEW_OLT,
    PERM.RUN_OLT_COMMANDS,
    PERM.VIEW_ONUS,
    PERM.VIEW_SERVICE_ORDERS,
  ],

  recepcao: [
    PERM.VIEW_MAP,
    PERM.VIEW_SERVICE_ORDERS,
    PERM.CREATE_SERVICE_ORDER,
    PERM.VIEW_CLIENTS,
    PERM.EDIT_CLIENTS,
  ],

  user: [
    PERM.VIEW_MAP,
  ],
}

// ── Funções utilitárias ─────────────────────────────────────────────────────

/**
 * Verifica se um role possui uma permissão específica.
 * @param {string} role
 * @param {string} permission  — usar constantes PERM.*
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}

/**
 * Retorna array de roles que têm a permissão especificada.
 * Útil para montar allowedRoles em server actions / requireActiveEmpresa.
 *
 * @param {string} permission
 * @returns {string[]}
 *
 * @example
 *   await requireActiveEmpresa(getRolesWithPermission(PERM.VIEW_SERVICE_ORDERS))
 */
export function getRolesWithPermission(permission) {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.includes(permission))
    .map(([role]) => role)
}

// ── Labels e cores por role ─────────────────────────────────────────────────

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin:      'Administrador',
  tecnico:    'Técnico',
  noc:        'NOC',
  recepcao:   'Recepção',
  user:       'Usuário',
}

export const ROLE_COLORS = {
  superadmin: { bg: '#2e1065', color: '#c4b5fd', border: '#7c3aed44' },
  admin:      { bg: '#0c2340', color: '#38bdf8', border: '#0284c744' },
  tecnico:    { bg: '#052e16', color: '#4ade80', border: '#16a34a44' },
  noc:        { bg: '#1a1a2e', color: '#818cf8', border: '#6366f144' },
  recepcao:   { bg: '#2d1a12', color: '#fb923c', border: '#f9731644' },
  user:       { bg: '#1c1917', color: '#a8a29e', border: '#78716c44' },
}

// ── Mapa de rotas → permissão necessária ───────────────────────────────────
// Usado pelo middleware e pelo controle de acesso nas páginas

export const ROUTE_PERMISSIONS = {
  '/admin/campo':       PERM.VIEW_FIELD,
  '/admin/diagramas':   PERM.VIEW_FUSIONS,
  '/admin/topologia':   PERM.VIEW_TOPOLOGY,
  '/admin/calculos':    PERM.VIEW_CALCULATIONS,
  '/admin/os':          PERM.VIEW_SERVICE_ORDERS,
  '/admin/usuarios':    PERM.MANAGE_USERS,
  '/admin/importar':    PERM.VIEW_IMPORT,
  '/admin/logs':        PERM.VIEW_LOGS,
  '/admin/olts':        PERM.VIEW_OLT,
}
