import { supabaseColectora } from '../config/clients.js';

// Colectora
export const fetchUser = async (documentId) => {
  console.log('Fetching user for documentId:', documentId);
  
  const { data, error } = await supabaseColectora
    .from('users_2026')
    .select('*')
    .eq('document_id', documentId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data;
};

// Bienestar