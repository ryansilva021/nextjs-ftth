'use client'

import { useState, useTransition } from 'react'
import { criarInclusao } from '@/actions/time-request'

const FO = {
  orange: '#C45A2C', orangeSoft: '#E88A5A', orangeGlow: '#F4A771', orangeDeep: '#8E3B1A',
  cream: '#F7F0E2', muted: 'rgba(237,227,210,0.55)',
  line: 'rgba(237,227,210,0.10)', lineSoft: 'rgba(237,227,210,0.06)',
  success: '#5DBE7A', danger: '#E5654A', warn: '#E5A04A',
  mono: "'JetBrains Mono','Fira Mono',monospace",
  serif: "'Instrument Serif',Georgia,serif",
  card: 'linear-gradient(160deg,rgba(42,31,23,0.85) 0%,rgba(26,18,13,0.9) 100%)',
}

const inp = {
  height: 40, padding: '0 12px', borderRadius: 7,
  border: `1px solid ${FO.line}`, background: 'rgba(237,227,210,0.04)',
  color: FO.cream, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
const lbl = {
  display: 'flex', flexDirection: 'column', gap: 6,
  fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: FO.muted, fontFamily: FO.mono, fontWeight: 500,
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const RECENT = [
  { date: '29/04', label: 'Entrada · 08:14', pill: 'ok', pillTxt: 'APROVADO' },
  { date: '22/04', label: 'Saída · 18:02',   pill: 'ok', pillTxt: 'APROVADO' },
  { date: '15/04', label: 'Retorno · 13:35', pill: 'late', pillTxt: 'REJEITADO' },
  { date: '10/04', label: 'Entrada · 07:58', pill: 'short', pillTxt: 'PENDENTE' },
]

const PILL_CLR = { ok: '#8ddba0', late: '#f4937c', short: '#eab87a' }
const PILL_BG  = { ok: 'rgba(93,190,122,0.16)', late: 'rgba(229,101,74,0.16)', short: 'rgba(229,160,74,0.16)' }

export default function IncluirPontoTab({ showToast, onSuccess }) {
  const [form, setForm] = useState({
    data: todayStr(), hora: '08:12', tipo: 'entrada', motivo: 'esquecimento',
    justificativa: 'Cheguei à CTO-042 às 08:10 sem cobertura 4G; bati o ponto manualmente no caderno de campo.',
    localizacao: '-23.4810, -46.5505 (CTO-042 · Guarulhos)',
  })
  const [pending, startTrans] = useTransition()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.tipo)   return showToast('Selecione o tipo de marcação.', 'error')
    if (!form.hora)   return showToast('Informe a hora.', 'error')
    if (!form.justificativa.trim()) return showToast('Informe a justificativa.', 'error')

    startTrans(async () => {
      const res = await criarInclusao({
        data: form.data, tipoMarcacao: form.tipo,
        horaSolicitada: form.hora, motivo: form.justificativa,
      })
      if (res?.error) {
        showToast(res.error, 'error')
      } else {
        showToast('Solicitação enviada! Aguardando aprovação.')
        onSuccess?.(res.request)
        setForm({ data: todayStr(), hora: '', tipo: 'entrada', motivo: 'esquecimento', justificativa: '', localizacao: '' })
      }
    })
  }

  return (
    <div style={{ padding: '24px 30px 40px' }}>
      <style>{`
        .inc-vgrid{display:grid;grid-template-columns:1.4fr 1fr;gap:22px}
        .inc-frow{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .inc-inp:focus{border-color:${FO.orange}!important;box-shadow:0 0 0 3px rgba(196,90,44,0.18)!important}
        @media(max-width:900px){.inc-vgrid{grid-template-columns:1fr}}
        @media(max-width:600px){.inc-frow{grid-template-columns:1fr}}
      `}</style>

      {/* vhead */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: FO.orangeGlow, fontFamily: FO.mono, fontWeight: 500 }}>
            Registro retroativo
          </div>
          <h2 style={{ margin: '6px 0 4px', fontFamily: FO.serif, fontWeight: 400, fontSize: 32, letterSpacing: '-0.02em', color: FO.cream }}>
            Incluir <em style={{ color: FO.orangeGlow, fontStyle: 'italic' }}>ponto</em> esquecido
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: FO.muted, maxWidth: 580, lineHeight: 1.55 }}>
            Use quando você esqueceu de bater algum horário. A solicitação fica pendente de aprovação do gestor antes de entrar no espelho.
          </p>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, background: 'rgba(93,190,122,0.12)', color: '#7fd197', fontSize: 11.5, fontWeight: 500, border: '1px solid rgba(93,190,122,0.25)' }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#7fd197', boxShadow: '0 0 8px #7fd197', animation: 'fo-status-pulse 1.6s ease-out infinite' }} />
          Aprovação obrigatória · LGPD ✓
        </div>
      </div>

      <div className="inc-vgrid">
        {/* Form card */}
        <div style={{ background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Novo registro</div>
            <div style={{ fontSize: 11.5, color: FO.muted, fontFamily: FO.mono }}>Eventos perdidos = 1</div>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="inc-frow">
              <label style={lbl}>
                <span>Data</span>
                <input className="inc-inp" type="date" value={form.data} max={todayStr()} onChange={e => set('data', e.target.value)} style={inp} />
              </label>
              <label style={lbl}>
                <span>Horário</span>
                <input className="inc-inp" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} style={inp} />
              </label>
            </div>
            <div className="inc-frow">
              <label style={lbl}>
                <span>Tipo de marcação</span>
                <select className="inc-inp" value={form.tipo} onChange={e => set('tipo', e.target.value)} style={inp}>
                  <option value="entrada">Entrada</option>
                  <option value="pausa_inicio">Início de pausa</option>
                  <option value="pausa_fim">Retorno da pausa</option>
                  <option value="saida">Saída</option>
                </select>
              </label>
              <label style={lbl}>
                <span>Motivo</span>
                <select className="inc-inp" value={form.motivo} onChange={e => set('motivo', e.target.value)} style={inp}>
                  <option value="esquecimento">Esquecimento</option>
                  <option value="falha_dispositivo">Falha do dispositivo</option>
                  <option value="atendimento_externo">Atendimento externo</option>
                  <option value="reuniao_sem_acesso">Reunião sem acesso</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
            </div>
            <label style={lbl}>
              <span>Justificativa <em style={{ color: 'rgba(237,227,210,0.4)', fontStyle: 'normal', textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: 11 }}>(será revisada pelo gestor)</em></span>
              <textarea
                className="inc-inp"
                value={form.justificativa}
                onChange={e => set('justificativa', e.target.value)}
                rows={3}
                placeholder="Descreva o que aconteceu — anexar e-mail/print ajuda na aprovação"
                style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }}
              />
            </label>
            <div className="inc-frow">
              <label style={lbl}>
                <span>Anexo (opcional)</span>
                <div style={{ border: `1px dashed ${FO.line}`, borderRadius: 7, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center', color: 'rgba(237,227,210,0.7)', fontSize: 12, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 9V2M4 5l3-3 3 3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Arraste um arquivo ou clique para selecionar
                  <span style={{ fontSize: 10.5, color: FO.muted, fontFamily: FO.mono, letterSpacing: '0.08em', marginTop: 4 }}>PDF, JPG, PNG · até 10 MB</span>
                </div>
              </label>
              <label style={lbl}>
                <span>Localização aproximada</span>
                <input className="inc-inp" type="text" value={form.localizacao} onChange={e => set('localizacao', e.target.value)} placeholder="-23.4810, -46.5505" style={inp} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 6, borderTop: `1px solid ${FO.lineSoft}`, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: FO.muted, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                O gestor é notificado em até 5 min após o envio.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setForm({ data: todayStr(), hora: '', tipo: 'entrada', motivo: 'esquecimento', justificativa: '', localizacao: '' })} style={{ padding: '9px 16px', borderRadius: 7, border: `1px solid ${FO.line}`, background: 'rgba(237,227,210,0.04)', color: 'rgba(237,227,210,0.85)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  Limpar
                </button>
                <button type="submit" disabled={pending} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 7, border: 'none', background: `linear-gradient(180deg,${FO.orangeSoft} 0%,${FO.orange} 45%,${FO.orangeDeep} 100%)`, color: FO.cream, fontSize: 12.5, fontWeight: 500, cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1, boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 6px 14px rgba(196,90,44,0.32)', fontFamily: 'inherit' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {pending ? 'Enviando...' : 'Enviar para aprovação'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Recent list card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: FO.card, border: `1px solid ${FO.line}`, borderRadius: 14, backdropFilter: 'blur(8px)', boxShadow: '0 24px 48px rgba(0,0,0,0.3),0 1px 0 rgba(237,227,210,0.04) inset' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${FO.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(237,227,210,0.55)', fontFamily: FO.mono, fontWeight: 500 }}>Inclusões recentes</div>
            <a style={{ fontSize: 11.5, color: FO.orangeGlow, fontFamily: FO.mono, cursor: 'pointer', textDecoration: 'none' }}>Histórico →</a>
          </div>
          <div style={{ padding: '6px 12px 16px' }}>
            {RECENT.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px', borderRadius: 7, fontSize: 12.5, color: 'rgba(237,227,210,0.85)' }}>
                <span style={{ fontFamily: FO.mono, fontSize: 11, color: FO.muted, letterSpacing: '0.04em', width: 64, flexShrink: 0 }}>{r.date}</span>
                <span style={{ flex: 1 }}>{r.label}</span>
                <span style={{ fontSize: 9.5, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: FO.mono, background: PILL_BG[r.pill], color: PILL_CLR[r.pill] }}>{r.pillTxt}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${FO.lineSoft}`, fontSize: 11.5, color: FO.muted, lineHeight: 1.5 }}>
            Você pode incluir até <b style={{ color: FO.cream }}>3 marcações</b> por dia. Inclusões além disso exigem assinatura digital do RH.
          </div>
        </div>
      </div>
    </div>
  )
}
