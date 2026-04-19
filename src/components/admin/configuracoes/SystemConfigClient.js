'use client'

import { useState, useTransition } from 'react'
import { updateSystemConfig, updateFiberColors } from '@/actions/config'
import { FIBER_COLOR_DEFAULTS } from '@/models/SystemConfig'

// ─── Seção visual ──────────────────────────────────────────────────────────────

function Section({ title, description, children }) {
  return (
    <div style={{
      background: 'var(--card-bg, #0f172a)',
      border: '1px solid var(--border-color, #1e293b)',
      borderRadius: 16, padding: '24px',
      marginBottom: 20,
    }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>
          {title}
        </h2>
        {description && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600,
        color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '10px 12px', borderRadius: 8,
        background: 'var(--input-bg, #1e293b)',
        border: '1px solid var(--border-color, #334155)',
        color: 'var(--foreground)', fontSize: 14,
        fontFamily: 'inherit', outline: 'none',
      }}
      {...rest}
    />
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 42, height: 24, borderRadius: 12,
          background: value ? '#ea580c' : '#374151',
          position: 'relative', transition: 'background .2s', flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', transition: 'left .2s',
        }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{label}</span>
    </label>
  )
}

function SaveBtn({ pending, onClick, label = 'Salvar alterações' }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      style={{
        padding: '10px 20px', borderRadius: 10, border: 'none',
        background: pending ? '#374151' : 'linear-gradient(135deg,#c2410c,#ea580c)',
        color: '#fff', fontSize: 13, fontWeight: 700,
        cursor: pending ? 'not-allowed' : 'pointer',
        boxShadow: pending ? 'none' : '0 4px 16px rgba(234,88,12,0.25)',
        fontFamily: 'inherit',
      }}
    >
      {pending ? 'Salvando…' : label}
    </button>
  )
}

// ─── Painel de cores de fibra ──────────────────────────────────────────────────

