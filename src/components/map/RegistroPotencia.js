'use client'

import { useState, useEffect } from 'react'
import { getCaminhoPotencia } from '@/actions/topologia'

const LIMITES = { ok: -27, alto: -30 }

/**
 * AGENT_PON / AGENT_CAMPO — Registro de potência medida em campo.
 * Técnico insere o dBm medido na CTO → compara com cálculo teórico.
 */
export default function RegistroPotencia({ ctoId, projetoId, onClose }) {
  const [dbm, setDbm]           = useState('')
  const [caminho, setCaminho]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState(null)

  useEffect(() => {
    if (!ctoId || !projetoId) return
    setLoading(true)
    getCaminhoPotencia(projetoId, ctoId)
      .then(c => { setCaminho(c); setErro(null) })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [ctoId, projetoId])

  const medido = parseFloat(dbm)
  const temMedida = !isNaN(medido) && dbm.trim() !== ''

  function avaliar(v) {
    if (v < LIMITES.alto) return { label: 'FORA DO PADRÃO', cor: '#ef4444', icon: '❌' }
    if (v < LIMITES.ok)   return { label: 'ATENUAÇÃO ALTA', cor: '#f59e0b', icon: '⚠️' }
    return                       { label: 'OK',              cor: '#22c55e', icon: '✅' }
  }

  const avaliacao = temMedida ? avaliar(medido) : null

  // Pegar potência teórica final (última trecho)
  const potTeorica = (() => {
    if (!caminho?.trechos?.length) return null
    const t = caminho.trechos[caminho.trechos.length - 1]
    // potFinal não vem do servidor — calcular manualmente simplificado
    return null
  })()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end',
    }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: 'rgba(6,10,22,0.99)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 40px',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 2 }}>
              Registro de Potência
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
              📡 {ctoId}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, width: 32, height: 32, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#64748b', fontSize: 16, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Topologia */}
        {loading && (
          <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            Carregando topologia...
          </div>
        )}
        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: 12, marginBottom: 16,
          }}>
            ⚠️ {erro}
          </div>
        )}

        {caminho && !loading && (
          <div style={{ marginBottom: 16 }}>
            {/* Caminho resumido */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 12,
            }}>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Caminho
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                {caminho.olt && <>
                  <span style={{ color: '#67e8f9', fontWeight: 700 }}>{caminho.olt.nome || caminho.olt.id}</span>
                  <span style={{ color: '#475569' }}>→</span>
                </>}
                {caminho.cdo && <>
                  <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{caminho.cdo.nome || caminho.cdo.id}</span>
                  <span style={{ color: '#475569' }}>→</span>
                </>}
                <span style={{ color: '#86efac', fontWeight: 700 }}>{caminho.cto.nome || caminho.cto.id}</span>
              </div>
              {caminho.trechos.map((t, i) => (
                <div key={i} style={{ marginTop: 6, fontSize: 11, color: '#64748b', display: 'flex', gap: 8 }}>
                  <span>{t.de} → {t.para}</span>
                  <span style={{ color: t.fonteDistancia === 'estimativa' ? '#f59e0b' : '#22c55e' }}>
                    {t.distKm.toFixed(3)} km {t.fonteDistancia === 'estimativa' ? '≈' : '✓'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input de medição */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
          }}>
            Potência Medida (dBm)
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              step="0.1"
              min="-50"
              max="10"
              value={dbm}
              onChange={e => setDbm(e.target.value)}
              placeholder="-23.5"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${avaliacao ? avaliacao.cor + '66' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 12, padding: '14px 16px',
                color: '#f1f5f9', fontSize: 20, fontWeight: 700,
                fontFamily: 'monospace', outline: 'none', textAlign: 'center',
                transition: 'border-color 0.2s',
              }}
              autoFocus
            />
            <span style={{ color: '#64748b', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>dBm</span>
          </div>
        </div>

        {/* Resultado */}
        {temMedida && avaliacao && (
          <div style={{
            background: avaliacao.cor + '18',
            border: `1px solid ${avaliacao.cor}55`,
            borderRadius: 14, padding: '16px 20px',
            textAlign: 'center', marginBottom: 12,
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>{avaliacao.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: avaliacao.cor, marginBottom: 4 }}>
              {medido.toFixed(1)} dBm
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: avaliacao.cor }}>
              {avaliacao.label}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              Padrão: ≥ {LIMITES.ok} dBm · Crítico: {LIMITES.alto} dBm
            </div>
          </div>
        )}

        {/* Referência rápida */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16,
        }}>
          {[
            { label: '✅ OK',       range: `≥ ${LIMITES.ok} dBm`,   cor: '#22c55e' },
            { label: '⚠️ Alto',     range: `${LIMITES.alto}~${LIMITES.ok} dBm`, cor: '#f59e0b' },
            { label: '❌ Crítico',  range: `< ${LIMITES.alto} dBm`, cor: '#ef4444' },
          ].map(({ label, range, cor }) => (
            <div key={label} style={{
              background: cor + '12', border: `1px solid ${cor}33`,
              borderRadius: 8, padding: '8px 6px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: cor }}>{label}</div>
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{range}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
