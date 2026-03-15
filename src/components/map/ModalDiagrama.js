'use client'

import { useEffect, useState } from 'react'
import { getDiagramaCTO } from '@/actions/ctos'

const modalOverlay = { backgroundColor: 'rgba(0,0,0,0.88)' }
const modalPanel = {
  backgroundColor: 'rgba(8,13,28,0.99)',
  border: '1px solid rgba(255,255,255,0.08)',
  width: 'min(560px,100%)',
  maxHeight: '92vh',
}
const labelStyle = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.35)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
}
const groupStyle = {
  backgroundColor: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: '14px 16px',
}

export default function ModalDiagrama({ ctoData, projetoId, onClose }) {
  const [diagrama, setDiagrama] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setErro(null)
      try {
        const data = await getDiagramaCTO(ctoData.cto_id, projetoId)
        if (mounted) setDiagrama(data)
      } catch (e) {
        if (mounted) setErro(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [ctoData.cto_id, projetoId])

  const capacidade = diagrama?.capacidade ?? ctoData?.capacidade ?? 8
  const portas = diagrama?.diagrama?.portas ?? {}
  const listaPortas = Array.from({ length: capacidade }, (_, i) => {
    const num = i + 1
    const cliente = portas[String(num)]?.cliente ?? null
    return { num, cliente }
  })
  const ocupadas = listaPortas.filter(p => p.cliente).length
  const pct = capacidade > 0 ? Math.round((ocupadas / capacidade) * 100) : 0
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={modalPanel} className="rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={labelStyle}>Diagrama de Fibra</p>
              <p style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700 }}>
                {ctoData.nome || ctoData.cto_id}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, lineHeight: 1, padding: 4 }} className="hover:text-white transition-colors">✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 0', fontSize: 13 }}>
              Carregando diagrama...
            </div>
          )}
          {erro && (
            <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fca5a5' }}>
              {erro}
            </div>
          )}

          {!loading && !erro && (
            <>
              {/* Cadeia de fibra */}
              <div style={groupStyle}>
                <p style={{ ...labelStyle, marginBottom: 12 }}>Caminho de Fibra</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
                  {/* OLT */}
                  <div style={{ backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>OLT</p>
                    <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>—</p>
                  </div>
                  {/* Seta */}
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, padding: '0 6px' }}>→</div>
                  {/* CDO/CE */}
                  <div style={{ backgroundColor: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>CDO/CE</p>
                    <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{ctoData.cdo_id || '—'}</p>
                    {ctoData.porta_cdo != null && (
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>porta {ctoData.porta_cdo}</p>
                    )}
                  </div>
                  {/* Seta */}
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, padding: '0 6px' }}>→</div>
                  {/* Splitter */}
                  {ctoData.splitter_cto && (
                    <>
                      <div style={{ backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                        <p style={{ fontSize: 9, color: '#fdba74', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Splitter</p>
                        <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{ctoData.splitter_cto}</p>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, padding: '0 6px' }}>→</div>
                    </>
                  )}
                  {/* CTO */}
                  <div style={{ backgroundColor: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>CTO</p>
                    <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{ctoData.cto_id}</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{capacidade} portas</p>
                  </div>
                </div>
              </div>

              {/* Ocupação */}
              <div style={groupStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={labelStyle}>Ocupação das Portas</p>
                  <span style={{ fontSize: 12, color: barColor, fontWeight: 700 }}>{ocupadas}/{capacidade} ({pct}%)</span>
                </div>
                <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: barColor, borderRadius: 4 }} />
                </div>

                {/* Grade de portas — somente as ocupadas primeiro, depois as livres */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Portas ocupadas */}
                  {listaPortas.filter(p => p.cliente).length > 0 && (
                    <div>
                      <p style={{ ...labelStyle, marginBottom: 6 }}>Ocupadas</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {listaPortas.filter(p => p.cliente).map(({ num, cliente }) => (
                          <div key={num} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            backgroundColor: 'rgba(34,197,94,0.08)',
                            border: '1px solid rgba(34,197,94,0.2)',
                            borderRadius: 8, padding: '7px 12px',
                          }}>
                            <span style={{ color: '#86efac', fontSize: 11, fontWeight: 700, minWidth: 52 }}>Porta {num}</span>
                            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{cliente}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Portas livres */}
                  {listaPortas.filter(p => !p.cliente).length > 0 && (
                    <div style={{ marginTop: listaPortas.filter(p => p.cliente).length > 0 ? 8 : 0 }}>
                      <p style={{ ...labelStyle, marginBottom: 6 }}>Livres ({listaPortas.filter(p => !p.cliente).length})</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {listaPortas.filter(p => !p.cliente).map(({ num }) => (
                          <span key={num} style={{
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 6, padding: '4px 10px',
                            color: 'rgba(255,255,255,0.25)', fontSize: 11,
                          }}>
                            {num}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '8px 20px', borderRadius: 8 }}
            className="hover:bg-white/5 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
