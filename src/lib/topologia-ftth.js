/**
 * src/lib/topologia-ftth.js
 * Utilitários para validação, criação automática e organização da topologia FTTH (PON).
 *
 * Topologia válida:
 *   OLT → CEO/CDO → (bandeja/fusões) → Splitter → CTO → Cliente
 */

// ─── Conexões permitidas por tipo de nó origem ────────────────────────────────

const CONEXOES_VALIDAS = {
  olt:      ['cdo', 'ce'],
  cdo:      ['splitter', 'cto', 'cdo', 'ce'],   // CDO→CTO: saída direta da bandeja
  ce:       ['splitter', 'cto', 'cdo', 'ce'],
  splitter: ['cto'],
  cto:      [],       // CTO não origina conexões de rede
  cliente:  [],       // cliente não pode originar conexões
  bandeja:  [],       // bandeja é apenas visual — nunca é nó de rede
}

// ─── Mensagens de erro para conexões proibidas ───────────────────────────────

const MOTIVOS_INVALIDOS = {
  'bandeja→*':         'Bandeja não é nó de rede — não origina conexões topológicas.',
  'cliente→*':         'Cliente não origina conexões — só recebe sinal da CTO.',
  'splitter→splitter': 'Splitter → Splitter é proibido na topologia PON.',
  'cto→cto':           'CTO → CTO é proibido. CTOs só recebem sinal do splitter.',
  'cto→*':             'CTO não origina conexões. Somente recebe sinal do splitter.',
  'splitter→cdo':      'Splitter não se conecta a CDO/CEO. Fluxo: CDO → Splitter → CTO.',
  'splitter→olt':      'Splitter não se conecta à OLT.',
}

/**
 * Valida se uma conexão entre dois tipos de nó é topologicamente válida.
 *
 * @param {'olt'|'cdo'|'ce'|'splitter'|'cto'|'cliente'|'bandeja'} tipoOrigem
 * @param {'olt'|'cdo'|'ce'|'splitter'|'cto'|'cliente'|'bandeja'} tipoDestino
 * @returns {{ valido: boolean, motivo: string }}
 */
export function validarConexao(tipoOrigem, tipoDestino) {
  const permitidos = CONEXOES_VALIDAS[tipoOrigem] ?? []
  const valido = permitidos.includes(tipoDestino)

  if (valido) return { valido: true, motivo: '' }

  // Lookup de mensagem específica
  const chave = `${tipoOrigem}→${tipoDestino}`
  const chaveGenerico = `${tipoOrigem}→*`
  const motivo =
    MOTIVOS_INVALIDOS[chave] ??
    MOTIVOS_INVALIDOS[chaveGenerico] ??
    `Conexão ${tipoOrigem} → ${tipoDestino} inválida na topologia PON FTTH.`

  return { valido: false, motivo }
}

// ─── Criação automática de fusão ─────────────────────────────────────────────

let _fusaoCounter = Date.now()

function uid() {
  return `f-${(++_fusaoCounter).toString(36)}`
}

/**
 * Cria um objeto de fusão padronizado.
 *
 * @param {object} opts
 * @param {number}  [opts.fibraEntrada=1]  Índice ABNT da fibra de entrada (1-12)
 * @param {number}  [opts.tuboEntrada=1]   Tubo da fibra de entrada
 * @param {number}  [opts.fibraSaida=1]    Índice ABNT da fibra de saída (1-12)
 * @param {number}  [opts.tuboSaida=1]     Tubo da fibra de saída
 * @param {'fusao'|'pon'|'conector'|'passthrough'|'saida_cto'|'saida_cdo'} [opts.tipo='fusao']
 * @param {string|null}  [opts.splitter_id]  ID do splitter vinculado (para tipo='pon')
 * @param {string|null}  [opts.destino_id]   ID do CTO/CDO destino (para tipo='saida_cto'/'saida_cdo')
 * @param {number|null}  [opts.pon_placa]
 * @param {number|null}  [opts.pon_porta]
 * @param {number|null}  [opts.porta_dio]
 * @param {string}       [opts.obs='']
 * @returns {object} Objeto de fusão
 */
export function criarFusaoAuto({
  fibraEntrada = 1,
  tuboEntrada  = 1,
  fibraSaida   = 1,
  tuboSaida    = 1,
  tipo         = 'fusao',
  splitter_id  = null,
  destino_id   = null,
  pon_placa    = null,
  pon_porta    = null,
  porta_dio    = null,
  obs          = '',
} = {}) {
  return {
    id:         uid(),
    entrada:    { fibra: fibraEntrada, tubo: tuboEntrada },
    saida:      { fibra: fibraSaida,   tubo: tuboSaida },
    tipo,
    splitter_id,
    destino_id,
    pon_placa,
    pon_porta,
    porta_dio,
    obs,
  }
}

