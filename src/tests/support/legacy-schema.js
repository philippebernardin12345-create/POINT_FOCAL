const LEGACY_SCHEMA_SQL = `
CREATE TABLE campaigns (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  description text NULL,
  opportunity_url text NULL,
  prelaunch_enabled boolean NOT NULL DEFAULT false,
  public_open boolean NOT NULL DEFAULT false,
  default_language text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  whatsapp text NULL,
  password_hash text NULL,
  language text NULL DEFAULT 'fr',
  status text NOT NULL DEFAULT 'pending',
  sponsor_id uuid NULL,
  campaign_id uuid NULL REFERENCES campaigns(id),
  invitation_code_series_1 text NULL,
  invitation_code_series_2 text NULL,
  invitation_code_series_3 text NULL,
  is_root boolean NOT NULL DEFAULT false,
  is_leader boolean NOT NULL DEFAULT false,
  is_prelaunch_leader boolean NOT NULL DEFAULT false,
  link_active boolean NOT NULL DEFAULT false,
  email_confirmed boolean NOT NULL DEFAULT false,
  email_otp text NULL,
  email_otp_expires_at timestamptz NULL,
  password_reset_token text NULL,
  password_reset_expires_at timestamptz NULL,
  victory_assigned_at timestamptz NULL,
  victory_started_at timestamptz NULL,
  victory_expires_at timestamptz NULL,
  victory_expired boolean NOT NULL DEFAULT false,
  victory_personal_link text NULL,
  victory_identifier text NULL,
  victory_parent_identifier text NULL,
  victory_world_link text NULL,
  victory_world_status text NULL,
  victory_world_tx_hash text NULL,
  victory_world_paid_at timestamptz NULL,
  victory_world_started_at timestamptz NULL,
  victory_world_assigned_link text NULL,
  victory_world_target_address text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD CONSTRAINT users_sponsor_id_fk
  FOREIGN KEY (sponsor_id)
  REFERENCES users(id)
  ON DELETE SET NULL;

CREATE TABLE opportunities (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NULL,
  status text NOT NULL DEFAULT 'draft',
  is_available boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 1,
  is_entry boolean NOT NULL DEFAULT false,
  generates_link boolean NOT NULL DEFAULT false,
  requires_provision boolean NOT NULL DEFAULT false,
  provision_amount numeric NULL,
  provision_message text NULL,
  registration_url text NULL,
  depends_on uuid NULL,
  root_sponsor_link text NULL,
  requires_user_link boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE user_opportunities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  referral_link text NULL,
  target_address text NULL,
  payment_hash text NULL,
  sponsor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT user_opportunities_user_opportunity_key
    UNIQUE (user_id, opportunity_id)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id uuid NULL REFERENCES campaigns(id),
  tx_hash text NOT NULL UNIQUE,
  target_address text NULL,
  amount numeric NULL,
  network text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE rollup_logs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  original_sponsor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  rollup_parent_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
`;

module.exports = {
  LEGACY_SCHEMA_SQL
};
