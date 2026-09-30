-- Ejecutar en el MISMO proyecto Supabase del chat de WhatsApp.
-- El contador increment_libranza_counter() ya debe existir y ser compartido.
do $$
begin
  if to_regprocedure('public.increment_libranza_counter()') is null then
    raise exception 'Este proyecto no tiene el contador compartido increment_libranza_counter()';
  end if;
end $$;

create table if not exists public.elevenlabs_libranza_sessions (
  conversation_id text primary key,
  status text not null check (status in (
    'PREPARING', 'PREPARATION_FAILED', 'READY', 'OTP_REQUESTING',
    'OTP_SENT', 'OTP_EXPIRED', 'SIGNING', 'SIGNATURE_FAILED',
    'SIGNED', 'DELIVERING', 'DELIVERED'
  )),
  libranza_number text not null unique,
  client_data jsonb not null,
  consent_at timestamptz not null,
  prepared_pdf_key text,
  prepared_sha256 text,
  otp_sent_at timestamptz,
  otp_attempts integer not null default 0,
  signed_pdf_key text,
  signed_sha256 text,
  witness_pdf_key text,
  andes_id text,
  signed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.elevenlabs_libranza_sessions enable row level security;
revoke all on public.elevenlabs_libranza_sessions from public, anon, authenticated;
grant select, insert, update on public.elevenlabs_libranza_sessions to service_role;
grant execute on function public.increment_libranza_counter() to service_role;
-- Sin políticas para anon/authenticated: solo el backend con service_role accede.
