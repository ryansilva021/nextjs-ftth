'use client'

import { useState, useTransition } from 'react'
import { linkTopologia } from '@/actions/olts'

const cardStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
}

const cardInnerStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border-color)',
}

const cardLeafStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
}

const inputStyle = {
  backgroundColor: 'var(--inp-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--foreground)',
}

const modalBgStyle = {
  backgroundColor: 'rgba(0,0,0,0.7)',
}

const TIPOS_ORIGEM = [
  { value: 'cdo', label: 'CDO / CE (vincular à OLT)' },
  { value: 'cto', label: 'CTO (vincular ao CDO)' },
]

const TIPOS_DESTINO = {
  cdo: 'olt',
  cto: 'cdo',
}

function BadgeTipo({ tipo }) {
  const cor =
    tipo === 'CDO'
      ? { backgroundColor: '#172554', color: '#93c5fd' }
      : { backgroundColor: '#14532d', color: '#86efac' }
  return (
    <span
      style={cor}
      className="text-xs font-mono px-2 py-0.5 rounded-full"
    >
      {tipo ?? 'CDO'}
    </span>
  )
}

function CTONode({ cto }) {
  return (
    <div
      style={cardLeafStyle}
      className="rounded-lg px-3 py-2 flex items-center gap-2"
    >
      <span className="text-xs text-slate-500">CTO</span>
      <span className="text-xs font-mono text-sky-400">{cto.cto_id}</span>
      {cto.nome && (
        <span className="text-xs text-slate-400 truncate">{cto.nome}</span>
      )}
      {cto.capacidade > 0 && (
        <span className="ml-auto text-xs text-slate-500">
          {cto.capacidade} portas
        </span>
      )}
    </div>
  )
}

