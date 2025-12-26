import axios from 'axios';

let jwtToken;
let tokenExpirationTime;

export const getAuthToken = async () => {
  const now = Date.now();
  if (!jwtToken || (tokenExpirationTime && now >= tokenExpirationTime)) {
    return getJWT();
  }
  return jwtToken;
};

const getJWT = async () => {
  const USUARIO = process.env.COLTEFINANCIERA_USER;
  const PASSWORD = process.env.COLTEFINANCIERA_PASS;
  const url = 'https://latamcolectoracartera.com/token_jwt/';
  
  try {
    const response = await axios.post(url, { USUARIO, PASSWORD }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    const responseData = response.data;

    if (responseData.resultado === false) {
      throw new Error(responseData.mensaje || 'Failed to obtain JWT');
    } 
    
    jwtToken = responseData.access_token;
    tokenExpirationTime = parseInt(responseData.expira) * 1000;
    return jwtToken;
    
  } catch (error) {
    console.error('Error al obtener el JWT:', error);
    throw error;
  }
};