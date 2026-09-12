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

const SUPABASE_URL = "https://hgliouynbdjsqqkskjsc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnbGlvdXluYmRqc3Fxa3NranNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MjI1NzMsImV4cCI6MjEwNDQ5ODU3M30.3BTABRmT71GabtYtqPI-kAjh5ysjTnjxIOPv2lydgnc";

// Namen der Storage-Buckets (müssen exakt mit Supabase übereinstimmen)
const BUCKET_FOTOS = "partezettel-fotos";
const BUCKET_AUDIO = "sprachnotizen";
