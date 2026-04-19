/**
 * src/lib/os-config.js
 * Fonte única de verdade para cores, labels e configurações de OS.
 * Importar deste arquivo em todos os componentes que exibem OS.
 */

// ─── Status ────────────────────────────────────────────────────────────────────
// Cada status tem duas variantes de cor:
//   dark  → app interno (fundo escuro)
//   light → uso geral / badges inline

export const OS_STATUS = {
  aberta: {
    label:     'Aberta',
    // dark theme
    color:     '#60a5fa',
    bg:        'rgba(59,130,246,0.12)',
    border:    'rgba(59,130,246,0.3)',
    darkBg:    '#1e3a5f22',
    darkColor: '#3b82f6',
    // semáforo
    dot: '#3b82f6',
  },
  agendada: {
    label:     'Agendada',
    color:     '#fbbf24',
    bg:        'rgba(245,158,11,0.12)',
    border:    'rgba(245,158,11,0.3)',
    darkBg:    '#2e1b4e22',
    darkColor: '#a78bfa',
    dot: '#f59e0b',
  },
  em_andamento: {
    label:     'Em andamento',
    color:     '#c084fc',
    bg:        'rgba(168,85,247,0.12)',
    border:    'rgba(168,85,247,0.3)',
    darkBg:    '#2d1b4522',
    darkColor: '#a855f7',
    dot: '#a855f7',
  },
  concluida: {
    label:     'Concluída',
    color:     '#4ade80',
    bg:        'rgba(34,197,94,0.12)',
    border:    'rgba(34,197,94,0.3)',
    darkBg:    '#052e1622',
    darkColor: '#22c55e',
    dot: '#22c55e',
  },
  cancelada: {
    label:     'Cancelada',
    color:     '#f87171',
    bg:        'rgba(239,68,68,0.1)',
    border:    'rgba(239,68,68,0.3)',
    darkBg:    '#450a0a22',
    darkColor: '#ef4444',
    dot: '#ef4444',
  },
}

/** Retorna config de status com fallback seguro */
export function getStatusCfg(status) {
  return OS_STATUS[status] ?? OS_STATUS.aberta
}

// ─── Tipo ──────────────────────────────────────────────────────────────────────

export const OS_TIPO = {
  instalacao:   { label: 'Instalação',   icon: '📶', color: '#22c55e' },
  manutencao:   { label: 'Manutenção',   icon: '🔧', color: '#f59e0b' },
  suporte:      { label: 'Suporte',      icon: '💬', color: '#3b82f6' },
  cancelamento: { label: 'Cancelamento', icon: '✕',  color: '#ef4444' },
}

export function getTipoCfg(tipo) {
  return OS_TIPO[tipo] ?? { label: tipo ?? 'OS', icon: '📋', color: '#94a3b8' }
}

// ─── Prioridade ────────────────────────────────────────────────────────────────

export const OS_PRIORIDADE = {
  baixa:   { label: 'Baixa',   color: '#6b7280', strip: 'transparent' },
  normal:  { label: 'Normal',  color: '#94a3b8', strip: 'transparent' },
  alta:    { label: 'Alta',    color: '#f59e0b', strip: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#ef4444', strip: '#ef4444' },
}

export function getPrioCfg(prioridade) {
  return OS_PRIORIDADE[prioridade] ?? OS_PRIORIDADE.normal
}

// ─── Filtros rápidos ───────────────────────────────────────────────────────────

export const OS_STATUS_FILTERS = [
  { key: 'todas',        label: 'Todas' },
  { key: 'aberta',       label: 'Abertas' },
  { key: 'agendada',     label: 'Agendadas' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'concluida',    label: 'Concluídas' },
  { key: 'cancelada',    label: 'Canceladas' },
]

// ─── Permissões por role ───────────────────────────────────────────────────────
// Quais roles podem acessar a view "Minhas OS" (admin/all-OS view)
export const OS_ADMIN_ROLES = ['superadmin', 'admin', 'noc', 'recepcao']

// Quais roles podem ver OS (inclui tecnico — via view própria)
export const OS_VIEW_ROLES  = ['superadmin', 'admin', 'tecnico', 'noc', 'recepcao']
