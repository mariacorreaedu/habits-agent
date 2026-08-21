"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import type { Database } from "../../../types/supabase";

type Habit = Database["public"]["Tables"]["habits"]["Row"];

export default function MetricsPage() {
  const params = useParams();
  const chatId = params.chatId as string;

  const [user, setUser] = useState<any>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cliente Supabase (sem autenticação necessária)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 1. Buscar usuário pelo chat_id
        const { data: userData, error: userErr } = await supabase
          .from("users")
          .select("*")
          .eq("telegram_chat_id", parseInt(chatId))
          .single();

        if (userErr || !userData) {
          setError("Usuário não encontrado. Verifique o link.");
          return;
        }

        setUser(userData);

        // 2. Buscar hábitos do usuário
        const { data: habitsData, error: habitsErr } = await supabase
          .from("habits")
          .select(
            `
            *,
            habit_metrics(
              current_streak,
              longest_streak,
              total_days_completed,
              total_hours_spent,
              last_completion_date,
              total_sessions
            )
            `
          )
          .eq("user_id", userData.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (habitsErr) throw habitsErr;
        setHabits(habitsData || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dados"
        );
      } finally {
        setLoading(false);
      }
    };

    if (chatId) {
      loadData();
    }
  }, [chatId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando métricas...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-red-600 text-lg mb-4">{error || "Usuário não encontrado"}</p>
          <p className="text-gray-600 text-sm">
            Se você recebeu este link no Telegram, verifique se é o link correto.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              🎯 Olá, {user.first_name || user.telegram_username || "Você"}!
            </h1>
            <p className="text-gray-600 mt-1">Aqui estão suas métricas de hábitos</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats gerais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-gray-600 text-sm mb-2">Total de hábitos</p>
            <p className="text-3xl font-bold text-indigo-600">{habits.length}</p>
          </div>

          {habits.length > 0 && (
            <>
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <p className="text-gray-600 text-sm mb-2">Maior streak</p>
                <p className="text-3xl font-bold text-green-600">
                  {Math.max(
                    0,
                    ...habits.map(
                      (h) => h.habit_metrics?.[0]?.longest_streak || 0
                    )
                  )}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <p className="text-gray-600 text-sm mb-2">Dias completados</p>
                <p className="text-3xl font-bold text-blue-600">
                  {habits.reduce(
                    (sum, h) =>
                      sum + (h.habit_metrics?.[0]?.total_days_completed || 0),
                    0
                  )}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <p className="text-gray-600 text-sm mb-2">Horas totais</p>
                <p className="text-3xl font-bold text-purple-600">
                  {(
                    habits.reduce(
                      (sum, h) =>
                        sum + (h.habit_metrics?.[0]?.total_hours_spent || 0),
                      0
                    ) || 0
                  ).toFixed(1)}
                  h
                </p>
              </div>
            </>
          )}
        </div>

        {/* Hábitos */}
        {habits.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 text-lg">
              Nenhum hábito registrado ainda 🚀
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Crie seu primeiro hábito no Telegram!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {habits.map((habit) => {
              const metrics = habit.habit_metrics?.[0];
              return (
                <div
                  key={habit.id}
                  className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-lg transition"
                >
                  {/* Cabeçalho */}
                  <div className="mb-4">
                    <div className="text-4xl mb-2">{habit.icon}</div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {habit.name}
                    </h3>
                    <p className="text-sm text-gray-500">{habit.category}</p>
                  </div>

                  {/* Descrição */}
                  {habit.description && (
                    <p className="text-gray-600 text-sm mb-4">
                      {habit.description}
                    </p>
                  )}

                  {/* Métricas */}
                  {metrics && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-100">
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div>
                          <p className="text-gray-600 text-xs uppercase font-semibold">
                            Streak
                          </p>
                          <p className="text-2xl font-bold text-indigo-600">
                            {metrics.current_streak || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs uppercase font-semibold">
                            Melhor
                          </p>
                          <p className="text-2xl font-bold text-indigo-600">
                            {metrics.longest_streak || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs uppercase font-semibold">
                            Dias
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {metrics.total_days_completed || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs uppercase font-semibold">
                            Horas
                          </p>
                          <p className="text-2xl font-bold text-purple-600">
                            {(metrics.total_hours_spent || 0).toFixed(1)}h
                          </p>
                        </div>
                      </div>

                      {/* Info extra */}
                      <div className="mt-4 pt-4 border-t border-indigo-200 text-xs text-gray-600">
                        <p>
                          <strong>Sessões:</strong> {metrics.total_sessions || 0}
                        </p>
                        <p>
                          <strong>Última:</strong>{" "}
                          {metrics.last_completion_date
                            ? new Date(
                                metrics.last_completion_date
                              ).toLocaleDateString("pt-BR")
                            : "Nunca"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-16 py-8 text-center text-sm">
        <p>
          🤖 Link gerado automaticamente pelo Habit Tracker Bot
        </p>
        <p className="text-gray-400 mt-2">
          Seguro compartilhar? Cuidado com quem tem este link!
        </p>
      </footer>
    </div>
  );
}