/**
 * Cria automaticamente a fusão correta para uma conexão CDO → Splitter.
 * Usa a próxima fibra disponível na bandeja.
 *
 * @param {Array}  fusoesExistentes  Fusões já presentes na bandeja
 * @param {string} splitter_id       ID do splitter destino
 * @param {number} [pon_placa]
 * @param {number} [pon_porta]
 * @returns {object} Nova fusão tipo 'pon'
 */
export function criarFusaoPON(fusoesExistentes, splitter_id, pon_placa = null, pon_porta = null) {
  const usadas = new Set(fusoesExistentes.map(f => f.entrada?.fibra).filter(Boolean))
  let proxFibra = 1
  while (usadas.has(proxFibra) && proxFibra <= 12) proxFibra++

  return criarFusaoAuto({
    fibraEntrada: proxFibra,
    fibraSaida:   proxFibra,
    tipo:         'pon',
    splitter_id,
    pon_placa,
    pon_porta,
  })
}

/**
 * Cria automaticamente a fusão para saída direta da bandeja → CTO.
 *
 * @param {Array}  fusoesExistentes
 * @param {string} destino_id  CTO_id destino
 * @returns {object} Nova fusão tipo 'saida_cto'
 */
export function criarFusaoSaidaCTO(fusoesExistentes, destino_id) {
  const usadas = new Set(fusoesExistentes.map(f => f.entrada?.fibra).filter(Boolean))
  let proxFibra = 1
  while (usadas.has(proxFibra) && proxFibra <= 12) proxFibra++

  return criarFusaoAuto({
    fibraEntrada: proxFibra,
    fibraSaida:   proxFibra,
    tipo:         'saida_cto',
    destino_id,
  })
}

// ─── Auto-layout de fusões em grid ───────────────────────────────────────────

const BANDEJA_COLS   = 4   // colunas no grid de fusões
const BANDEJA_ROW_H  = 26  // altura de cada linha (px)
const BANDEJA_COL_W  = 110 // largura de cada coluna (px)
const BANDEJA_PAD    = 12  // padding do grid (px)

/**
 * Calcula posições x,y para cada fusão organizando-as em grid.
 *
 * @param {Array} fusoes
 * @returns {Array} Fusões com campo `posicao: { x, y }`
 */
export function organizarFusoes(fusoes) {
  return fusoes.map((f, i) => ({
    ...f,
    posicao: {
      x: BANDEJA_PAD + (i % BANDEJA_COLS) * BANDEJA_COL_W,
      y: BANDEJA_PAD + Math.floor(i / BANDEJA_COLS) * BANDEJA_ROW_H,
    },
  }))
}

/**
 * Calcula a altura total necessária para o canvas da bandeja.
 *
 * @param {number} qtdFusoes
 * @returns {number} Altura em px
 */
export function alturaCanvasBandeja(qtdFusoes) {
  const linhas = Math.ceil(qtdFusoes / BANDEJA_COLS)
  return BANDEJA_PAD * 2 + linhas * BANDEJA_ROW_H + 10
}

// ─── Estilos de arestas por tipo de segmento ─────────────────────────────────

/**
 * Estilos de arestas conforme tipo de segmento na topologia PON:
 *
 *  feeder       = OLT → CDO/CE        → azul,  grossa  (3.5px)
 *  distribuicao = CDO → Splitter       → roxo,  média   (2.5px)
 *  drop         = Splitter → CTO       → verde, fina    (1.5px)
 *  direto       = CDO → CTO (bypass)   → verde vivo, média (2px)
 *  reserva      = CDO → CTO (sem SPL)  → cinza, tracejada
 */
export const EDGE_STYLES = {
  feeder: {
    stroke:      '#2563eb',
    strokeWidth: 3.5,
  },
  distribuicao: {
    stroke:      '#7c3aed',
    strokeWidth: 2.5,
  },
  drop: {
    stroke:      '#16a34a',
    strokeWidth: 1.5,
  },
  direto: {
    stroke:      '#22c55e',
    strokeWidth: 2,
  },
  reserva: {
    stroke:          '#374151',
    strokeWidth:     1.5,
    strokeDasharray: '5,4',
  },
}

// ─── Logger de alterações de topologia ───────────────────────────────────────

/**
 * Registra uma alteração de topologia no console e, de forma não-bloqueante,
 * chama logEvento no servidor (quando disponível no contexto cliente).
 *
 * @param {'conexao_criada'|'conexao_removida'|'fusao_criada'|'fusao_removida'|'topologia_alterada'} tipo
 * @param {object} dados  Ex: { fusao_id, cdo_id, splitter_id, cto_id, projeto_id }
 */
