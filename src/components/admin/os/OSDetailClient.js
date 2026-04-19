'use client'

/**
 * OSDetailClient.js
 * Componente principal de detalhes de OS — todos os sub-componentes inline.
 * Dark ISP theme, mobile-first, sem Tailwind, sem TypeScript.
 */

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import {
  addMaterial, removeMaterial, addHistorico,
  updateConexao, updatePlano, updateLocalizacao,
  addFoto, removeFoto, simularStatusConexao,
} from '@/actions/service-orders'

// ─── Global keyframes ──────────────────────────────────────────────────────────

const GLOBAL_STYLES = `
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }
@keyframes fadeInDown {
  from { opacity:0; transform:translateY(-10px) }
  to   { opacity:1; transform:translateY(0) }
}
@keyframes fadeInUp {
  from { opacity:0; transform:translateY(8px) }
  to   { opacity:1; transform:translateY(0) }
}
@keyframes slideIn {
  from { opacity:0; transform:translateX(20px) }
  to   { opacity:1; transform:translateX(0) }
}
.os-detail-tab-btn:hover { background: #ffffff14 !important; }
.os-copy-btn:hover { background: #1d4ed844 !important; color: #93c5fd !important; }
.os-action-btn:hover { opacity: 0.85 !important; }
.os-material-row:hover { background: #ffffff08 !important; }
`

import { getStatusCfg, getTipoCfg } from '@/lib/os-config'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TIPO_META = {
  instalacao:   { label: 'Instalação',   icon: '📶', color: '#22c55e' },
  manutencao:   { label: 'Manutenção',   icon: '🔧', color: '#f59e0b' },
  suporte:      { label: 'Suporte',      icon: '💬', color: '#3b82f6' },
  cancelamento: { label: 'Cancelamento', icon: '✕',  color: '#ef4444' },
}

const PRIO_META = {
  baixa:   { label: 'Baixa',   color: '#6b7280' },
  normal:  { label: 'Normal',  color: '#94a3b8' },
  alta:    { label: 'Alta',    color: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#ef4444' },
}

const STATUS_STEPS = ['aberta', 'agendada', 'em_andamento', 'concluida']

const HIST_COLORS = ['#3b82f6', '#a78bfa', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6']

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtBytes(b) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function histColor(idx) {
  return HIST_COLORS[idx % HIST_COLORS.length]
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 14 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      border: '2px solid #ffffff22', borderTopColor: '#60a5fa',
      animation: 'spin 0.7s linear infinite',
      display: 'inline-block', flexShrink: 0,
    }} />
  )
}

// ─── Toast hook ────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])
  return { toast, show }
}

function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      padding: '12px 20px', borderRadius: 8,
      backgroundColor: isErr ? '#450a0a' : '#052e16',
      border: `1px solid ${isErr ? '#7f1d1d' : '#14532d'}`,
      color: isErr ? '#fca5a5' : '#86efac',
      fontSize: 13, fontWeight: 600,
      animation: 'fadeInDown 0.2s ease',
      boxShadow: '0 4px 24px #00000066',
      maxWidth: 360,
    }}>
      {toast.msg}
    </div>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────────

