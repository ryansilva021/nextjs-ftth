'use client'

import { useState, useEffect, useCallback } from 'react'
import { T } from './pontoTheme'
import BaterPontoTab          from './tabs/BaterPontoTab'
import IncluirPontoTab        from './tabs/IncluirPontoTab'
import AjustarPontoTab        from './tabs/AjustarPontoTab'
import JustificarAusenciaTab  from './tabs/JustificarAusenciaTab'
import MinhasSolicitacoesTab  from './tabs/MinhasSolicitacoesTab'
import DadosCadastraisTab     from './tabs/DadosCadastraisTab'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'bater',       label: 'Bater Ponto',   icon: '🕐' },
  { id: 'incluir',     label: 'Incluir Ponto',  icon: '➕' },
  { id: 'ajustar',     label: 'Ajustar Ponto',  icon: '✏️' },
  { id: 'ausencia',    label: 'Ausência',        icon: '📋' },
  { id: 'solicitacoes',label: 'Solicitações',    icon: '📩' },
  { id: 'dados',       label: 'Meus Dados',      icon: '👤' },
]

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const bg = type === 'error' ? '#ef4444' : '#22c55e'
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', borderRadius: 12, padding: '12px 20px',
      fontSize: 14, fontWeight: 600, zIndex: 9999, maxWidth: 340, width: 'calc(100% - 32px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.45)', textAlign: 'center',
      animation: 'slideUp .2s ease',
    }}>
      {msg}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function PontoClient({ initialRecord, initialRequests, userName, userProfile }) {
  const [activeTab,  setActiveTab]  = useState('bater')
  const [record,     setRecord]     = useState(initialRecord)
  const [requests,   setRequests]   = useState(initialRequests ?? [])
  const [toast,      setToast]      = useState(null)

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: Date.now() })
  }, [])

  const addRequest = useCallback((req) => {
    setRequests(prev => [req, ...prev])
  }, [])

  // Data de hoje formatada
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ minHeight: '100dvh', background: T.canvas, fontFamily: T.ff, color: T.text, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: T.card, borderBottom: `1px solid ${T.border}`,
        padding: '18px 16px 0', flexShrink: 0,
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 10, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Controle de Ponto
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>
                Olá, {userName} 👋
              </div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 2, textTransform: 'capitalize' }}>
                {today}
              </div>
            </div>
            {/* Badge de status rápido no header */}
            {record && (
              <StatusBadgeMini status={record.status} />
            )}
          </div>

          {/* Tab bar — scrollável */}
          <div style={{
            display: 'flex', gap: 2,
            overflowX: 'auto', paddingBottom: 0,
            msOverflowStyle: 'none', scrollbarWidth: 'none',
          }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 14px',
                    background: 'none', border: 'none',
                    borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
                    color: active ? T.accent : T.dim,
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    fontFamily: T.ff, cursor: 'pointer',
                    transition: 'all .15s',
                    whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{tab.icon}</span>
                  {tab.label}
                  {/* Badge de contagem em Solicitações */}
                  {tab.id === 'solicitacoes' && requests.filter(r => r.status === 'pendente').length > 0 && (
                    <span style={{
                      background: T.warning, color: '#000', borderRadius: 99,
                      fontSize: 9, fontWeight: 800, padding: '1px 5px', lineHeight: 1.4,
                    }}>
                      {requests.filter(r => r.status === 'pendente').length}
                    </span>
                  )}
                </button>
              )
            })}
            <style>{`.ponto-tabs::-webkit-scrollbar{display:none}`}</style>
          </div>
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'bater' && (
          <BaterPontoTab
            record={record}
            setRecord={setRecord}
            showToast={showToast}
          />
        )}
        {activeTab === 'incluir' && (
          <IncluirPontoTab
            showToast={showToast}
            onSuccess={req => { addRequest(req); setActiveTab('solicitacoes') }}
          />
        )}
        {activeTab === 'ajustar' && (
          <AjustarPontoTab
            showToast={showToast}
            onSuccess={req => { addRequest(req); setActiveTab('solicitacoes') }}
          />
        )}
        {activeTab === 'ausencia' && (
          <JustificarAusenciaTab
            showToast={showToast}
            onSuccess={req => { addRequest(req); setActiveTab('solicitacoes') }}
          />
        )}
        {activeTab === 'solicitacoes' && (
          <MinhasSolicitacoesTab requests={requests} />
        )}
        {activeTab === 'dados' && (
          <DadosCadastraisTab userProfile={userProfile} />
        )}
      </div>

      {/* Toast global */}
      {toast && (
        <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

// Badge compacto de status para o header
function StatusBadgeMini({ status }) {
  const cfg = {
    trabalhando: { label: 'Trabalhando', dot: '#22c55e' },
    em_pausa:    { label: 'Em Pausa',    dot: '#f59e0b' },
    finalizado:  { label: 'Finalizado',  dot: '#94a3b8' },
  }[status] ?? { label: status, dot: '#6b7280' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: `${cfg.dot}18`, border: `1px solid ${cfg.dot}44`,
      borderRadius: 20, padding: '4px 10px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 5px ${cfg.dot}` }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.dot }}>{cfg.label}</span>
    </div>
  )
}
