// ไฟล์: src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hrjvuxwttlrlhjqademi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyanZ1eHd0dGxybGhqcWFkZW1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjIxNTYsImV4cCI6MjA5MjMzODE1Nn0.nikgFcCGg0Lebn-718ahUJNqotZwebhlQeVi5P0J2SA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);