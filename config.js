// ==========================================================
// KONFIGURATION – hier deine Supabase-Zugangsdaten eintragen
// ==========================================================
//
// SUPABASE_URL:  Project Settings → API → "Project URL"
// SUPABASE_ANON_KEY: Project Settings → API → "Project API keys" → "anon public"
//
// Beide Werte sind öffentlich sichtbar (landen im Browser-Code),
// das ist bei Supabase so vorgesehen – der eigentliche Schutz
// passiert über die "Row Level Security"-Regeln in der Datenbank,
// nicht über Geheimhaltung dieser Werte.

const SUPABASE_URL = "https://dqjuzgqigronucpanszn.supabase.co";
const SUPABASE_ANON_KEY = "HIER_DEINEN_ANON_PUBLIC_KEY_EINFÜGEN";

// Namen der Storage-Buckets (müssen exakt mit Supabase übereinstimmen)
const BUCKET_FOTOS = "partezettel-fotos";
const BUCKET_AUDIO = "sprachnotizen";
