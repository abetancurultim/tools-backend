import { supabaseCallCenter } from '../config/clients.js';

/**
 * Devuelve el directorio de abogados por servicio de un cliente, en una lista plana
 * amigable para que el LLM del agente elija el abogado correcto.
 * @param {string} clientId - UUID del cliente en call_center_clients
 */
export async function obtenerDirectorio(clientId) {
  const { data, error } = await supabaseCallCenter
    .from('cc_transfer_services')
    .select('name, description, keywords, cc_transfer_lawyers ( name, phone )')
    .eq('client_id', clientId)
    .eq('active', true);

  if (error) throw new Error(`Error consultando directorio: ${error.message}`);

  return (data || []).map((s) => ({
    servicio: s.name,
    descripcion: s.description,
    palabras_clave: s.keywords,
    abogado: s.cc_transfer_lawyers?.name ?? null,
    numero_abogado: s.cc_transfer_lawyers?.phone ?? null,
  }));
}
