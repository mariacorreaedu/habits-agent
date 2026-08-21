export type Database = {
   public: {
     Tables: {
       users: {
         Row: {
           id: string;
           telegram_chat_id: number;
           telegram_username: string | null;
           first_name: string | null;
           last_name: string | null;
           share_token: string | null;
           created_at: string;
           updated_at: string;
         };
         Insert: {
           telegram_chat_id: number;
           telegram_username?: string | null;
           first_name?: string | null;
           last_name?: string | null;
         };
         Update: {
           telegram_username?: string | null;
           first_name?: string | null;
           last_name?: string | null;
         };
       };
       habits: {
         Row: {
           id: string;
           user_id: string;
           name: string;
           description: string | null;
           category: string | null;
           icon: string | null;
           color: string | null;
           is_active: boolean;
           created_at: string;
           updated_at: string;
           // Relação com habit_metrics (populate automático)
           habit_metrics?: Array<{
             id: string;
             user_id: string;
             habit_id: string;
             current_streak: number;
             longest_streak: number;
             total_days_completed: number;
             total_sessions: number;
             total_hours_spent: number;
             total_minutes_spent: number;
             average_duration_minutes: number;
             first_completion_date: string | null;
             last_completion_date: string | null;
             last_calculated_at: string;
           }>;
         };
         Insert: {
           user_id: string;
           name: string;
           description?: string | null;
           category?: string | null;
           icon?: string | null;
           color?: string | null;
           is_active?: boolean;
         };
         Update: {
           name?: string;
           description?: string | null;
           category?: string | null;
           icon?: string | null;
           color?: string | null;
           is_active?: boolean;
         };
       };
       habit_logs: {
         Row: {
           id: string;
           user_id: string;
           habit_id: string;
           logged_date: string;
           logged_time: string | null;
           description: string | null;
           duration_minutes: number | null;
           duration_hours: number | null;
           activity_type: string | null;
           intensity: string | null;
           calories_burned: number | null;
           distance_km: number | null;
           notes: string | null;
           mood: string | null;
           streak_day_number: number | null;
           created_at: string;
           updated_at: string;
         };
         Insert: {
           user_id: string;
           habit_id: string;
           logged_date?: string;
           logged_time?: string | null;
           description?: string | null;
           duration_minutes?: number | null;
           duration_hours?: number | null;
           activity_type?: string | null;
           intensity?: string | null;
           calories_burned?: number | null;
           distance_km?: number | null;
           notes?: string | null;
           mood?: string | null;
         };
         Update: {
           description?: string | null;
           duration_minutes?: number | null;
           duration_hours?: number | null;
           intensity?: string | null;
           notes?: string | null;
           mood?: string | null;
         };
       };
       habit_metrics: {
         Row: {
           id: string;
           user_id: string;
           habit_id: string;
           current_streak: number;
           longest_streak: number;
           total_days_completed: number;
           total_sessions: number;
           total_hours_spent: number;
           total_minutes_spent: number;
           average_duration_minutes: number;
           first_completion_date: string | null;
           last_completion_date: string | null;
           completion_rate_percent: number | null;
           last_calculated_at: string;
         };
         Insert: {
           user_id: string;
           habit_id: string;
           current_streak?: number;
           longest_streak?: number;
           total_days_completed?: number;
           total_sessions?: number;
           total_hours_spent?: number;
           total_minutes_spent?: number;
           average_duration_minutes?: number;
         };
         Update: {
           current_streak?: number;
           longest_streak?: number;
           total_days_completed?: number;
           total_sessions?: number;
           total_hours_spent?: number;
           total_minutes_spent?: number;
           average_duration_minutes?: number;
         };
       };
     };
     Views: {};
     Functions: {};
     Enums: {};
     CompositeTypes: {};
   };
 };