function CDONode({ caixa }) {
  const [expandido, setExpandido] = useState(true)

  return (
    <div style={cardInnerStyle} className="rounded-lg p-3">
      {/* Header CDO */}
      <button
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setExpandido((v) => !v)}
      >
        <span
          className="text-slate-500 text-xs select-none"
          style={{ minWidth: 12 }}
        >
          {expandido ? '▼' : '▶'}
        </span>
        <BadgeTipo tipo={caixa.tipo} />
        <span className="text-xs font-mono text-amber-400">
          {caixa.ce_id ?? caixa.id}
        </span>
        {caixa.nome && (
          <span className="text-xs text-slate-400 truncate">{caixa.nome}</span>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {caixa.ctos?.length ?? 0} CTO{caixa.ctos?.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* CTOs filhas */}
      {expandido && caixa.ctos?.length > 0 && (
        <div className="mt-3 pl-4 flex flex-col gap-2">
          {caixa.ctos.map((cto) => (
            <CTONode key={cto._id} cto={cto} />
          ))}
        </div>
      )}

      {expandido && (!caixa.ctos || caixa.ctos.length === 0) && (
        <p className="mt-2 pl-4 text-xs text-slate-600 italic">
          Nenhuma CTO vinculada a este CDO.
        </p>
      )}
    </div>
  )
}

export default function TopologiaClient({ arvoreInicial, projetoId, userRole }) {
  const [arvore, setArvore] = useState(arvoreInicial)
  const [modalAberto, setModalAberto] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(null)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    tipo_origem: 'cto',
    id_origem: '',
    id_destino: '',
    porta: '',
  })

  function abrirModal() {
    setForm({ tipo_origem: 'cto', id_origem: '', id_destino: '', porta: '' })
    setErro(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setErro(null)
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleVincular() {
    setErro(null)
    if (!form.id_origem.trim() || !form.id_destino.trim()) {
      setErro('Preencha o ID de origem e o ID de destino.')
      return
    }

    startTransition(async () => {
      try {
        await linkTopologia({
          projeto_id: projetoId,
          tipo_origem: form.tipo_origem,
          id_origem: form.id_origem.trim(),
          tipo_destino: TIPOS_DESTINO[form.tipo_origem],
          id_destino: form.id_destino.trim(),
          porta: form.porta ? parseInt(form.porta) : null,
        })

        setSucesso('Vínculo registrado com sucesso. Recarregue a página para ver a árvore atualizada.')
        setTimeout(() => setSucesso(null), 5000)
        fecharModal()
      } catch (e) {
        setErro(e.message)
      }
    })
  }

  const totalCaixas = arvore.reduce((acc, olt) => acc + (olt.caixas?.length ?? 0), 0)
  const totalCtos = arvore.reduce(
    (acc, olt) =>
      acc + (olt.caixas?.reduce((a, c) => a + (c.ctos?.length ?? 0), 0) ?? 0),
    0
  )

  const semVinculos = arvore.length === 0 || (totalCaixas === 0 && totalCtos === 0)

  return (
    <>
      {/* Barra de ações */}
      <div className="flex items-center justify-between mb-4">
        {sucesso ? (
          <p className="text-sm text-green-400">{sucesso}</p>
        ) : (
          <p className="text-xs text-slate-500">
            {arvore.length} OLT{arvore.length !== 1 ? 's' : ''} —{' '}
            {totalCaixas} CDO{totalCaixas !== 1 ? 's' : ''} —{' '}
            {totalCtos} CTO{totalCtos !== 1 ? 's' : ''}
          </p>
        )}
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <button
            onClick={abrirModal}
            className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Vincular elementos
          </button>
        )}
      </div>

      {/* Estado vazio */}
      {semVinculos && (
        <div
          style={cardStyle}
          className="rounded-xl px-6 py-14 text-center"
        >
          <p className="text-slate-400 text-sm font-medium mb-1">
            Nenhum vínculo configurado
          </p>
          <p className="text-slate-600 text-xs max-w-sm mx-auto">
            Use o botão "Vincular elementos" para associar CDOs às OLTs e CTOs aos CDOs,
            construindo a hierarquia da rede.
          </p>
        </div>
      )}

      {/* Árvore de topologia */}
      {!semVinculos && (
        <div className="flex flex-col gap-4">
          {arvore.map((olt) => (
            <div key={olt._id} style={cardStyle} className="rounded-xl p-4">
              {/* OLT Header */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  style={{ backgroundColor: '#1e1b4b', border: '1px solid #3730a3' }}
                  className="rounded-lg px-3 py-1.5 flex items-center gap-2"
                >
                  <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                    OLT
                  </span>
                  <span className="text-sm font-mono text-indigo-200">
                    {olt.olt_id ?? olt.id}
                  </span>
                </div>
                {olt.nome && (
                  <span className="text-sm text-white font-medium">{olt.nome}</span>
                )}
                {olt.ip && (
                  <span className="text-xs font-mono text-slate-400">
                    {olt.ip}
                  </span>
                )}
                {olt.modelo && (
                  <span className="text-xs text-slate-500">{olt.modelo}</span>
                )}
                <span className="ml-auto text-xs text-slate-500">
                  {olt.caixas?.length ?? 0} CDO{olt.caixas?.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* CDOs e CTOs */}
              {olt.caixas?.length > 0 ? (
                <div className="pl-4 flex flex-col gap-3">
                  {olt.caixas.map((caixa) => (
                    <CDONode key={caixa._id} caixa={caixa} />
                  ))}
                </div>
              ) : (
                <p className="pl-4 text-xs text-slate-600 italic">
                  Nenhum CDO vinculado a esta OLT.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CTOs sem vínculo (se OLTs existem mas sem caixas, já avisado acima por olt) */}

      {/* Modal Vincular */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={modalBgStyle}
        >
          <div style={cardStyle} className="rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-white mb-5">
              Vincular Elementos da Topologia
            </h2>

            <div className="flex flex-col gap-4 mb-4">
              {/* Tipo de vínculo */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  Tipo de vínculo
                </label>
                <select
                  name="tipo_origem"
                  value={form.tipo_origem}
                  onChange={handleFormChange}
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {TIPOS_ORIGEM.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ID de origem */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  {form.tipo_origem === 'cto' ? 'ID da CTO (origem)' : 'ID do CDO / CE (origem)'}
                </label>
                <input
                  name="id_origem"
                  value={form.id_origem}
                  onChange={handleFormChange}
                  placeholder={
                    form.tipo_origem === 'cto' ? 'ex: CTO-001' : 'ex: CDO-001'
                  }
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* ID de destino */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  {form.tipo_origem === 'cto'
                    ? 'ID do CDO destino (pai)'
                    : 'ID da OLT destino (pai)'}
                </label>
                <input
                  name="id_destino"
                  value={form.id_destino}
                  onChange={handleFormChange}
                  placeholder={
                    form.tipo_origem === 'cto' ? 'ex: CDO-001' : 'ex: OLT-CENTRAL'
                  }
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Porta */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wider">
                  Porta no elemento pai (opcional)
                </label>
                <input
                  name="porta"
                  value={form.porta}
                  onChange={handleFormChange}
                  type="number"
                  min="1"
                  placeholder="ex: 1"
                  style={inputStyle}
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Resumo do vínculo */}
            <div
              style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)' }}
              className="rounded-lg px-4 py-3 text-xs text-slate-400 mb-4"
            >
              <span className="font-mono text-sky-400">
                {form.id_origem || '(origem)'}
              </span>
              <span className="mx-2 text-slate-600">→</span>
              <span className="font-mono text-amber-400">
                {form.id_destino || '(destino)'}
              </span>
              {form.porta && (
                <span className="text-slate-500 ml-2">porta {form.porta}</span>
              )}
            </div>

            {erro && (
              <div
                style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                className="rounded-lg px-4 py-3 text-sm text-red-400 mb-4"
              >
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={fecharModal}
                disabled={isPending}
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                className="px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleVincular}
                disabled={isPending || !form.id_origem.trim() || !form.id_destino.trim()}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? 'Vinculando...' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
