/**
 * src/lib/olt-adapter-factory.js
 *
 * Returns the correct adapter instance for a given OLT document.
 *
 * Routing logic:
 *   protocolo === 'api'    → RestOltAdapter  (HTTP/REST)
 *   protocolo === 'telnet' → TelnetAdapter   (raw TCP Telnet)
 *   protocolo === 'ssh'    → HuaweiOltAdapter (SSH — also handles simulator/mock)
 *   (default)              → HuaweiOltAdapter
 */

import { HuaweiOltAdapter } from './huawei-adapter.js'
import { TelnetAdapter }    from './telnet-adapter.js'
import { RestOltAdapter }   from './rest-olt-adapter.js'

/**
 * Returns the correct adapter instance for the given OLT document.
 *
 * @param {Object} olt  - Lean MongoDB OLT document
 * @returns {HuaweiOltAdapter|TelnetAdapter|RestOltAdapter}
 */
export function getOltAdapter(olt) {
  const protocolo = olt.protocolo ?? 'ssh'

  if (protocolo === 'api') {
    return new RestOltAdapter({
      rest_url:  olt.rest_url ?? `http://${olt.ip}`,
      api_token: olt.api_token ?? null,
    })
  }

  if (protocolo === 'telnet') {
    if (!olt.ip) throw new Error(`OLT "${olt.nome ?? olt.id}" não tem IP configurado`)
    return new TelnetAdapter({
      ip:          olt.ip,
      ssh_user:    olt.ssh_user    ?? 'admin',
      ssh_pass:    olt.ssh_pass    ?? '',
      telnet_port: olt.telnet_port ?? 23,
    })
  }

  // Default: SSH — HuaweiOltAdapter handles Huawei/ZTE/simulator
  if (!olt.ip) throw new Error(`OLT "${olt.nome ?? olt.id}" não tem IP configurado`)
  return new HuaweiOltAdapter({
    ip:       olt.ip,
    ssh_user: olt.ssh_user ?? 'admin',
    ssh_pass: olt.ssh_pass ?? '',
    ssh_port: olt.ssh_port ?? 22,
    vendor:   olt.tipo     ?? 'huawei',  // olt.tipo is the correct field (was olt.vendor which doesn't exist)
  })
}
