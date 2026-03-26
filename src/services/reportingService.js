import { s3, transporterColectora } from '../config/clients.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// --- S3 Logic ---
export const uploadCallDataToS3 = async (callData) => {
  const { name, number, cleanTranscript, document_id, duration } = callData;
  const now = new Date();
  const fileName = `llamada_${name.replace(/\s+/g, '_')}_${now.getTime()}.json`;

  // Estructura estricta solicitada por el usuario
  const payloadToSave = {
    name: name,
    document_id: document_id || '',
    pagaduria: callData.pagaduria || '',
    duration: duration,
    number: number,
    transcription: cleanTranscript || [] // Array estructurado
  };

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_COLECTORA || 'bucket-raw-latam',
    Key: `ultim/${fileName}`,
    Body: JSON.stringify(payloadToSave, null, 2),
    ContentType: 'application/json',
  };

  try {
    await s3.send(new PutObjectCommand(params));
    const region = process.env.AWS_REGION_COLECTORA || 'us-east-1';
    const location = `https://${params.Bucket}.s3.${region}.amazonaws.com/${params.Key}`;
    return { success: true, fileName, location };
  } catch (error) {
    console.error('[AWS-S3] Error:', error);
    return { success: false, error: error.message };
  }
};

// --- Email Logic ---
export const sendSuccessfulCallNotification = async (callData, s3Result) => {
  const { name, number, transcript, duration, callSid } = callData;
  const supervisorEmail = process.env.SUPERVISOR_EMAIL_COLECTORA;

  const htmlContent = `
    <h2>✅ Llamada Exitosa</h2>
    <p><strong>Cliente:</strong> ${name} (${number})</p>
    <p><strong>Duración:</strong> ${duration}</p>
    <p><strong>SID:</strong> ${callSid}</p>
    <h3>Transcripción:</h3>
    <pre>${transcript}</pre>
    <p><strong>Estado S3:</strong> ${s3Result.success ? 'Guardado ✅' : 'Falló ❌'}</p>
  `;

  try {
    await transporterColectora.sendMail({
      from: process.env.EMAIL_FROM_COLECTORA,
      to: supervisorEmail,
      subject: `🎯 Llamada Exitosa - ${name}`,
      html: htmlContent,
    });
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Error:', error);
    return { success: false, error: error.message };
  }
};

// --- Main Orchestrator ---
export const processCallLog = async (callData) => {
  console.log(`Procesando logs para ${callData.name}...`);
  
  // 1. Subir a S3
  const s3Result = await uploadCallDataToS3(callData);
  
  // 2. Enviar Email (incluso si S3 falla, queremos el email)
  const emailResult = await sendSuccessfulCallNotification(callData, s3Result);

  return { s3: s3Result, email: emailResult };
};