export function logTopoChange(tipo, dados = {}) {
  const entry = { tipo, dados, ts: new Date().toISOString() }
  console.info('[FiberOps/Topologia]', tipo, dados)

  // Envia para logEvento de forma assíncrona (somente no cliente, não bloqueia)
  if (typeof window !== 'undefined' && dados.projeto_id) {
    import('@/actions/eventos')
      .then(({ logEvento }) =>
        logEvento({
          tipo_acao:  tipo,
          entidade:   'topologia',
          item_id:    dados.fusao_id ?? dados.splitter_id ?? dados.cto_id ?? 'n/a',
          item_nome:  dados.label ?? tipo,
          projeto_id: dados.projeto_id,
        })
      )
      .catch(() => {})
  }

  return entry
}

// ─── Helpers ABNT (NBR 14721) ─────────────────────────────────────────────────
//
// Sequência: Verde · Amarelo · Branco · Azul · Vermelho · Violeta ·
//            Marrom · Rosa · Preto · Cinza · Laranja · Aqua

export const ABNT = [
  { idx: 1,  nome: 'Verde',    hex: '#16a34a' },
  { idx: 2,  nome: 'Amarelo',  hex: '#ca8a04' },
  { idx: 3,  nome: 'Branco',   hex: '#94a3b8' },
  { idx: 4,  nome: 'Azul',     hex: '#2563eb' },
  { idx: 5,  nome: 'Vermelho', hex: '#dc2626' },
  { idx: 6,  nome: 'Violeta',  hex: '#7c3aed' },
  { idx: 7,  nome: 'Marrom',   hex: '#92400e' },
  { idx: 8,  nome: 'Rosa',     hex: '#db2777' },
  { idx: 9,  nome: 'Preto',    hex: '#1e293b' },
  { idx: 10, nome: 'Cinza',    hex: '#6b7280' },
  { idx: 11, nome: 'Laranja',  hex: '#ea580c' },
  { idx: 12, nome: 'Aqua',     hex: '#0891b2' },
]

/**
 * Padrão ABNT — sequência de cores configurada.
 * Índice 0 = fibra 1 (Verde).
 */
export const FIBER_COLOR_ORDER = [
  'verde', 'amarelo', 'branco', 'azul', 'vermelho', 'violeta',
  'marrom', 'rosa', 'preto', 'cinza', 'laranja', 'aqua',
]

/**
 * Padrão EIA-598-A — sequência internacional.
 * Mantida separada para futura extensão.
 * Índice 0 = fibra 1 (Azul).
 */
export const EIA_598_A_COLOR_ORDER = [
  'azul', 'laranja', 'verde', 'marrom', 'cinza', 'branco',
  'vermelho', 'preto', 'amarelo', 'violeta', 'rosa', 'aqua',
]

/**
 * Padrões de cores suportados.
 * @type {Record<'ABNT'|'EIA_598_A', string[]>}
 */
export const FIBER_STANDARDS = {
  ABNT:      FIBER_COLOR_ORDER,
  EIA_598_A: EIA_598_A_COLOR_ORDER,
}

/**
 * Retorna o nome de cor (string) pelo índice de fibra e padrão do projeto.
 * @param {number} index    Índice de fibra (base-1, cíclico)
 * @param {'ABNT'|'EIA_598_A'} [standard='ABNT']
 * @returns {string}
 */
export function getFiberColor(index, standard = 'ABNT') {
  const table = FIBER_STANDARDS[standard] ?? FIBER_COLOR_ORDER
  return table[((index - 1) % 12 + 12) % 12]
}

/**
 * Retorna o índice de fibra (base-1) dado um nome de cor.
 * @param {string} color      Nome em minúsculas, ex: 'azul'
 * @param {'ABNT'|'EIA_598_A'} [standard='ABNT']
 * @returns {number}  1–12, ou -1 se não encontrado
 */
export function getFiberIndex(color, standard = 'ABNT') {
  const table = FIBER_STANDARDS[standard] ?? FIBER_COLOR_ORDER
  const i = table.indexOf(color?.toLowerCase())
  return i === -1 ? -1 : i + 1
}

/** Retorna hex ABNT pelo índice de fibra (base-1, cíclico). */
export function abntHex(fibra) {
  if (!fibra || fibra < 1) return ABNT[0].hex
  return ABNT[(fibra - 1) % ABNT.length].hex
}

/** Retorna objeto ABNT pelo índice de fibra (base-1, cíclico). */
export function abntFibra(fibra) {
  if (!fibra || fibra < 1) return ABNT[0]
  return ABNT[(fibra - 1) % ABNT.length]
}