function OSHeader({ os }) {
  const sm = { color: getStatusCfg(os.status).darkColor, bg: getStatusCfg(os.status).darkBg }
  const tm = TIPO_META[os.tipo] ?? TIPO_META.suporte
  const pm = PRIO_META[os.prioridade] ?? PRIO_META.normal

  return (
    <div style={{
      backgroundColor: '#050f1f',
      borderBottom: '1px solid var(--border-color)',
      padding: '16px 24px',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <a
          href="/admin/os"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6,
            backgroundColor: '#ffffff0d', border: '1px solid var(--border-color)',
            color: 'var(--text-muted)', fontSize: 11, textDecoration: 'none',
            fontWeight: 600, letterSpacing: '0.02em',
          }}
        >
          ← OS
        </a>

        {/* OS ID */}
        <span style={{
          fontFamily: 'monospace', fontSize: 16, fontWeight: 700,
          color: 'var(--foreground)', letterSpacing: '0.04em',
        }}>
          {os.os_id}
        </span>

        {/* Tipo badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 10px', borderRadius: 99,
          backgroundColor: `${tm.color}18`, border: `1px solid ${tm.color}44`,
          color: tm.color, fontSize: 11, fontWeight: 700,
        }}>
          {tm.icon} {tm.label}
        </span>

        {/* Status badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '3px 10px', borderRadius: 99,
          backgroundColor: sm.bg, border: `1px solid ${sm.color}44`,
          color: sm.color, fontSize: 11, fontWeight: 700,
        }}>
          {sm.label}
        </span>

        {/* Prioridade strip */}
        {(os.prioridade === 'alta' || os.prioridade === 'urgente') && (
          <span style={{
            padding: '3px 10px', borderRadius: 99,
            backgroundColor: `${pm.color}18`, border: `1px solid ${pm.color}44`,
            color: pm.color, fontSize: 11, fontWeight: 700,
          }}>
            {pm.label}
          </span>
        )}
      </div>

      {/* Client info row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
          {os.cliente_nome ?? '—'}
        </span>
        {os.cliente_contato && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {os.cliente_contato}
          </span>
        )}
        {os.cliente_endereco && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {os.cliente_endereco}
          </span>
        )}
        {os.tecnico_nome && (
          <span style={{
            fontSize: 11, color: '#60a5fa',
            padding: '2px 8px', borderRadius: 4,
            backgroundColor: '#1d4ed818', border: '1px solid #1d4ed844',
          }}>
            Tec: {os.tecnico_nome}
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Aberta {fmtDate(os.data_abertura)}
          {os.data_agendamento && ` · Agendada ${fmtDate(os.data_agendamento)}`}
        </span>
      </div>
    </div>
  )
}

// ─── Status Stepper ────────────────────────────────────────────────────────────

function StatusStepper({ currentStatus }) {
  const stepIdx = STATUS_STEPS.indexOf(currentStatus)
  const isCancelled = currentStatus === 'cancelada'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '12px 24px',
      backgroundColor: '#0a1628', borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto', gap: 0,
    }}>
      {STATUS_STEPS.map((step, idx) => {
        const meta = { color: getStatusCfg(step).darkColor, bg: getStatusCfg(step).darkBg }
        const isDone = isCancelled ? false : idx < stepIdx
        const isCurrent = !isCancelled && idx === stepIdx
        const isFuture = isCancelled ? true : idx > stepIdx

        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* Step dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: isCurrent ? 28 : 20, height: isCurrent ? 28 : 20,
                borderRadius: '50%',
                backgroundColor: isDone ? meta.color
                  : isCurrent ? meta.color
                  : '#1e293b',
                border: isCurrent ? `3px solid ${meta.color}88` : `2px solid ${isDone ? meta.color : '#334155'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: isCurrent ? `0 0 12px ${meta.color}66` : 'none',
              }}>
                {isDone && (
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>
                )}
                {isCurrent && (
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: '#fff',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                color: isCurrent ? meta.color : isDone ? meta.color : '#475569',
              }}>
                {meta.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < STATUS_STEPS.length - 1 && (
              <div style={{
                height: 2, width: 40, marginBottom: 16,
                backgroundColor: isDone ? getStatusCfg(STATUS_STEPS[idx]).darkColor : '#1e293b',
                transition: 'background-color 0.3s',
              }} />
            )}
          </div>
        )
      })}

      {isCancelled && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-start', paddingBottom: 16 }}>
          <span style={{
            padding: '3px 12px', borderRadius: 99,
            backgroundColor: '#450a0a22', border: '1px solid #ef444444',
            color: '#ef4444', fontSize: 11, fontWeight: 700,
          }}>
            Cancelada
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'conexao',   label: 'Conexão',   icon: '🌐' },
  { id: 'materiais', label: 'Materiais', icon: '📦' },
  { id: 'fotos',     label: 'Fotos',     icon: '📷' },
  { id: 'historico', label: 'Histórico', icon: '📋' },
]

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 2, padding: '8px 24px',
      backgroundColor: '#050f1f', borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto',
    }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="os-detail-tab-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 7, cursor: 'pointer',
            border: 'none',
            backgroundColor: active === tab.id ? '#1d4ed822' : 'transparent',
            color: active === tab.id ? '#60a5fa' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600,
            borderBottom: active === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    if (!value) return
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className="os-copy-btn"
      style={{
        padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
        border: '1px solid var(--border-color)',
        backgroundColor: '#ffffff08',
        color: copied ? '#4ade80' : 'var(--text-muted)',
        fontSize: 10, fontWeight: 600,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? 'Copiado!' : '⎘'}
    </button>
  )
}

// ─── Connection info row ────────────────────────────────────────────────────────

function InfoRow({ label, value, masked, secret }) {
  const [revealed, setRevealed] = useState(false)
  const displayValue = masked && !revealed ? '••••••••' : (value ?? '—')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 6,
      backgroundColor: '#0d1b2e', border: '1px solid var(--border-color)',
      gap: 8,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, minWidth: 80 }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, color: value ? 'var(--foreground)' : '#475569',
        fontFamily: value ? 'monospace' : 'inherit',
        flexGrow: 1, wordBreak: 'break-all',
      }}>
        {displayValue}
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {masked && value && (
          <button
            onClick={() => setRevealed(r => !r)}
            title={revealed ? 'Ocultar' : 'Revelar'}
            className="os-copy-btn"
            style={{
              padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff08', color: 'var(--text-muted)',
              fontSize: 10, fontWeight: 600,
            }}
          >
            {revealed ? '🙈' : '👁'}
          </button>
        )}
        {value && <CopyBtn value={value} />}
      </div>
    </div>
  )
}

// ─── Connection Status Dot ──────────────────────────────────────────────────────

function ConnectionStatusDot({ status, osId, onUpdate }) {
  const [pending, startTransition] = useTransition()
  const isOnline = status === 'ONLINE'

  function handleSimulate() {
    startTransition(async () => {
      try {
        const updated = await simularStatusConexao(osId)
        if (onUpdate) onUpdate(updated)
      } catch {}
    })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 8,
      backgroundColor: isOnline ? '#052e1644' : '#450a0a44',
      border: `1px solid ${isOnline ? '#22c55e44' : '#ef444444'}`,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        backgroundColor: isOnline ? '#22c55e' : '#ef4444',
        animation: isOnline ? 'pulse 2s infinite' : 'none',
        boxShadow: isOnline ? '0 0 8px #22c55e88' : 'none',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: isOnline ? '#22c55e' : '#ef4444',
      }}>
        {status ? status : 'Desconhecido'}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexGrow: 1 }}>
        {isOnline ? 'Conexão ativa' : 'Sem sinal detectado'}
      </span>
      <button
        onClick={handleSimulate}
        disabled={pending}
        title="Simular verificação de status"
        style={{
          padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
          border: '1px solid var(--border-color)',
          backgroundColor: '#ffffff08', color: 'var(--text-muted)',
          fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {pending ? <Spinner size={10} /> : '↻'} Atualizar
      </button>
    </div>
  )
}

// ─── Tab Conexão ───────────────────────────────────────────────────────────────

function TabConexao({ os, onOsUpdate, userRole }) {
  const { toast, show } = useToast()
  const [pending, startTransition] = useTransition()
  const conexao = os.conexao ?? {}
  const plano   = os.plano   ?? {}
  const loc     = os.localizacao ?? {}

  const canEdit = ['superadmin', 'admin', 'tecnico'].includes(userRole)

  // Inline edit state
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    login:     conexao.login     ?? '',
    senha:     conexao.senha     ?? '',
    ip:        conexao.ip        ?? '',
    mac:       conexao.mac       ?? '',
    onu_id:    conexao.onu_id    ?? '',
    slot:      conexao.slot      ?? '',
    pon_porta: conexao.pon_porta ?? '',
  })

  const [editPlano, setEditPlano] = useState(false)
  const [planoForm, setPlanoForm] = useState({
    nome:     plano.nome     ?? '',
    download: plano.download ?? '',
    upload:   plano.upload   ?? '',
  })

  async function saveConexao() {
    startTransition(async () => {
      try {
        const updated = await updateConexao(os.os_id, form)
        onOsUpdate(updated)
        setEditing(false)
        show('Dados de conexão salvos!')
      } catch (err) {
        show(err.message, 'error')
      }
    })
  }

  async function savePlano() {
    startTransition(async () => {
      try {
        const updated = await updatePlano(os.os_id, planoForm)
        onOsUpdate(updated)
        setEditPlano(false)
        show('Plano atualizado!')
      } catch (err) {
        show(err.message, 'error')
      }
    })
  }

  const inputSt = {
    padding: '6px 10px', borderRadius: 5,
    border: '1px solid var(--border-color)',
    backgroundColor: '#0d1b2e', color: 'var(--foreground)',
    fontSize: 12, width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '20px 24px', animation: 'slideIn 0.2s ease' }}>
      <Toast toast={toast} />

      {/* Status online/offline */}
      <ConnectionStatusDot
        status={conexao.status}
        osId={os.os_id}
        onUpdate={onOsUpdate}
      />

      {/* Dados de conexão */}
      <div style={{
        marginTop: 16, backgroundColor: '#050f1f',
        border: '1px solid var(--border-color)', borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
          backgroundColor: '#0a1628',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Credenciais de Acesso
          </span>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                border: '1px solid var(--border-color)', backgroundColor: '#ffffff08',
                color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
              }}
            >
              Editar
            </button>
          )}
        </div>

        <div style={{ padding: 14, display: 'grid', gap: 6 }}>
          {editing ? (
            <>
              {[
                ['Login', 'login'],
                ['Senha', 'senha'],
                ['IP', 'ip'],
                ['MAC', 'mac'],
                ['ONU ID', 'onu_id'],
                ['Slot', 'slot'],
                ['PON Porta', 'pon_porta'],
              ].map(([lbl, key]) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{lbl}</span>
                  <input
                    style={inputSt}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={`${lbl}...`}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  onClick={saveConexao}
                  disabled={pending}
                  style={{
                    padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                    border: 'none', backgroundColor: '#1d4ed8',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {pending && <Spinner />} Salvar
                </button>
                <button
                  onClick={() => setEditing(false)}
                  style={{
                    padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                    color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <InfoRow label="Login"    value={conexao.login}     />
              <InfoRow label="Senha"    value={conexao.senha}     masked />
              <InfoRow label="IP"       value={conexao.ip}        />
              <InfoRow label="MAC"      value={conexao.mac}       />
              <InfoRow label="ONU ID"   value={conexao.onu_id}    />
              <InfoRow label="Slot"     value={conexao.slot}      />
              <InfoRow label="PON"      value={conexao.pon_porta} />
            </>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'Autorizar ONU', color: '#22c55e' },
          { label: 'MAC Automático', color: '#3b82f6' },
          { label: 'Acessar CPE', color: '#f59e0b' },
        ].map(btn => (
          <button
            key={btn.label}
            className="os-action-btn"
            onClick={() => show(`${btn.label} — funcionalidade em desenvolvimento`, 'error')}
            style={{
              padding: '7px 16px', borderRadius: 7, cursor: 'pointer',
              border: `1px solid ${btn.color}44`,
              backgroundColor: `${btn.color}14`,
              color: btn.color, fontSize: 12, fontWeight: 700,
              transition: 'opacity 0.15s',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Plano */}
      <div style={{
        marginTop: 16, backgroundColor: '#050f1f',
        border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
          backgroundColor: '#0a1628',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Plano Contratado
          </span>
          {canEdit && !editPlano && (
            <button
              onClick={() => setEditPlano(true)}
              style={{
                padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                border: '1px solid var(--border-color)', backgroundColor: '#ffffff08',
                color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
              }}
            >
              Editar
            </button>
          )}
        </div>
        <div style={{ padding: 14 }}>
          {editPlano ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['Nome', 'nome'], ['Download', 'download'], ['Upload', 'upload']].map(([lbl, key]) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{lbl}</span>
                  <input
                    style={inputSt}
                    value={planoForm[key]}
                    onChange={e => setPlanoForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={`${lbl}...`}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={savePlano}
                  disabled={pending}
                  style={{
                    padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                    border: 'none', backgroundColor: '#7c3aed',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {pending && <Spinner />} Salvar
                </button>
                <button
                  onClick={() => setEditPlano(false)}
                  style={{
                    padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                    color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Nome</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
                  {plano.nome || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, marginBottom: 2 }}>↓ Download</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{plano.download || '—'}</div>
                </div>
                <div style={{ width: 1, backgroundColor: 'var(--border-color)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginBottom: 2 }}>↑ Upload</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{plano.upload || '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geolocalização */}
      <div style={{
        marginTop: 16, backgroundColor: '#050f1f',
        border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
          backgroundColor: '#0a1628',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Geolocalização
          </span>
        </div>
        <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 13, color: 'var(--foreground)',
          }}>
            {loc.lat != null ? `${loc.lat.toFixed(6)}, ${loc.lng?.toFixed(6)}` : 'Não informada'}
          </span>
          {loc.lat != null && (
            <a
              href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 14px', borderRadius: 6,
                backgroundColor: '#0ea5e918', border: '1px solid #0ea5e944',
                color: '#38bdf8', fontSize: 12, fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Abrir no Maps ↗
            </a>
          )}
          {!loc.lat && canEdit && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Atualize via aplicativo de campo
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab Materiais ──────────────────────────────────────────────────────────────

function TabMateriais({ os, onOsUpdate, userRole }) {
  const { toast, show } = useToast()
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ nome: '', quantidade: 1, tipo: 'OS', valor: '' })

  const materiais = os.materiais ?? []
  const canDelete = ['superadmin', 'admin'].includes(userRole)
  const canAdd    = ['superadmin', 'admin', 'tecnico'].includes(userRole)

  const totalComodato = materiais
    .filter(m => m.tipo === 'COMODATO' && m.valor)
    .reduce((acc, m) => acc + (m.valor * m.quantidade), 0)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.nome.trim()) { show('Nome é obrigatório', 'error'); return }
    startTransition(async () => {
      try {
        const updated = await addMaterial(os.os_id, {
          nome:       form.nome,
          quantidade: Number(form.quantidade) || 1,
          tipo:       form.tipo,
          valor:      form.valor ? Number(form.valor) : null,
        })
        onOsUpdate(updated)
        setForm({ nome: '', quantidade: 1, tipo: 'OS', valor: '' })
        setShowAdd(false)
        show('Material adicionado!')
      } catch (err) {
        show(err.message, 'error')
      }
    })
  }

  async function handleRemove(materialId) {
    if (!confirm('Remover este material?')) return
    startTransition(async () => {
      try {
        const updated = await removeMaterial(os.os_id, materialId)
        onOsUpdate(updated)
        show('Material removido!')
      } catch (err) {
        show(err.message, 'error')
      }
    })
  }

  const inputSt = {
    padding: '6px 10px', borderRadius: 5,
    border: '1px solid var(--border-color)',
    backgroundColor: '#0d1b2e', color: 'var(--foreground)',
    fontSize: 12, boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '20px 24px', animation: 'slideIn 0.2s ease' }}>
      <Toast toast={toast} />

      {/* Summary */}
      {totalComodato > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          backgroundColor: '#f59e0b14', border: '1px solid #f59e0b44',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
            Total em Comodato:
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#f59e0b' }}>
            R$ {totalComodato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{
        backgroundColor: '#050f1f', border: '1px solid var(--border-color)',
        borderRadius: 8, overflow: 'hidden', marginBottom: 12,
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 60px 100px 80px 32px',
          padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
          backgroundColor: '#0a1628',
          fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <span>Material</span>
          <span style={{ textAlign: 'center' }}>Qtd</span>
          <span>Tipo</span>
          <span style={{ textAlign: 'right' }}>Valor</span>
          <span />
        </div>

        {materiais.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhum material registrado
          </div>
        ) : (
          materiais.map((m, i) => (
            <div
              key={m._id ?? i}
              className="os-material-row"
              style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 100px 80px 32px',
                padding: '9px 12px',
                borderBottom: i < materiais.length - 1 ? '1px solid var(--border-color)' : 'none',
                alignItems: 'center', transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500 }}>
                {m.nome}
              </span>
              <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--foreground)' }}>
                {m.quantidade}
              </span>
              <span>
                <span style={{
                  padding: '2px 8px', borderRadius: 99,
                  backgroundColor: m.tipo === 'COMODATO' ? '#f59e0b18' : '#3b82f618',
                  border: `1px solid ${m.tipo === 'COMODATO' ? '#f59e0b44' : '#3b82f644'}`,
                  color: m.tipo === 'COMODATO' ? '#f59e0b' : '#60a5fa',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {m.tipo}
                </span>
              </span>
              <span style={{ textAlign: 'right', fontSize: 12, color: m.valor ? '#f59e0b' : 'var(--text-muted)' }}>
                {m.valor ? `R$ ${Number(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
              </span>
              {canDelete ? (
                <button
                  onClick={() => handleRemove(m._id)}
                  disabled={pending}
                  title="Remover"
                  style={{
                    width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
                    border: '1px solid #7f1d1d44', backgroundColor: '#450a0a22',
                    color: '#ef4444', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              ) : <span />}
            </div>
          ))
        )}
      </div>

      {/* Add form */}
      {canAdd && (
        <>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              style={{
                padding: '8px 18px', borderRadius: 7, cursor: 'pointer',
                border: '1px solid #1d4ed844', backgroundColor: '#1d4ed818',
                color: '#60a5fa', fontSize: 12, fontWeight: 700,
              }}
            >
              + Adicionar Material
            </button>
          ) : (
            <form
              onSubmit={handleAdd}
              style={{
                backgroundColor: '#050f1f', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: 16,
                animation: 'fadeInUp 0.2s ease',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 12, textTransform: 'uppercase' }}>
                Novo Material
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>Nome *</div>
                  <input
                    style={{ ...inputSt, width: '100%' }}
                    value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Nome do material"
                    required
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>Qtd</div>
                  <input
                    style={{ ...inputSt, width: '100%' }}
                    type="number" min="1"
                    value={form.quantidade}
                    onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>Tipo</div>
                  <select
                    style={{ ...inputSt, width: '100%' }}
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  >
                    <option value="OS">OS</option>
                    <option value="COMODATO">COMODATO</option>
                  </select>
                </div>
                {form.tipo === 'COMODATO' && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>Valor (R$)</div>
                    <input
                      style={{ ...inputSt, width: '100%' }}
                      type="number" step="0.01" min="0"
                      value={form.valor}
                      onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={pending}
                  style={{
                    padding: '7px 18px', borderRadius: 6, cursor: 'pointer',
                    border: 'none', backgroundColor: '#1d4ed8',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {pending && <Spinner />} Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  style={{
                    padding: '7px 16px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                    color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab Fotos ─────────────────────────────────────────────────────────────────

function TabFotos({ os, onOsUpdate, userRole }) {
  const { toast, show } = useToast()
  const [pending, startTransition] = useTransition()
  const [localPreviews, setLocalPreviews] = useState([])
  const fileInputRef = useRef(null)

  const fotos = os.fotos ?? []
  const canAdd = ['superadmin', 'admin', 'tecnico'].includes(userRole)

  function handleFileChange(e) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setLocalPreviews(prev => [
          ...prev,
          { name: file.name, url: ev.target.result, size: file.size, id: `local-${Date.now()}-${Math.random()}` },
        ])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  async function handleUpload(preview) {
    startTransition(async () => {
      try {
        const updated = await addFoto(os.os_id, {
          nome:    preview.name,
          url:     preview.url,
          tamanho: preview.size,
        })
        onOsUpdate(updated)
        setLocalPreviews(prev => prev.filter(p => p.id !== preview.id))
        show('Foto salva!')
      } catch (err) {
        show(err.message, 'error')
      }
    })
  }

  async function handleRemoveFoto(fotoId) {
    if (!confirm('Remover esta foto?')) return
    startTransition(async () => {
      try {
        const updated = await removeFoto(os.os_id, fotoId)
        onOsUpdate(updated)
        show('Foto removida!')
      } catch (err) {
        show(err.message, 'error')
      }
    })
  }

  const allFotos = [
    ...fotos.map(f => ({ ...f, saved: true })),
    ...localPreviews.map(p => ({ ...p, saved: false })),
  ]

  return (
    <div style={{ padding: '20px 24px', animation: 'slideIn 0.2s ease' }}>
      <Toast toast={toast} />

      <div style={{
        fontSize: 11, color: 'var(--text-muted)', marginBottom: 16,
        padding: '8px 12px', borderRadius: 6,
        backgroundColor: '#f59e0b0a', border: '1px solid #f59e0b22',
      }}>
        Em produção, usar armazenamento externo (S3, Cloudinary). Preview local via base64 apenas para demonstração.
      </div>

      {canAdd && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px 18px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid #1d4ed844', backgroundColor: '#1d4ed818',
              color: '#60a5fa', fontSize: 12, fontWeight: 700,
            }}
          >
            + Selecionar Fotos
          </button>
          {localPreviews.length > 0 && (
            <span style={{ fontSize: 12, color: '#f59e0b' }}>
              {localPreviews.length} foto(s) aguardando salvar
            </span>
          )}
        </div>
      )}

      {allFotos.length === 0 ? (
        <div style={{
          padding: '40px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: 13,
          border: '2px dashed var(--border-color)',
          borderRadius: 10,
        }}>
          Nenhuma foto registrada
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
        }}>
          {allFotos.map((foto, idx) => (
            <div
              key={foto._id ?? foto.id ?? idx}
              style={{
                backgroundColor: '#050f1f',
                border: `1px solid ${foto.saved ? 'var(--border-color)' : '#f59e0b44'}`,
                borderRadius: 8, overflow: 'hidden',
                position: 'relative',
                animation: 'fadeInUp 0.2s ease',
              }}
            >
              <div style={{ position: 'relative', width: '100%', paddingTop: '75%', backgroundColor: '#0a1628' }}>
                <img
                  src={foto.url}
                  alt={foto.nome ?? 'foto'}
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: '100%', objectFit: 'cover',
                  }}
                />
                {!foto.saved && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundColor: '#00000066',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 4,
                      backgroundColor: '#f59e0b', color: '#000',
                      fontSize: 10, fontWeight: 700,
                    }}>
                      Preview
                    </span>
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{
                  fontSize: 11, color: 'var(--foreground)', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: 2,
                }}>
                  {foto.nome ?? 'foto'}
                </div>
                {foto.tamanho && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {fmtBytes(foto.tamanho)}
                  </div>
                )}
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  {!foto.saved ? (
                    <button
                      onClick={() => handleUpload({ name: foto.nome, url: foto.url, size: foto.tamanho, id: foto.id })}
                      disabled={pending}
                      style={{
                        flex: 1, padding: '4px', borderRadius: 5, cursor: 'pointer',
                        border: 'none', backgroundColor: '#1d4ed8',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                    >
                      {pending ? <Spinner size={10} /> : 'Salvar'}
                    </button>
                  ) : canAdd && (
                    <button
                      onClick={() => handleRemoveFoto(foto._id)}
                      disabled={pending}
                      style={{
                        flex: 1, padding: '4px', borderRadius: 5, cursor: 'pointer',
                        border: '1px solid #7f1d1d44', backgroundColor: '#450a0a22',
                        color: '#ef4444', fontSize: 10, fontWeight: 700,
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab Histórico ──────────────────────────────────────────────────────────────

function TabHistorico({ os, onOsUpdate, userRole }) {
  const { toast, show } = useToast()
  const [pending, startTransition] = useTransition()
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')

  const historico = os.historico ?? []
  const canAddNote = ['superadmin', 'admin'].includes(userRole)

  // Build timeline with OS creation as first entry
  const entries = [
    {
      acao:         `OS aberta · tipo: ${TIPO_META[os.tipo]?.label ?? os.tipo}`,
      usuario_nome: os.criado_por ?? 'Sistema',
      timestamp:    os.data_abertura,
      _synthetic:   true,
    },
    ...historico.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
  ]

  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    startTransition(async () => {
      try {
        const updated = await addHistorico(os.os_id, `Nota: ${noteText.trim()}`)
        onOsUpdate(updated)
        setNoteText('')
        setShowNote(false)
        show('Nota adicionada!')
      } catch (err) {
        show(err.message, 'error')
      }
    })
  }

  return (
    <div style={{ padding: '20px 24px', animation: 'slideIn 0.2s ease' }}>
      <Toast toast={toast} />

      {canAddNote && (
        <div style={{ marginBottom: 20 }}>
          {!showNote ? (
            <button
              onClick={() => setShowNote(true)}
              style={{
                padding: '8px 18px', borderRadius: 7, cursor: 'pointer',
                border: '1px solid #1d4ed844', backgroundColor: '#1d4ed818',
                color: '#60a5fa', fontSize: 12, fontWeight: 700,
              }}
            >
              + Adicionar Nota
            </button>
          ) : (
            <form
              onSubmit={handleAddNote}
              style={{
                backgroundColor: '#050f1f', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: 14, marginBottom: 4,
                animation: 'fadeInDown 0.15s ease',
              }}
            >
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Escreva a nota de acompanhamento..."
                style={{
                  width: '100%', minHeight: 80, resize: 'vertical',
                  padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#0d1b2e', color: 'var(--foreground)',
                  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                  marginBottom: 8,
                }}
                required
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={pending}
                  style={{
                    padding: '7px 18px', borderRadius: 6, cursor: 'pointer',
                    border: 'none', backgroundColor: '#1d4ed8',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {pending && <Spinner />} Salvar Nota
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNote(false); setNoteText('') }}
                  style={{
                    padding: '7px 16px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--border-color)', backgroundColor: 'transparent',
                    color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        {entries.length > 1 && (
          <div style={{
            position: 'absolute', left: 9, top: 20, bottom: 12,
            width: 2, backgroundColor: '#1e293b',
          }} />
        )}

        {entries.map((entry, idx) => (
          <div
            key={entry._id ?? idx}
            style={{
              display: 'flex', gap: 14, marginBottom: 16,
              animation: 'fadeInUp 0.2s ease',
              animationDelay: `${idx * 0.03}s`,
            }}
          >
            {/* Dot */}
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              backgroundColor: '#0a1628',
              border: `2px solid ${histColor(idx)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: histColor(idx),
              }} />
            </div>

            {/* Content */}
            <div style={{
              flex: 1, backgroundColor: '#050f1f',
              border: '1px solid var(--border-color)',
              borderRadius: 8, padding: '10px 14px',
              borderLeft: `3px solid ${histColor(idx)}`,
            }}>
              <div style={{ fontSize: 13, color: 'var(--foreground)', fontWeight: 500, marginBottom: 4 }}>
                {entry.acao}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {entry.usuario_nome && (
                  <span style={{ fontSize: 11, color: histColor(idx), fontWeight: 600 }}>
                    {entry.usuario_nome}
                  </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {fmtDateTime(entry.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhuma atividade registrada
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function OSDetailClient({ os: initialOs, userRole, userName }) {
  const [os, setOs] = useState(initialOs)
  const [activeTab, setActiveTab] = useState('conexao')

  // Auto-poll connection status every 8 seconds (mock)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const updated = await simularStatusConexao(os.os_id)
        setOs(updated)
      } catch {
        // Silently ignore polling errors
      }
    }, 8000)
    return () => clearInterval(timer)
  }, [os.os_id])

  function handleOsUpdate(updated) {
    setOs(updated)
  }

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
      }}>
        <OSHeader os={os} />
        <StatusStepper currentStatus={os.status} />
        <TabBar active={activeTab} onChange={setActiveTab} />

        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {activeTab === 'conexao' && (
            <TabConexao os={os} onOsUpdate={handleOsUpdate} userRole={userRole} />
          )}
          {activeTab === 'materiais' && (
            <TabMateriais os={os} onOsUpdate={handleOsUpdate} userRole={userRole} />
          )}
          {activeTab === 'fotos' && (
            <TabFotos os={os} onOsUpdate={handleOsUpdate} userRole={userRole} />
          )}
          {activeTab === 'historico' && (
            <TabHistorico os={os} onOsUpdate={handleOsUpdate} userRole={userRole} />
          )}
        </div>
      </div>
    </>
  )
}
