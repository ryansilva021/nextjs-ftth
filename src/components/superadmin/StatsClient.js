'use client'

const cardStyle = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-color-strong)',
}

const CARDS = [
  {
    key: 'projetos',
    label: 'Projetos',
    emoji: '🏢',
    descricao: 'Tenants cadastrados',
    cor: '#818cf8', // indigo
  },
  {
    key: 'olts',
    label: 'OLTs',
    emoji: '🖥️',
    descricao: 'Optical Line Terminals',
    cor: '#38bdf8', // sky
  },
  {
    key: 'caixas',
    label: 'CDOs / CEs',
    emoji: '📦',
    descricao: 'Caixas de Emenda / Distribuição',
    cor: '#fbbf24', // amber
  },
  {
    key: 'ctos',
    label: 'CTOs',
    emoji: '📡',
    descricao: 'Caixas de Terminação Óptica',
    cor: '#34d399', // emerald
  },
  {
    key: 'rotas',
    label: 'Rotas',
    emoji: '🗺️',
    descricao: 'Traçados de fibra óptica',
    cor: '#a78bfa', // violet
  },
  {
    key: 'postes',
    label: 'Postes',
    emoji: '🪵',
    descricao: 'Postes de infraestrutura',
    cor: '#f97316', // orange
  },
  {
    key: 'movimentacoes',
    label: 'Movimentações',
    emoji: '📋',
    descricao: 'Instalações e remoções',
    cor: '#f472b6', // pink
  },
  {
    key: 'usuarios',
    label: 'Usuários',
    emoji: '👤',
    descricao: 'Contas de acesso',
    cor: '#2dd4bf', // teal
  },
]

function StatCard({ label, emoji, descricao, valor, cor }) {
  return (
    <div
      style={cardStyle}
      className="rounded-xl p-5 flex flex-col gap-3 hover:bg-slate-700/50 transition-colors"
    >
      {/* Ícone e label */}
      <div className="flex items-center justify-between">
        <span className="text-2xl" role="img" aria-label={label}>
          {emoji}
        </span>
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: cor }}
        >
          {label}
        </span>
      </div>

      {/* Número principal */}
      <div>
        <p
          className="text-4xl font-bold tabular-nums"
          style={{ color: cor }}
        >
          {valor.toLocaleString('pt-BR')}
        </p>
        <p className="text-xs text-slate-500 mt-1">{descricao}</p>
      </div>
    </div>
  )
}

export default function StatsClient({ stats }) {
  const total = Object.values(stats).reduce((acc, v) => acc + v, 0)

  return (
    <>
      {/* Resumo geral */}
      <div
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        className="rounded-xl px-5 py-4 mb-6 flex items-center gap-4"
      >
        <div>
          <p className="text-3xl font-bold text-white tabular-nums">
            {total.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Total de registros em todas as coleções
          </p>
        </div>
        <div
          style={{ width: 1, backgroundColor: 'var(--border-color)' }}
          className="self-stretch mx-2"
        />
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {CARDS.map((c) => (
            <div key={c.key} className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: c.cor }}>
                {c.label}:
              </span>
              <span className="text-xs font-semibold text-white tabular-nums">
                {(stats[c.key] ?? 0).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {CARDS.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            emoji={c.emoji}
            descricao={c.descricao}
            valor={stats[c.key] ?? 0}
            cor={c.cor}
          />
        ))}
      </div>
    </>
  )
}
