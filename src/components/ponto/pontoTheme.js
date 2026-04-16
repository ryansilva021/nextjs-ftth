// Tema compartilhado entre todos os componentes do módulo Ponto
export const T = {
  canvas:  '#1a1510',
  card:    '#231c13',
  card2:   '#2a2015',
  border:  '#3a2e20',
  accent:  '#D4622B',
  text:    '#f0e4d0',
  muted:   '#c8a878',
  dim:     '#7a6050',
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  ff:      "'Inter','Segoe UI',system-ui,sans-serif",
}

// Input / Select / Textarea style base
export function inputStyle(T, extra = {}) {
  return {
    width: '100%',
    background: T.card2,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    color: T.text,
    fontFamily: T.ff,
    outline: 'none',
    ...extra,
  }
}

// Label style
export function labelStyle(T) {
  return { fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 6, display: 'block' }
}

// Primary button
export function primaryBtn(T, disabled = false) {
  return {
    width: '100%', padding: '16px', borderRadius: 12,
    background: T.accent, color: '#fff', border: 'none',
    fontSize: 15, fontWeight: 700, fontFamily: T.ff,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    boxShadow: disabled ? 'none' : `0 4px 16px rgba(212,98,43,0.35)`,
    letterSpacing: '0.02em',
  }
}

// Section card
export function cardStyle(T) {
  return {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  }
}
