'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { checkLoginDisponivel, criarRegistro } from '@/actions/registros'

// ---------------------------------------------------------------------------
// Configuração dos planos
// ---------------------------------------------------------------------------
const PLANOS = [
  {
    id: 'starter',
    nome: 'Starter',
    preco: 'R$ 49',
    periodo: '/mês',
    trial: '15 dias grátis',
    descricao: 'Para ISPs iniciando a gestão digital',
    cor: '#0369a1',
    corBg: '#0c2340',
    destaque: false,
    features: [
      '200 CTOs cadastradas',
      '3 técnicos de campo',
      'Mapa interativo offline',
      'Diagrama de fibra',
      'Suporte por email',
    ],
    limiteLabel: '200 CTOs',
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$ 99',
    periodo: '/mês',
    trial: '30 dias grátis',
    descricao: 'O mais escolhido pelos ISPs regionais',
    cor: '#7c3aed',
    corBg: '#1e1040',
    destaque: true,
    features: [
      '500 CTOs cadastradas',
      '10 técnicos de campo',
      'Mapa interativo offline',
      'Diagrama de fibra avançado',
      'Gestão de postes e rotas',
      'Relatórios de movimentação',
      'Suporte prioritário',
    ],
    limiteLabel: '500 CTOs',
  },
  {
    id: 'enterprise',
    nome: 'Enterprise',
    preco: 'R$ 249',
    periodo: '/mês',
    trial: '30 dias grátis',
    descricao: 'Para grandes operadoras e ISPs com múltiplas regiões',
    cor: '#0d9488',
    corBg: '#042f2e',
    destaque: false,
    features: [
      'CTOs ilimitadas',
      'Técnicos ilimitados',
      'Mapa interativo offline',
      'Diagrama de fibra avançado',
      'Gestão completa de rede',
      'API de integração',
      'SLA 99,9% de disponibilidade',
      'Gerente de conta dedicado',
    ],
    limiteLabel: 'Ilimitado',
  },
]