function FiberColorPanel({ initialPadrao, initialCores }) {
  const [padrao, setPadrao]     = useState(initialPadrao ?? 'brasil')
  const [cores, setCores]       = useState(initialCores ?? FIBER_COLOR_DEFAULTS.brasil)
  const [pending, startTrans]   = useTransition()
  const [msg, setMsg]           = useState(null)

  function handlePadraoChange(novoPadrao) {
    setPadrao(novoPadrao)
    if (novoPadrao !== 'personalizado') {
      setCores(FIBER_COLOR_DEFAULTS[novoPadrao] ?? [])
    }
  }

  function handleCorChange(posicao, field, val) {
    setCores(prev => prev.map(c => c.posicao === posicao ? { ...c, [field]: val } : c))
  }

  function handleSave() {
    setMsg(null)
    startTrans(async () => {
      const res = await updateFiberColors({ padrao, cores })
      if (!res.error) {
        // Propaga para todos os editores via contexto React (re-render imediato)
        window.dispatchEvent(new CustomEvent('fibercolors:update', { detail: cores }))
      }
      setMsg(res.error ?? 'Cores salvas com sucesso!')
    })
  }

  return (
    <div>
      <Field label="Padrão de referência">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['brasil', 'eua', 'personalizado'].map(p => (
            <button
              key={p}
              onClick={() => handlePadraoChange(p)}
              style={{
                padding: '7px 16px', borderRadius: 8, border: 'none',
                background: padrao === p ? '#ea580c' : 'var(--input-bg, #1e293b)',
                border: `1px solid ${padrao === p ? '#ea580c' : 'var(--border-color, #334155)'}`,
                color: padrao === p ? '#fff' : 'var(--foreground)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize', fontFamily: 'inherit',
              }}
            >
              {p === 'brasil' ? '🇧🇷 Brasil' : p === 'eua' ? '🇺🇸 EUA' : '✏️ Personalizado'}
            </button>
          ))}
        </div>
      </Field>

      {/* Grade de cores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        {cores.map(c => (
          <div key={c.posicao} style={{
            background: 'var(--input-bg, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: 10, padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <input
              type="color"
              value={c.hex}
              onChange={e => handleCorChange(c.posicao, 'hex', e.target.value)}
              disabled={padrao !== 'personalizado'}
              style={{ width: 32, height: 32, borderRadius: 6, border: 'none', cursor: padrao === 'personalizado' ? 'pointer' : 'default', padding: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Fibra {c.posicao}</div>
              {padrao === 'personalizado' ? (
                <input
                  value={c.nome}
                  onChange={e => handleCorChange(c.posicao, 'nome', e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--foreground)', fontSize: 13, fontWeight: 600,
                    fontFamily: 'inherit', width: '100%',
                  }}
                />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.nome}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: msg.includes('sucesso') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.includes('sucesso') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: msg.includes('sucesso') ? '#4ade80' : '#f87171',
        }}>
          {msg}
        </div>
      )}

      <SaveBtn pending={pending} onClick={handleSave} label="Salvar cores de fibra" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SystemConfigClient({ initialConfig }) {
  const [cfg,      setCfg]      = useState(initialConfig ?? {})
  const [pending,  startTrans]  = useTransition()
  const [msg,      setMsg]      = useState(null)

  function set(field, val) {
    setCfg(prev => ({ ...prev, [field]: val }))
  }

  function handleSaveGeral() {
    setMsg(null)
    startTrans(async () => {
      const res = await updateSystemConfig({
        nome_empresa:     cfg.nome_empresa,
        timezone:         cfg.timezone,
        notif_nova_os:    cfg.notif_nova_os,
        notif_status_os:  cfg.notif_status_os,
        notif_ponto:      cfg.notif_ponto,
        os_prazo_horas:   cfg.os_prazo_horas,
        mapa_lat_default: cfg.mapa_lat_default,
        mapa_lng_default: cfg.mapa_lng_default,
        mapa_zoom_default: cfg.mapa_zoom_default,
      })
      setMsg(res.error ?? 'Configurações salvas!')
    })
  }

  return (
    <div style={{
      padding: '28px 20px', maxWidth: 780, margin: '0 auto',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          ⚙️ Configurações do sistema
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Preferências globais aplicadas em todo o sistema para este projeto.
        </p>
      </div>

      {/* Geral */}
      <Section title="Geral" description="Informações básicas do projeto e fuso horário.">
        <Field label="Nome da empresa / projeto">
          <Input value={cfg.nome_empresa ?? ''} onChange={v => set('nome_empresa', v)} placeholder="Ex: Provedor XYZ" />
        </Field>
        <Field label="Fuso horário" hint="Afeta horários de ponto e agendamentos.">
          <select
            value={cfg.timezone ?? 'America/Sao_Paulo'}
            onChange={e => set('timezone', e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              background: 'var(--input-bg, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              color: 'var(--foreground)', fontSize: 14, fontFamily: 'inherit',
            }}
          >
            <option value="America/Sao_Paulo">America/Sao_Paulo (BRT -3)</option>
            <option value="America/Manaus">America/Manaus (AMT -4)</option>
            <option value="America/Belem">America/Belem (BRT -3)</option>
            <option value="America/Fortaleza">America/Fortaleza (BRT -3)</option>
            <option value="America/New_York">America/New_York (EST -5)</option>
            <option value="UTC">UTC +0</option>
          </select>
        </Field>
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
            background: msg.includes('!') && !msg.includes('erro') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${msg.includes('!') && !msg.includes('erro') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: msg.includes('!') && !msg.includes('erro') ? '#4ade80' : '#f87171',
          }}>
            {msg}
          </div>
        )}
        <SaveBtn pending={pending} onClick={handleSaveGeral} />
      </Section>

      {/* Notificações */}
      <Section title="Notificações" description="Controle quais eventos geram push notifications.">
        <Toggle value={cfg.notif_nova_os    ?? true} onChange={v => set('notif_nova_os', v)}    label="Nova OS atribuída ao técnico" />
        <Toggle value={cfg.notif_status_os  ?? true} onChange={v => set('notif_status_os', v)}  label="Mudança de status de OS" />
        <Toggle value={cfg.notif_ponto      ?? true} onChange={v => set('notif_ponto', v)}      label="Alertas de ponto (entrada, saída, almoço)" />
        <SaveBtn pending={pending} onClick={handleSaveGeral} />
      </Section>

      {/* OS */}
      <Section title="Ordens de Serviço" description="Configurações de SLA e fluxo de OS.">
        <Field label="Prazo padrão de SLA (horas)" hint="Tempo máximo para conclusão de uma OS aberta.">
          <Input
            type="number"
            value={cfg.os_prazo_horas ?? 48}
            onChange={v => set('os_prazo_horas', v)}
            min={1} max={720}
            style={{ maxWidth: 140 }}
          />
        </Field>
        <SaveBtn pending={pending} onClick={handleSaveGeral} />
      </Section>

      {/* Mapa */}
      <Section title="Mapa" description="Posição e zoom padrão ao abrir o mapa.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Latitude padrão">
            <Input type="number" value={cfg.mapa_lat_default ?? -15.7942} onChange={v => set('mapa_lat_default', v)} step="0.0001" />
          </Field>
          <Field label="Longitude padrão">
            <Input type="number" value={cfg.mapa_lng_default ?? -47.8822} onChange={v => set('mapa_lng_default', v)} step="0.0001" />
          </Field>
          <Field label="Zoom padrão">
            <Input type="number" value={cfg.mapa_zoom_default ?? 13} onChange={v => set('mapa_zoom_default', v)} min={5} max={20} />
          </Field>
        </div>
        <SaveBtn pending={pending} onClick={handleSaveGeral} />
      </Section>

      {/* Cores de fibra */}
      <Section title="Padrão de cores de fibra óptica" description="Define a convenção de cores usada no mapa, topologia e CTOs.">
        <FiberColorPanel
          initialPadrao={cfg.padrao_fibra}
          initialCores={cfg.cores_fibra}
        />
      </Section>
    </div>
  )
}
