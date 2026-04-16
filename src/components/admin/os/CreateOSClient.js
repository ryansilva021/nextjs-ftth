'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createOS } from '@/actions/service-orders'

const GLOBAL_STYLES = `
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-8px) }
  to   { opacity: 1; transform: translateY(0) }
}
`

const INPUT_STYLE = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-color)',
  backgroundColor: '#0d1b2e',
  color: 'var(--foreground)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL_STYLE = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const SECTION_TITLE_STYLE = {
  fontSize: 12,
  fontWeight: 700,
  color: '#60a5fa',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  paddingBottom: 8,
  borderBottom: '1px solid var(--border-color)',
  marginBottom: 16,
  marginTop: 0,
}

const CARD_STYLE = {
  backgroundColor: '#050f1f',
  border: '1px solid var(--border-color)',
  borderRadius: 10,
  padding: '20px 24px',
  marginBottom: 16,
}

const TIPO_OPTIONS = [
  { value: 'instalacao',   label: 'Instalação',   icon: '📶', color: '#22c55e' },
  { value: 'manutencao',   label: 'Manutenção',   icon: '🔧', color: '#f59e0b' },
  { value: 'suporte',      label: 'Suporte',      icon: '💬', color: '#3b82f6' },
  { value: 'cancelamento', label: 'Cancelamento', icon: '✕',  color: '#ef4444' },
]

