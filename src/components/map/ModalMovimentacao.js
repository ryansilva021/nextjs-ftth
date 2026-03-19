'use client'

import { useEffect, useState } from 'react'
import { getDiagramaCTO, saveDiagramaCTO } from '@/actions/ctos'

const modalOverlay = { backgroundColor: 'rgba(0,0,0,0.88)' }
const modalPanel = {
  backgroundColor: 'rgba(8,13,28,0.99)',
  border: '1px solid rgba(255,255,255,0.08)',
  width: 'min(600px,100%)',
  maxHeight: '92vh',
}
const labelStyle = {
  fontSize: 10,
  color: 'rgba(255,255,255,0.35)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
}
const fieldInput = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
}

export default function ModalMovimentacao({ ctoData, projetoId, onClose, onSaved }) {
  const [diagrama, setDiagrama] = useState(null) // { cto_id, capacidade, diagrama: { portas } }
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [saving, setSaving] = useState(false)

  // portaEditando: { num: number } | null
  const [portaEditando, setPortaEditando] = useState(null)
  const [clienteInput, setClienteInput] = useState('')

  // confirmRemover: { num: number, nome: string } | null
  const [confirmRemover, setConfirmRemover] = useState(null)

  const capacidade = diagrama?.capacidade ?? ctoData?.capacidade ?? 8
  const portas = diagrama?.diagrama?.portas ?? {}

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

  function getCliente(num) {
    return portas[String(num)]?.cliente ?? null
  }

  function ocupadas() {
    return Array.from({ length: capacidade }, (_, i) => i + 1).filter(n => getCliente(n)).length
  }

  async function salvarCliente(num, nome) {
    setSaving(true)
    setErro(null)

    // Bloquear cliente duplicado na mesma CTO
    if (nome) {
      const nomeNorm = nome.trim().toLowerCase()
      const duplicata = Object.entries(portas).find(
        ([key, val]) => key !== String(num) && val?.cliente?.trim().toLowerCase() === nomeNorm
      )
      if (duplicata) {
        setErro(`Cliente "${nome.trim()}" já está na porta ${duplicata[0]} desta CTO.`)
        setSaving(false)
        return
      }
    }

    try {
      const novasPortas = { ...portas, [String(num)]: { cliente: nome || null } }
      // Remove keys com cliente null para manter o objeto limpo
      if (!nome) delete novasPortas[String(num)]
      await saveDiagramaCTO({
        cto_id: ctoData.cto_id,
        projeto_id: projetoId,
        diagrama: { portas: novasPortas },
      })
      // Atualiza estado local
      setDiagrama(prev => ({
        ...prev,
        diagrama: { portas: novasPortas },
      }))
      onSaved?.()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSaving(false)
      setPortaEditando(null)
      setConfirmRemover(null)
      setClienteInput('')
    }
  }

  const pct = capacidade > 0 ? Math.round((ocupadas() / capacidade) * 100) : 0
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={modalPanel} className="rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ ...labelStyle }}>CTO {ctoData.cto_id}</p>
              <p style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700 }}>
                {ctoData.nome || 'Movimentação de Clientes'}
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 22, lineHeight: 1, padding: 4 }} className="hover:text-white transition-colors">✕</button>
          </div>

          {/* Barra de ocupação */}
          {!loading && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={labelStyle}>Ocupação</span>
                <span style={{ fontSize: 12, color: barColor, fontWeight: 700 }}>{ocupadas()}/{capacidade} portas ({pct}%)</span>
              </div>
              <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: barColor, borderRadius: 4 }} />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 0', fontSize: 13 }}>
              Carregando portas...
            </div>
          )}

          {erro && (
            <div style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginBottom: 12 }}>
              {erro}
            </div>
          )}

          {!loading && !erro && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {Array.from({ length: capacidade }, (_, i) => {
                const num = i + 1
                const cliente = getCliente(num)
                const ocupada = !!cliente
                const isEditing = portaEditando?.num === num

                return (
                  <div key={num}>
                    {isEditing ? (
                      /* Porta em modo edição */
                      <div style={{
                        backgroundColor: 'rgba(34,197,94,0.08)',
                        border: '1px solid rgba(34,197,94,0.4)',
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}>
                        <p style={{ ...labelStyle, marginBottom: 6 }}>Porta {num}</p>
                        <input
                          autoFocus
                          value={clienteInput}
                          onChange={(e) => setClienteInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && clienteInput.trim()) salvarCliente(num, clienteInput.trim())
                            if (e.key === 'Escape') { setPortaEditando(null); setClienteInput('') }
                          }}
                          placeholder="Nome do cliente"
                          style={{ ...fieldInput, width: '100%', borderRadius: 6, padding: '5px 8px', marginBottom: 6 }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => { if (clienteInput.trim()) salvarCliente(num, clienteInput.trim()) }}
                            disabled={!clienteInput.trim() || saving}
                            style={{ flex: 1, background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#052e16', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '4px 0' }}
                            className="disabled:opacity-40"
                          >
                            {saving ? '...' : 'Salvar'}
                          </button>
                          <button
                            onClick={() => { setPortaEditando(null); setClienteInput('') }}
                            style={{ flex: 1, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 11, borderRadius: 6, padding: '4px 0' }}
                            className="hover:bg-white/5"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : confirmRemover?.num === num ? (
                      /* Confirmação de remoção */
                      <div style={{
                        backgroundColor: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}>
                        <p style={{ ...labelStyle, marginBottom: 4 }}>Remover cliente?</p>
                        <p style={{ color: '#fca5a5', fontSize: 12, fontWeight: 600, marginBottom: 8, wordBreak: 'break-word' }}>{confirmRemover.nome}</p>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => salvarCliente(num, null)}
                            disabled={saving}
                            style={{ flex: 1, backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 11, borderRadius: 6, padding: '4px 0' }}
                            className="disabled:opacity-40"
                          >
                            {saving ? '...' : 'Remover'}
                          </button>
                          <button
                            onClick={() => setConfirmRemover(null)}
                            style={{ flex: 1, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 11, borderRadius: 6, padding: '4px 0' }}
                            className="hover:bg-white/5"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Porta normal */
                      <button
                        onClick={() => {
                          if (ocupada) {
                            setConfirmRemover({ num, nome: cliente })
                            setPortaEditando(null)
                          } else {
                            setPortaEditando({ num })
                            setClienteInput('')
                            setConfirmRemover(null)
                          }
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: ocupada ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${ocupada ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: 10,
                          padding: '10px 12px',
                          textAlign: 'left',
                          transition: 'all .15s',
                        }}
                        className="hover:brightness-125"
                      >
                        <p style={{ ...labelStyle, marginBottom: 3 }}>Porta {num}</p>
                        {ocupada ? (
                          <p style={{ color: '#86efac', fontSize: 12, fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3 }}>{cliente}</p>
                        ) : (
                          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>+ Adicionar cliente</p>
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
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
