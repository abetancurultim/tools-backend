import axios from 'axios';

/**
 * Obtiene los detalles de una conversación de ElevenLabs por ID.
 * Documentación: https://elevenlabs.io/docs/api-reference/get-conversation
 * 
 * @param {string} conversationId - El ID único de la conversación.
 * @returns {Promise<Object>} - El objeto JSON con los detalles de la conversación.
 */
export const getConversationDetails = async (conversationId) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY no está configurada en las variables de entorno.");
  }

  try {
    const response = await axios.get(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
      headers: {
        'xi-api-key': apiKey
      }
    });

    return response.data;
  } catch (error) {
    console.error(`[ElevenLabs Service] Error obteniendo conversación ${conversationId}:`, error.message);
    if (error.response) {
      console.error("Detalles del error ElevenLabs:", error.response.data);
      // Re-lanza el error con el mensaje específico de ElevenLabs si existe
      throw new Error(error.response.data?.detail?.message || `Error de ElevenLabs: ${error.response.statusText}`);
    }
    throw error;
  }
};