const PRIO_OPTIONS = [
  { value: 'baixa',   label: 'Baixa',   color: '#6b7280' },
  { value: 'normal',  label: 'Normal',  color: '#94a3b8' },
  { value: 'alta',    label: 'Alta',    color: '#f59e0b' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
]

function FieldRow({ children, cols = 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 12,
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

export default function CreateOSClient({ tecnicos = [], userRole, userName }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [tipo, setTipo] = useState('instalacao')
  const [prioridade, setPrioridade] = useState('normal')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteContato, setClienteContato] = useState('')
  const [clienteEndereco, setClienteEndereco] = useState('')
  const [tecnicoNome, setTecnicoNome] = useState('')
  const [tecnicoId, setTecnicoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataAgendamento, setDataAgendamento] = useState('')

  // Conexão
  const [conexaoLogin, setConexaoLogin] = useState('')
  const [conexaoSenha, setConexaoSenha] = useState('')
  const [conexaoIp, setConexaoIp] = useState('')
  const [conexaoMac, setConexaoMac] = useState('')
  const [conexaoOnuId, setConexaoOnuId] = useState('')

  // Plano
  const [planoNome, setPlanoNome] = useState('')
  const [planoDownload, setPlanoDownload] = useState('')
  const [planoUpload, setPlanoUpload] = useState('')

  const [erro, setErro] = useState(null)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleTecnicoSelect(e) {
    const login = e.target.value
    const chosen = tecnicos.find(t => t.login === login)
    if (chosen) {
      setTecnicoId(chosen.login)   // username — usado para SSE e push filtering
      setTecnicoNome(chosen.nome)
    } else {
      setTecnicoId('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro(null)

    if (!clienteNome.trim()) {
      setErro('Nome do cliente é obrigatório.')
      return
    }

    startTransition(async () => {
      try {
        const result = await createOS({
          tipo,
          prioridade,
          cliente_nome:     clienteNome,
          cliente_contato:  clienteContato,
          cliente_endereco: clienteEndereco,
          tecnico_nome:     tecnicoNome,
          tecnico_id:       tecnicoId,
          descricao,
          data_agendamento: dataAgendamento || null,
          conexao_login:    conexaoLogin,
          conexao_senha:    conexaoSenha,
          conexao_ip:       conexaoIp,
          conexao_mac:      conexaoMac,
          conexao_onu_id:   conexaoOnuId,
          plano_nome:       planoNome,
          plano_download:   planoDownload,
          plano_upload:     planoUpload,
        })
        showToast(`OS ${result.os_id} criada com sucesso!`)
        setTimeout(() => router.push(`/admin/os/${result.os_id}`), 800)
      } catch (err) {
        setErro(err.message ?? 'Erro ao criar OS')
      }
    })
  }

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 8,
          backgroundColor: toast.type === 'error' ? '#450a0a' : '#052e16',
          border: `1px solid ${toast.type === 'error' ? '#7f1d1d' : '#14532d'}`,
          color: toast.type === 'error' ? '#fca5a5' : '#86efac',
          fontSize: 13, fontWeight: 600,
          animation: 'fadeInDown 0.2s ease',
          boxShadow: '0 4px 24px #00000066',
        }}>
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Tipo da OS */}
        <div style={CARD_STYLE}>
          <p style={SECTION_TITLE_STYLE}>Tipo da OS</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TIPO_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTipo(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
                  border: tipo === opt.value
                    ? `2px solid ${opt.color}`
                    : '2px solid var(--border-color)',
                  backgroundColor: tipo === opt.value
                    ? `${opt.color}18`
                    : '#ffffff08',
                  color: tipo === opt.value ? opt.color : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prioridade */}
        <div style={CARD_STYLE}>
          <p style={SECTION_TITLE_STYLE}>Prioridade</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRIO_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrioridade(opt.value)}
                style={{
                  padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                  border: prioridade === opt.value
                    ? `2px solid ${opt.color}`
                    : '2px solid var(--border-color)',
                  backgroundColor: prioridade === opt.value
                    ? `${opt.color}18`
                    : '#ffffff08',
                  color: prioridade === opt.value ? opt.color : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dados do cliente */}
        <div style={CARD_STYLE}>
          <p style={SECTION_TITLE_STYLE}>Dados do Cliente</p>
          <div style={{ marginBottom: 12 }}>
            <label style={LABEL_STYLE}>Nome do Cliente *</label>
            <input
              style={INPUT_STYLE}
              type="text"
              placeholder="Nome completo do cliente"
              value={clienteNome}
              onChange={e => setClienteNome(e.target.value)}
              required
            />
          </div>
          <FieldRow>
            <div>
              <label style={LABEL_STYLE}>Contato / Telefone</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="(99) 99999-9999"
                value={clienteContato}
                onChange={e => setClienteContato(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Data Agendamento</label>
              <input
                style={INPUT_STYLE}
                type="datetime-local"
                value={dataAgendamento}
                onChange={e => setDataAgendamento(e.target.value)}
              />
            </div>
          </FieldRow>
          <div style={{ marginBottom: 12 }}>
            <label style={LABEL_STYLE}>Endereço</label>
            <input
              style={INPUT_STYLE}
              type="text"
              placeholder="Rua, número, bairro, cidade"
              value={clienteEndereco}
              onChange={e => setClienteEndereco(e.target.value)}
            />
          </div>
        </div>

        {/* Técnico responsável */}
        <div style={CARD_STYLE}>
          <p style={SECTION_TITLE_STYLE}>Técnico Responsável</p>
          <FieldRow>
            <div>
              <label style={LABEL_STYLE}>Selecionar Técnico</label>
              <select
                style={INPUT_STYLE}
                onChange={handleTecnicoSelect}
                value={tecnicoId}
              >
                <option value="">— Nenhum selecionado —</option>
                {tecnicos.map(t => (
                  <option key={t.id} value={t.login}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Nome do Técnico (manual)</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="Ou digite o nome manualmente"
                value={tecnicoNome}
                onChange={e => { setTecnicoNome(e.target.value); setTecnicoId('') }}
              />
            </div>
          </FieldRow>
        </div>

        {/* Dados de conexão */}
        <div style={CARD_STYLE}>
          <p style={SECTION_TITLE_STYLE}>Dados de Conexão (opcional)</p>
          <FieldRow>
            <div>
              <label style={LABEL_STYLE}>Login PPPoE / Usuário</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="usuario@provedor"
                value={conexaoLogin}
                onChange={e => setConexaoLogin(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Senha PPPoE</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="Senha de conexão"
                value={conexaoSenha}
                onChange={e => setConexaoSenha(e.target.value)}
              />
            </div>
          </FieldRow>
          <FieldRow cols={3}>
            <div>
              <label style={LABEL_STYLE}>IP Fixo</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="0.0.0.0"
                value={conexaoIp}
                onChange={e => setConexaoIp(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>MAC Address</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="AA:BB:CC:DD:EE:FF"
                value={conexaoMac}
                onChange={e => setConexaoMac(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>ONU ID / Serial</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="ZTEG12345678"
                value={conexaoOnuId}
                onChange={e => setConexaoOnuId(e.target.value)}
              />
            </div>
          </FieldRow>
        </div>

        {/* Plano */}
        <div style={CARD_STYLE}>
          <p style={SECTION_TITLE_STYLE}>Plano Contratado (opcional)</p>
          <FieldRow cols={3}>
            <div>
              <label style={LABEL_STYLE}>Nome do Plano</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="Fibra 300M"
                value={planoNome}
                onChange={e => setPlanoNome(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Download</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="300M"
                value={planoDownload}
                onChange={e => setPlanoDownload(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Upload</label>
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="150M"
                value={planoUpload}
                onChange={e => setPlanoUpload(e.target.value)}
              />
            </div>
          </FieldRow>
        </div>

        {/* Descrição */}
        <div style={CARD_STYLE}>
          <p style={SECTION_TITLE_STYLE}>Descrição / Motivo da OS</p>
          <textarea
            style={{
              ...INPUT_STYLE,
              minHeight: 100,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
            placeholder="Descreva o motivo da abertura, sintomas relatados, observações iniciais..."
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
          />
        </div>

        {/* Erro */}
        {erro && (
          <div style={{
            backgroundColor: '#450a0a', border: '1px solid #7f1d1d',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            fontSize: 13, color: '#fca5a5',
          }}>
            {erro}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingBottom: 40 }}>
          <a
            href="/admin/os"
            style={{
              padding: '10px 24px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid var(--border-color)', backgroundColor: 'transparent',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: '10px 28px', borderRadius: 7, cursor: isPending ? 'not-allowed' : 'pointer',
              border: 'none', backgroundColor: isPending ? '#1e40af88' : '#1d4ed8',
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending && (
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid #ffffff44',
                borderTopColor: '#fff',
                animation: 'spin 0.7s linear infinite',
                display: 'inline-block',
              }} />
            )}
            {isPending ? 'Salvando...' : 'Abrir OS'}
          </button>
        </div>
      </form>
    </>
  )
}