// ---------------------------------------------------------------------------
// Features do sistema (marketing)
// ---------------------------------------------------------------------------
const FEATURES_SISTEMA = [
  { icon: '🗺️', texto: 'Mapa offline para uso em campo' },
  { icon: '🔌', texto: 'Gestão completa de CTOs e fibras' },
  { icon: '👥', texto: 'Controle de equipe por função' },
  { icon: '📊', texto: 'Histórico e relatórios de rede' },
]

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function CadastroPage() {
  const [passo, setPasso] = useState(1)
  const [plano, setPlano] = useState('pro')
  const [empresa, setEmpresa] = useState('')
  const [username, setUsername] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [verificandoLogin, setVerificandoLogin] = useState(false)
  const [loginDisponivel, setLoginDisponivel] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)

  const planoSelecionado = PLANOS.find((p) => p.id === plano) ?? PLANOS[1]

  async function verificarLogin(valor) {
    if (!valor || valor.length < 3) { setLoginDisponivel(null); return }
    setVerificandoLogin(true)
    try {
      const res = await checkLoginDisponivel(valor)
      setLoginDisponivel(res.disponivel)
    } catch {
      setLoginDisponivel(null)
    } finally {
      setVerificandoLogin(false)
    }
  }

  async function handleSubmit() {
    setErro(null)
    setEnviando(true)
    try {
      const res = await criarRegistro({ username, password: senha, empresa, plano, nome_completo: empresa })
      setResultado(res)
      setPasso(5)
    } catch (e) {
      setErro(e.message || 'Erro ao enviar cadastro.')
    } finally {
      setEnviando(false)
    }
  }

  function avancar() { setErro(null); setPasso((p) => p + 1) }
  function voltar()   { setErro(null); setPasso((p) => p - 1) }

  // Força a senha a ter alguma complexidade para o indicador
  function forcaSenha(s) {
    if (!s) return 0
    let score = 0
    if (s.length >= 6)  score++
    if (s.length >= 10) score++
    if (/[A-Z]/.test(s)) score++
    if (/[0-9]/.test(s)) score++
    if (/[^A-Za-z0-9]/.test(s)) score++
    return score
  }
  const forca = forcaSenha(senha)
  const forcaLabel = ['', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Muito forte'][forca] ?? ''
  const forcaCor   = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'][forca] ?? ''

  return (
    <div className="w-full max-w-lg px-4 py-8">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-2">
          <Image src="/long-logo.svg" alt="FiberOps" width={160} height={40} priority />
        </div>
        <p className="text-sm text-slate-400">
          Plataforma de gestão de redes FTTH para ISPs
        </p>
      </div>

      {/* Card principal */}
      <div
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        className="rounded-2xl overflow-hidden"
      >
        {/* Barra de progresso */}
        {passo <= 4 && (
          <div style={{ backgroundColor: 'var(--card-bg-active)', borderBottom: '1px solid var(--border-color)' }} className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">
                {['', 'Escolha o plano', 'Dados da empresa', 'Credenciais de acesso', 'Confirmar'][passo]}
              </span>
              <span className="text-xs text-slate-500">{passo} de 4</span>
            </div>
            <div className="w-full h-1 rounded-full" style={{ backgroundColor: 'var(--border-color)' }}>
              <div
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: `${(passo / 4) * 100}%`,
                  background: 'linear-gradient(90deg, #0284c7, #7c3aed)',
                }}
              />
            </div>
          </div>
        )}

        <div className="p-6">

          {/* ─── Passo 1: Plano ─── */}
          {passo === 1 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Escolha seu plano</h2>
              <p className="text-sm text-slate-400 mb-5">
                Todos os planos começam com período de teste grátis. Sem cartão de crédito.
              </p>

              <div className="flex flex-col gap-3 mb-5">
                {PLANOS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlano(p.id)}
                    style={{
                      backgroundColor: plano === p.id ? p.corBg : 'var(--background)',
                      border: `1px solid ${plano === p.id ? p.cor : 'var(--border-color)'}`,
                      boxShadow: plano === p.id ? `0 0 0 1px ${p.cor}40` : 'none',
                    }}
                    className="rounded-xl p-4 text-left transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white">{p.nome}</span>
                          {p.destaque && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ backgroundColor: `${p.cor}30`, color: p.cor === '#7c3aed' ? '#a78bfa' : p.cor }}
                            >
                              Mais popular
                            </span>
                          )}
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto"
                            style={{ backgroundColor: '#052e16', color: '#4ade80' }}
                          >
                            {p.trial}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{p.descricao}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {p.features.slice(0, 3).map((f) => (
                            <span key={f} className="text-xs text-slate-500 flex items-center gap-1">
                              <span style={{ color: p.cor }}>✓</span> {f}
                            </span>
                          ))}
                          {p.features.length > 3 && (
                            <span className="text-xs text-slate-600">+{p.features.length - 3} mais</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-white">{p.preco}</div>
                        <div className="text-xs text-slate-500">{p.periodo}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Features do sistema */}
              <div
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border-color)' }}
                className="rounded-xl p-4 mb-5"
              >
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">
                  Incluso em todos os planos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FEATURES_SISTEMA.map((f) => (
                    <div key={f.texto} className="flex items-center gap-2">
                      <span>{f.icon}</span>
                      <span className="text-xs text-slate-400">{f.texto}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={avancar}
                className="w-full text-white font-bold py-3 rounded-xl text-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #0284c7, #7c3aed)' }}
              >
                Começar com plano {planoSelecionado.nome} →
              </button>
            </div>
          )}

          {/* ─── Passo 2: Empresa ─── */}
          {passo === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${planoSelecionado.cor}20`, color: planoSelecionado.cor }}
                >
                  🏢
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Dados da empresa</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Plano {planoSelecionado.nome} · {planoSelecionado.trial}</p>
                </div>
              </div>

              <div className="flex flex-col gap-1 mb-5">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Nome da empresa ou ISP *
                </label>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Ex: Fibra Rápida Telecom"
                  style={{ backgroundColor: 'var(--inp-bg)', border: `1px solid ${empresa ? planoSelecionado.cor + '60' : 'var(--border-color)'}`, color: 'var(--foreground)' }}
                  className="rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 placeholder-slate-600"
                  autoFocus
                />
                <p className="text-xs text-slate-600 mt-1">
                  Será o nome do seu espaço de trabalho na plataforma.
                </p>
              </div>

              {/* Card do plano selecionado */}
              <div
                style={{ backgroundColor: planoSelecionado.corBg, border: `1px solid ${planoSelecionado.cor}50` }}
                className="rounded-xl p-3 mb-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: planoSelecionado.cor === '#7c3aed' ? '#a78bfa' : planoSelecionado.cor }}>
                      Plano {planoSelecionado.nome} selecionado
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {planoSelecionado.limiteLabel} · {planoSelecionado.trial}
                    </p>
                  </div>
                  <button
                    onClick={voltar}
                    className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={voltar}
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                  className="px-4 hover:bg-slate-800 font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={avancar}
                  disabled={!empresa.trim() || empresa.trim().length < 2}
                  className="flex-1 text-white font-bold py-3 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #7c3aed)' }}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ─── Passo 3: Credenciais ─── */}
          {passo === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${planoSelecionado.cor}20`, color: planoSelecionado.cor }}
                >
                  🔐
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Credenciais de acesso</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Você será o admin da conta</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 mb-5">
                {/* Username */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Nome de usuário *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setLoginDisponivel(null) }}
                      onBlur={(e) => verificarLogin(e.target.value)}
                      placeholder="ex: joao.silva"
                      style={{
                        backgroundColor: 'var(--inp-bg)',
                        border: `1px solid ${loginDisponivel === true ? '#22c55e60' : loginDisponivel === false ? '#ef444460' : 'var(--border-color)'}`,
                        color: 'var(--foreground)',
                      }}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none pr-10 placeholder-slate-600"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base">
                      {verificandoLogin && <span className="text-slate-500 text-sm">...</span>}
                      {!verificandoLogin && loginDisponivel === true  && '✅'}
                      {!verificandoLogin && loginDisponivel === false && '❌'}
                    </span>
                  </div>
                  {loginDisponivel === false && <p className="text-xs text-red-400">Usuário já em uso. Tente outro.</p>}
                  {loginDisponivel === true  && <p className="text-xs text-green-400">Disponível!</p>}
                  <p className="text-xs text-slate-600">Apenas letras minúsculas, números e _ . -</p>
                </div>

                {/* Senha */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Senha *
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="mínimo 6 caracteres"
                      style={{ backgroundColor: 'var(--inp-bg)', border: '1px solid var(--border-color)', color: 'var(--foreground)' }}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none pr-12 placeholder-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                    >
                      {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  {/* Indicador de força */}
                  {senha.length > 0 && (
                    <div>
                      <div className="flex gap-1 mt-1.5">
                        {[1,2,3,4,5].map((n) => (
                          <div
                            key={n}
                            className="flex-1 h-1 rounded-full transition-all"
                            style={{ backgroundColor: n <= forca ? forcaCor : 'var(--border-color)' }}
                          />
                        ))}
                      </div>
                      <p className="text-xs mt-1" style={{ color: forcaCor }}>{forcaLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirmar senha */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Confirmar senha *
                  </label>
                  <input
                    type="password"
                    value={senhaConfirm}
                    onChange={(e) => setSenhaConfirm(e.target.value)}
                    placeholder="repita a senha"
                    style={{
                      backgroundColor: 'var(--inp-bg)',
                      border: `1px solid ${senhaConfirm && senha === senhaConfirm ? '#22c55e60' : senhaConfirm ? '#ef444460' : 'var(--border-color)'}`,
                      color: 'var(--foreground)',
                    }}
                    className="rounded-xl px-4 py-3 text-sm focus:outline-none placeholder-slate-600"
                  />
                  {senhaConfirm && senha !== senhaConfirm && (
                    <p className="text-xs text-red-400">As senhas não coincidem.</p>
                  )}
                </div>
              </div>

              {erro && (
                <div
                  style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                  className="rounded-xl px-4 py-3 text-sm text-red-400 mb-4"
                >
                  {erro}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={voltar}
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                  className="px-4 hover:bg-slate-800 font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={avancar}
                  disabled={
                    !username.trim() ||
                    loginDisponivel !== true ||
                    senha.length < 6 ||
                    senha !== senhaConfirm
                  }
                  className="flex-1 text-white font-bold py-3 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #7c3aed)' }}
                >
                  Revisar e enviar →
                </button>
              </div>
            </div>
          )}

          {/* ─── Passo 4: Confirmação ─── */}
          {passo === 4 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-emerald-900/50 text-emerald-400">
                  ✓
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-none">Tudo pronto!</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Revise e confirme sua solicitação</p>
                </div>
              </div>

              {/* Resumo */}
              <div
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border-color)' }}
                className="rounded-xl p-4 mb-4"
              >
                <div className="flex flex-col gap-3">
                  <SummaryRow label="Plano" value={
                    <span className="flex items-center gap-2">
                      <span>{planoSelecionado.nome}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#052e16', color: '#4ade80' }}
                      >
                        {planoSelecionado.trial}
                      </span>
                    </span>
                  } />
                  <SummaryRow label="Empresa" value={empresa} />
                  <SummaryRow label="Usuário admin" value={<span className="font-mono text-sky-400">{username}</span>} />
                  <SummaryRow label="CTOs incluídas" value={planoSelecionado.limiteLabel} />
                </div>
              </div>

              {/* Features do plano */}
              <div
                style={{ backgroundColor: planoSelecionado.corBg, border: `1px solid ${planoSelecionado.cor}40` }}
                className="rounded-xl p-4 mb-4"
              >
                <p className="text-xs font-semibold mb-2" style={{ color: planoSelecionado.cor === '#7c3aed' ? '#a78bfa' : planoSelecionado.cor }}>
                  O que você vai receber no plano {planoSelecionado.nome}
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {planoSelecionado.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: planoSelecionado.cor === '#7c3aed' ? '#a78bfa' : planoSelecionado.cor }}>✓</span>
                      <span className="text-xs text-slate-300">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{ backgroundColor: '#0c2340', border: '1px solid #0369a1' }}
                className="rounded-xl px-4 py-3 text-xs text-sky-300 mb-4"
              >
                Após o envio, o superadmin irá analisar e liberar seu acesso.
                Você receberá o papel de <strong>administrador</strong> da conta.
              </div>

              {erro && (
                <div
                  style={{ backgroundColor: '#450a0a', border: '1px solid #7f1d1d' }}
                  className="rounded-xl px-4 py-3 text-sm text-red-400 mb-4"
                >
                  {erro}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={voltar}
                  disabled={enviando}
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                  className="px-4 hover:bg-slate-800 disabled:opacity-40 font-semibold py-3 rounded-xl text-sm transition-colors"
                >
                  ←
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={enviando}
                  className="flex-1 text-white font-bold py-3 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #7c3aed)' }}
                >
                  {enviando ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    '🚀 Enviar solicitação'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ─── Passo 5: Sucesso ─── */}
          {passo === 5 && resultado && (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: 'linear-gradient(135deg, #052e16, #064e3b)' }}
              >
                ✅
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Solicitação enviada!</h2>
              <p className="text-sm text-slate-400 mb-1">
                A empresa <strong className="text-white">{empresa}</strong> está aguardando aprovação.
              </p>
              <p className="text-xs text-slate-500 mb-6">
                Plano <strong className="text-slate-400">{planoSelecionado.nome}</strong> · login:{' '}
                <span className="font-mono text-sky-400">{username}</span>
              </p>

              <div
                style={{ backgroundColor: '#0c2340', border: '1px solid #0369a1' }}
                className="rounded-xl px-4 py-4 mb-6 text-left"
              >
                <p className="text-xs font-semibold text-sky-400 mb-2">Próximos passos:</p>
                <ol className="text-xs text-slate-400 flex flex-col gap-1.5">
                  <li className="flex items-start gap-2"><span className="text-sky-500 font-bold mt-0.5">1.</span> O superadmin aprova sua conta e cria seu espaço de trabalho</li>
                  <li className="flex items-start gap-2"><span className="text-sky-500 font-bold mt-0.5">2.</span> Você recebe acesso como admin e faz login</li>
                  <li className="flex items-start gap-2"><span className="text-sky-500 font-bold mt-0.5">3.</span> Cadastre sua equipe e comece a mapear sua rede</li>
                </ol>
              </div>

              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-white font-bold py-3 px-8 rounded-xl text-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #0284c7, #7c3aed)' }}
              >
                Ir para o login →
              </Link>
            </div>
          )}

        </div>
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        Já tem conta?{' '}
        <Link href="/login" className="text-sky-400 hover:text-sky-300 transition-colors font-medium">
          Entrar
        </Link>
      </p>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-white font-medium text-right">{value}</span>
    </div>
  )
}
