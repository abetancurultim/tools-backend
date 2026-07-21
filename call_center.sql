-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.call_center_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  greeting_en text,
  greeting_es text,
  alert_enabled boolean DEFAULT false,
  alert_message text,
  external_resources jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT call_center_clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.call_center_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  name text NOT NULL,
  address text,
  phone text,
  hours text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  timezone text DEFAULT 'America/New_York'::text,
  CONSTRAINT call_center_locations_pkey PRIMARY KEY (id),
  CONSTRAINT call_center_locations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id)
);
CREATE TABLE public.call_center_personnel (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  extension text,
  role text,
  location_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT call_center_personnel_pkey PRIMARY KEY (id),
  CONSTRAINT call_center_personnel_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id),
  CONSTRAINT call_center_personnel_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.call_center_locations(id)
);
CREATE TABLE public.call_center_case_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  name text NOT NULL,
  email_recipients jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  email_enabled boolean DEFAULT false,
  email_subject text,
  email_template text,
  email_reply_to jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT call_center_case_types_pkey PRIMARY KEY (id),
  CONSTRAINT call_center_case_types_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id)
);
CREATE TABLE public.call_center_script_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_type_id uuid,
  field_order integer NOT NULL,
  field_type text NOT NULL,
  label_en text NOT NULL,
  label_es text NOT NULL,
  options jsonb,
  required boolean DEFAULT false,
  placeholder_en text,
  placeholder_es text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT call_center_script_fields_pkey PRIMARY KEY (id),
  CONSTRAINT call_center_script_fields_case_type_id_fkey FOREIGN KEY (case_type_id) REFERENCES public.call_center_case_types(id)
);
CREATE TABLE public.call_center_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  case_type_id uuid,
  agent_id uuid,
  submission_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  client_id uuid,
  client_name text,
  case_type_name text,
  agent_name text,
  agent_email text,
  lead_status USER-DEFINED DEFAULT 'new'::call_center_lead_status,
  lead_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  unified_call_id uuid,
  CONSTRAINT call_center_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT call_center_submissions_case_type_id_fkey FOREIGN KEY (case_type_id) REFERENCES public.call_center_case_types(id),
  CONSTRAINT call_center_submissions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id),
  CONSTRAINT call_center_submissions_unified_call_id_fkey FOREIGN KEY (unified_call_id) REFERENCES public.cc_unified_calls(id)
);
CREATE TABLE public.call_center_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT call_center_agents_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  customer_name text NOT NULL,
  case_type text NOT NULL,
  phone_number text,
  email text,
  call_summary text NOT NULL,
  agent_name text,
  agent_id text,
  CONSTRAINT ai_call_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cc_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['twilio'::text, 'callrail'::text, 'elevenlabs'::text])),
  display_name text NOT NULL DEFAULT ''::text,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  polling_enabled boolean NOT NULL DEFAULT true,
  polling_interval_minutes integer NOT NULL DEFAULT 5,
  webhook_secret text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cc_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT cc_integrations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id),
  CONSTRAINT cc_integrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.cc_phone_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL,
  client_id uuid NOT NULL,
  phone_number text NOT NULL,
  external_number_id text,
  direction text NOT NULL DEFAULT 'both'::text CHECK (direction = ANY (ARRAY['inbound'::text, 'outbound'::text, 'both'::text])),
  recording_enabled boolean NOT NULL DEFAULT true,
  ai_agent_id text,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cc_phone_numbers_pkey PRIMARY KEY (id),
  CONSTRAINT cc_phone_numbers_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.cc_integrations(id),
  CONSTRAINT cc_phone_numbers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id)
);
CREATE TABLE public.cc_call_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  integration_id uuid,
  provider text NOT NULL CHECK (provider = ANY (ARRAY['twilio'::text, 'callrail'::text, 'elevenlabs'::text, '3cx'::text])),
  external_call_id text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound'::text CHECK (direction = ANY (ARRAY['inbound'::text, 'outbound'::text])),
  from_number text,
  to_number text,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  duration_seconds integer,
  status text,
  recording_url text,
  transcript_url text,
  transcript_text text,
  agent_id text,
  ai_agent_id text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text DEFAULT ((provider || ':'::text) || external_call_id),
  unified_call_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  caller_name text,
  tags jsonb,
  CONSTRAINT cc_call_events_pkey PRIMARY KEY (id),
  CONSTRAINT cc_call_events_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id),
  CONSTRAINT cc_call_events_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.cc_integrations(id),
  CONSTRAINT fk_cc_call_events_unified FOREIGN KEY (unified_call_id) REFERENCES public.cc_unified_calls(id)
);
CREATE TABLE public.cc_unified_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  primary_provider text NOT NULL CHECK (primary_provider = ANY (ARRAY['twilio'::text, 'callrail'::text, 'elevenlabs'::text, '3cx'::text])),
  direction text NOT NULL DEFAULT 'inbound'::text CHECK (direction = ANY (ARRAY['inbound'::text, 'outbound'::text])),
  from_number text,
  to_number text,
  started_at timestamp with time zone,
  duration_seconds integer,
  normalized_status text NOT NULL DEFAULT 'new'::text CHECK (normalized_status = ANY (ARRAY['new'::text, 'qualified'::text, 'potential'::text, 'bad_lead'::text, 'scheduled'::text, 'won'::text, 'lost'::text, 'spam'::text, 'follow_up'::text])),
  recording_url text,
  ai_summary text,
  ai_next_action text,
  ai_transcript text,
  match_confidence text CHECK (match_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text, NULL::text])),
  event_count integer NOT NULL DEFAULT 1,
  linked_submission_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  caller_name text,
  tags jsonb,
  case_type text,
  lead_status text,
  claimed_by_email text,
  claimed_by_name text,
  claimed_at timestamp with time zone,
  has_ai boolean DEFAULT false,
  notes text,
  CONSTRAINT cc_unified_calls_pkey PRIMARY KEY (id),
  CONSTRAINT cc_unified_calls_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id),
  CONSTRAINT cc_unified_calls_linked_submission_id_fkey FOREIGN KEY (linked_submission_id) REFERENCES public.call_center_submissions(id)
);
CREATE TABLE public.cc_status_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  provider text NOT NULL,
  external_status text NOT NULL,
  normalized_status text NOT NULL CHECK (normalized_status = ANY (ARRAY['new'::text, 'qualified'::text, 'potential'::text, 'bad_lead'::text, 'scheduled'::text, 'won'::text, 'lost'::text, 'spam'::text, 'follow_up'::text])),
  CONSTRAINT cc_status_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT cc_status_mappings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id)
);
CREATE TABLE public.cc_backfill_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  integration_id uuid NOT NULL,
  provider text NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'error'::text, 'cancelled'::text])),
  pages_processed integer NOT NULL DEFAULT 0,
  total_calls_imported integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT cc_backfill_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT cc_backfill_jobs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.cc_integrations(id),
  CONSTRAINT cc_backfill_jobs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id)
);
CREATE TABLE public.cc_case_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cc_case_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cc_call_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  resultado text NOT NULL CHECK (resultado = ANY (ARRAY['conectado'::text, 'no_disponible'::text])),
  motivo_no_disponible text,
  answered_by text,
  numero_abogado text,
  numero_lead text,
  telefono_lead text,
  nombre_lead text,
  motivo text,
  lead_call_sid text,
  lawyer_call_sid text,
  conference_name text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT cc_call_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT cc_call_transfers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id)
);
CREATE TABLE public.cc_transfer_lawyers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,            -- E.164, ej: +57...
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT cc_transfer_lawyers_pkey PRIMARY KEY (id),
  CONSTRAINT cc_transfer_lawyers_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id)
);
CREATE TABLE public.cc_transfer_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  lawyer_id uuid NOT NULL,
  name text NOT NULL,             -- ej: "Accidentes de automóvil"
  description text,               -- qué cubre, para que el LLM entienda
  keywords text,                  -- sinónimos/disparadores: "choque, colisión, atropello"
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT cc_transfer_services_pkey PRIMARY KEY (id),
  CONSTRAINT cc_transfer_services_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.call_center_clients(id),
  CONSTRAINT cc_transfer_services_lawyer_id_fkey FOREIGN KEY (lawyer_id) REFERENCES public.cc_transfer_lawyers(id)
);
CREATE INDEX idx_cc_transfer_lawyers_client ON public.cc_transfer_lawyers(client_id);
CREATE INDEX idx_cc_transfer_services_client ON public.cc_transfer_services(client_id);

-- GRANTS obligatorios (Data API / supabase-js)
grant select on public.cc_transfer_lawyers to anon;
grant select, insert, update, delete on public.cc_transfer_lawyers to authenticated;
grant select, insert, update, delete on public.cc_transfer_lawyers to service_role;
grant select on public.cc_transfer_services to anon;
grant select, insert, update, delete on public.cc_transfer_services to authenticated;
grant select, insert, update, delete on public.cc_transfer_services to service_role;

alter table public.cc_transfer_lawyers enable row level security;
alter table public.cc_transfer_services enable row level security;