'use client'

import { useEffect, useState } from 'react'
import { getDiagramaCTO, saveDiagramaCTO } from '@/actions/ctos'

export default function ModalMovimentacao({ ctoData, projetoId, onClose, onSaved }) {
  const [diagrama,       setDiagrama]       = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [erro,           setErro]           = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [portaEditando,  setPortaEditando]  = useState(null)
  const [clienteInput,   setClienteInput]   = useState('')
  const [confirmRemover, setConfirmRemover] = useState(null)

  const capacidade = diagrama?.capacidade ?? ctoData?.capacidade ?? 8
  const portas     = diagrama?.diagrama?.portas    ?? {}
  const splitters  = diagrama?.diagrama?.splitters ?? []

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

  // Unified port map: global port number → client name
  // Merges diagrama.portas (legacy/manual) + diagrama.splitters (NOC provisioning)
  function buildPortaMap() {
    const map = {}
    Object.entries(portas).forEach(([num, val]) => {
      if (val?.cliente?.trim()) map[String(num)] = val.cliente.trim()
    })
    let globalPortNum = 0
    for (const sp of splitters) {
      for (const saida of sp.saidas ?? []) {
        globalPortNum++
        const nome = saida?.cliente?.trim()
        if (nome && !map[String(globalPortNum)]) {
          map[String(globalPortNum)] = nome
        }
      }
    }
    return map
  }

  const portaMap = buildPortaMap()

  function getCliente(num) { return portaMap[String(num)] ?? null }

  function ocupadas() {
    return Array.from({ length: capacidade }, (_, i) => i + 1).filter(n => getCliente(n)).length
  }

  async function salvarCliente(num, nome) {
    setSaving(true)
    setErro(null)

    if (nome) {
      const nomeNorm = nome.trim().toLowerCase()
      const duplicata = Object.entries(portaMap).find(
        ([key, val]) => key !== String(num) && val.trim().toLowerCase() === nomeNorm
      )
      if (duplicata) {
        setErro(`Cliente "${nome.trim()}" já está na porta ${duplicata[0]} desta CTO.`)
        setSaving(false)
        return
      }
    }

    // Find if port belongs to a splitter (sequential global numbering)
    let splitterIdx = -1, saidaIdx = -1, globalPort = 0
    outer:
    for (let si = 0; si < splitters.length; si++) {
      for (let pi = 0; pi < (splitters[si].saidas ?? []).length; pi++) {
        globalPort++
        if (globalPort === num) { splitterIdx = si; saidaIdx = pi; break outer }
      }
    }

    try {
      const bandejas   = diagrama?.diagrama?.bandejas ?? []
      let newSplitters = splitters
      let novasPortas  = { ...portas }

      if (splitterIdx >= 0) {
        newSplitters = splitters.map((sp, si) =>
          si !== splitterIdx ? sp : {
            ...sp,
            saidas: sp.saidas.map((sd, pi) =>
              pi !== saidaIdx ? sd : { ...sd, cliente: nome?.trim() || '' }
            ),
          }
        )
      } else {
        novasPortas = { ...portas, [String(num)]: { cliente: nome?.trim() || null } }
        if (!nome?.trim()) delete novasPortas[String(num)]
      }

      await saveDiagramaCTO({
        cto_id:     ctoData.cto_id,
        projeto_id: projetoId,
        diagrama:   { bandejas, splitters: newSplitters, portas: novasPortas },
      })

      setDiagrama(prev => ({
        ...prev,
        diagrama: { ...prev?.diagrama, bandejas, splitters: newSplitters, portas: novasPortas },
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

  const pct      = capacidade > 0 ? Math.round((ocupadas() / capacidade) * 100) : 0
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          width: 'min(600px,100%)',
          maxHeight: '92vh',
        }}
        className="rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{
                fontSize: 10, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
              }}>
                CTO {ctoData.cto_id}
              </p>
              <p style={{ color: 'var(--foreground)', fontSize: 17, fontWeight: 700 }}>
                {ctoData.nome || 'Movimentação de Clientes'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1, padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {!loading && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                  Ocupação
                </span>
                <span style={{ fontSize: 12, color: barColor, fontWeight: 700 }}>
                  {ocupadas()}/{capacidade} portas ({pct}%)
                </span>
              </div>
              <div style={{ height: 6, backgroundColor: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: barColor, borderRadius: 4 }} />
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 13 }}>
              Carregando portas...
            </div>
          )}

          {erro && (
            <div style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#dc2626', marginBottom: 12,
            }}>
              {erro}
            </div>
          )}

          {!loading && !erro && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
              {Array.from({ length: capacidade }, (_, i) => {
                const num      = i + 1
                const cliente  = getCliente(num)
                const ocupada  = !!cliente
                const isEditing = portaEditando?.num === num

                return (
                  <div key={num}>
                    {isEditing ? (
                      <div style={{
                        backgroundColor: 'rgba(34,197,94,0.08)',
                        border: '1px solid rgba(34,197,94,0.4)',
                        borderRadius: 10, padding: '10px 12px',
                      }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
                          Porta {num}
                        </p>
                        <input
                          autoFocus
                          value={clienteInput}
                          onChange={(e) => setClienteInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && clienteInput.trim()) salvarCliente(num, clienteInput.trim())
                            if (e.key === 'Escape') { setPortaEditando(null); setClienteInput('') }
                          }}
                          placeholder="Nome do cliente"
                          style={{
                            width: '100%', borderRadius: 6, padding: '5px 8px', marginBottom: 6,
                            backgroundColor: 'var(--inp-bg)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--foreground)',
                            fontSize: 13, outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => { if (clienteInput.trim()) salvarCliente(num, clienteInput.trim()) }}
                            disabled={!clienteInput.trim() || saving}
                            style={{
                              flex: 1, background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                              color: '#fff', fontWeight: 700, fontSize: 11,
                              borderRadius: 6, padding: '5px 0', border: 'none', cursor: 'pointer',
                            }}
                          >
                            {saving ? '...' : 'Salvar'}
                          </button>
                          <button
                            onClick={() => { setPortaEditando(null); setClienteInput('') }}
                            style={{
                              flex: 1, border: '1px solid var(--border-color)',
                              color: 'var(--text-muted)', fontSize: 11,
                              borderRadius: 6, padding: '5px 0',
                              backgroundColor: 'transparent', cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>

                    ) : confirmRemover?.num === num ? (
                      <div style={{
                        backgroundColor: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        borderRadius: 10, padding: '10px 12px',
                      }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
                          Remover cliente?
                        </p>
                        <p style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, marginBottom: 8, wordBreak: 'break-word' }}>
                          {confirmRemover.nome}
                        </p>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => salvarCliente(num, null)}
                            disabled={saving}
                            style={{
                              flex: 1, backgroundColor: '#dc2626', color: '#fff',
                              fontWeight: 700, fontSize: 11, borderRadius: 6,
                              padding: '5px 0', border: 'none', cursor: 'pointer',
                            }}
                          >
                            {saving ? '...' : 'Remover'}
                          </button>
                          <button
                            onClick={() => setConfirmRemover(null)}
                            style={{
                              flex: 1, border: '1px solid var(--border-color)',
                              color: 'var(--text-muted)', fontSize: 11,
                              borderRadius: 6, padding: '5px 0',
                              backgroundColor: 'transparent', cursor: 'pointer',
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>

                    ) : (
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
                          backgroundColor: ocupada ? 'rgba(34,197,94,0.1)' : 'var(--inp-bg)',
                          border: `1px solid ${ocupada ? 'rgba(34,197,94,0.4)' : 'var(--border-color)'}`,
                          borderRadius: 10, padding: '10px 12px',
                          textAlign: 'left', cursor: 'pointer', transition: 'opacity 0.15s',
                        }}
                      >
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 3 }}>
                          Porta {num}
                        </p>
                        {ocupada ? (
                          <p style={{ color: '#16a34a', fontSize: 12, fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3 }}>
                            {cliente}
                          </p>
                        ) : (
                          <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            + Adicionar cliente
                          </p>
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
        <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)', fontSize: 13,
              padding: '8px 20px', borderRadius: 8,
              backgroundColor: 'transparent', cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
