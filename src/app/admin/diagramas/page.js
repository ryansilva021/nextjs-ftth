import { redirect } from 'next/navigation'

/**
 * /admin/diagramas foi unificado com /admin/topologia.
 * Qualquer link antigo para /admin/diagramas continua funcionando.
 */
export default function DiagramasRedirect({ searchParams }) {
  const sp = searchParams ?? {}
  const params = new URLSearchParams()

  if (sp.tab)  params.set('tab',  sp.tab)
  if (sp.tipo) params.set('tab',  sp.tipo === 'cto' ? 'ctos' : sp.tipo === 'cdo' ? 'cdos' : sp.tipo)
  if (sp.id)   params.set('id',   sp.id)

  const qs = params.toString()
  redirect(`/admin/topologia${qs ? `?${qs}` : ''}`)
}
