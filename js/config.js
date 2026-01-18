// Supabase Configuration
// These credentials connect your app to your Supabase project

const SUPABASE_URL = 'https://dhzabegjcdzxgtguisuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoemFiZWdqY2R6eGd0Z3Vpc3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTk2NzcsImV4cCI6MjA4NDMzNTY3N30.VW5sx0ln09nKPqmzRChrLMXPlzXVFM6IJDuAoJqV1ak';

// Initialize Supabase client
// Check if supabase library is loaded
if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded. Make sure the CDN script is included before config.js');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.supabaseClient = supabaseClient;
