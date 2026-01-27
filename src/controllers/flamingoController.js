import * as flamingoService from '../services/flamingoService.js';

// Tool: Consultar Deudas (Flamingo)
export const handleGetFlamingoDebts = async (req, res) => {
  try {
    let { tipoIdentificacion, identificacion } = req.body;
    
    // Default a Cédula (1) si no se especifica
    if (!tipoIdentificacion) tipoIdentificacion = "1";

    if (!identificacion) {
      return res.status(400).json({ error: 'identificacion es requerido' });
    }

    const rawData = await flamingoService.consultaClientesFlamingo(tipoIdentificacion, identificacion);

    // --- Lógica de Parseo (Idéntica a handleGetAdminfoDebts) ---
    
    // Validar si existe la propiedad 'obligaciones'
    const obligacionesRaw = rawData.obligaciones || [];
    const infoBasica = rawData['informacion basica'] || {};
    const datosContacto = rawData['datos contacto'] || {};
    
    const celularReplegal = infoBasica.celular_replegal || '';

    const obligaciones = obligacionesRaw.map(obs => ({
        nrodoc: obs.nrodoc || 'N/A',
        nombredoc: obs.nombredoc || 'Obligación',
        saldo_vencido: Number(obs.saldo_vencido) || 0,
        noctasvenc: Number(obs.noctasvenc) || 0,
        nrocuotas: Number(obs.nrocuotas) || 0,
        cuotas_pendientes: Number(obs.cuotas_pendientes) || 0,
        fechvenci: obs.fechvenci || 'N/A',
        descripcion: obs.descripcion || '',
        diasMora: Number(obs.total_ges) || 0
    }));

    const obligacionesVencidas = obligaciones.filter(obs => obs.saldo_vencido > 0);

    // Obtener IDs necesarios para el seguimiento
    const telefonos = datosContacto.telefonos || [];

    // Buscar preferiblemente un celular para obtener el consrefer
    const telefonoCelular = telefonos.find(t => t.tipo === 'CEL' || t.tiporeal === 'CEL');
    const contactoSeleccionado = telefonoCelular || (telefonos.length > 0 ? telefonos[0] : null);
    
    const primerIdContacto = contactoSeleccionado ? (contactoSeleccionado.consrefer || '') : '';

    // Obtener el número de crédito de la primera obligación si existe
    const primerNumCredito = obligaciones.length > 0 ? (obligaciones[0].nrodoc || '') : '';

    const result = {
        cliente: infoBasica.nombres || rawData.razonsocial || 'Cliente',
        celular_registrado: celularReplegal,
        id_dato_contacto_obligatorio: primerIdContacto,
        numero_credito_obligatorio: primerNumCredito,
        total_obligaciones: obligaciones.length,
        obligaciones_vencidas: obligacionesVencidas.length > 0 ? obligacionesVencidas : "El cliente se encuentra al día.",
        detalle_obligaciones: obligaciones
    };

    res.json(result);
  } catch (error) {
    console.error('Error in handleGetFlamingoDebts:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error consultando deudas en Adminfo (Flamingo)' });
  }
};

// Tool: Registrar Seguimiento (Flamingo)
export const handleFlamingoTracking = async (req, res) => {
  try {
    const input = req.body;
    
    // --- Lógica de Validación ---

    // Default a Cédula (1) si no se especifica
    const tipoIdentificacion = input.tipoIdentificacion || "1";

    // Validar y priorizar el código de gestión entrante
    let gestionCode = input.codigoGestion || input.management_code;
    
    // Si no llega un código válido (numérico), usar el default 70084 (Gestión efectiva)
    if (!gestionCode || !/^\d+$/.test(gestionCode)) {
        gestionCode = "70084"; 
    }

    // Priorizar descripción entrante
    const descripcion = input.descripcion || input.description || "Gestión realizada por Agente IA (Flamingo)";

    // Forzar valores de canal y tipo de contacto aceptados por el API Legacy
    const followUpData = {
        ...input,
        tipoIdentificacion,
        idDatoContacto: input.idDatoContacto || "0",
        canalActual: "TEL",
        tipoContacto: "ENT",
        codigoGestion: gestionCode,
        descripcion: descripcion,
        // Limpiar codigoCausal si el agente envía texto descriptivo no vacío o inválido
        codigoCausal: (input.codigoCausal && !/^\d+$/.test(input.codigoCausal)) ? "" : (input.codigoCausal || "")
    };

    // Validar campos mínimos requeridos (después de aplicar defaults)
    const required = ['identificacion', 'grabador', 'descripcion', 'numCredito'];
    const missing = required.filter(field => !followUpData[field]);

    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `Faltan campos requeridos para el seguimiento Flamingo: ${missing.join(', ')}`
      });
    }

    const result = await flamingoService.realizarSeguimientoFlamingo(followUpData);
    res.json({ message: 'Seguimiento registrado con éxito en Flamingo', result });
  } catch (error) {
    console.error('Error in handleFlamingoTracking:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error registrando seguimiento en Adminfo (Flamingo)' });
  }
};
