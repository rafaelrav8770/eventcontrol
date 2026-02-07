// Supabase Configuration
const SUPABASE_URL = 'https://xethjgzynlkrwsirrzsf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhldGhqZ3p5bmxrcndzaXJyenNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjQ3ODgsImV4cCI6MjA4NjAwMDc4OH0.wD_eGAbyqL9maM4sqqeZ7kuaVcmkAu3VkKW1k0DuYIg';

// Initialize Supabase client - only if not already initialized
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

