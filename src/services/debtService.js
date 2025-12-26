import axios from 'axios';
import { getAuthToken } from './authService.js';
import { fetchUser } from './userService.js';

// Función interna para llamar a la API externa
const fetchDebtsColectora = async (documentId) => {
  const jwtToken = await getAuthToken();
  const url = `https://latamcolectoracartera.com/metodo_consulta/`;
  
  try {
    const response = await axios.post(url, {
      DOCUMENTO: Number(documentId),
      SERVICIO: 1,
    }, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const responseData = response.data;
    if (responseData.resultado === false) {
      return { error: true, message: responseData.mensaje };
    }
    return responseData;
  } catch (error) {
    console.error(error);
    return { error: true, message: "Error de conexión con Colectora" };
  }
};

// Función principal exportada
export const fetchDebts = async (documentId) => {
  console.log('Orquestando búsqueda de deudas para:', documentId);

  const dataColectora = await fetchDebtsColectora(documentId);

  if (dataColectora.error) {
    return {
      message: "Con la información proporcionada, no encontramos registros de opciones de pago. Te invitamos a comunicarte vía WhatsApp."
    };
  }

  const userData = await fetchUser(documentId);

  if (!userData) {
    return {
      message: "No se encontró el usuario en la base de datos interna."
    };
  }

  return {
    document_id: userData.document_id,
    name: userData.name,
    email: userData.email,
    number_of_credits: dataColectora.cantidad_creditos,
    debts_list: Array.isArray(dataColectora.obligaciones) ? dataColectora.obligaciones.map((debt) => ({
      debt_credit_number: debt.numero_credito,
      debt_origin: debt.origen,
      debt_details: {
        amount: debt?.detalle_pago[0]?.valor_cuenta,
        days_in_arrears: debt?.detalle_pago[0]?.dias_mora,
      },
    })) : [],
  };
};