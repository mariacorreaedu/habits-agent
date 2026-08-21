import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Conecta usando a service_role key (acesso total, só o servidor tem essa chave)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Garante que o usuário existe na tabela `users`
 * Se não existir, cria um novo registro.
 * Se já existir mas estiver sem nome, atualiza com os dados do Telegram.
 */
async function garantirUsuario(telegramChatId, telegramUsername, firstName) {
  // Busca o usuário
  const { data: usuarioExistente, error: erroSelect } = await supabase
    .from("users")
    .select("id, first_name, telegram_username")
    .eq("telegram_chat_id", telegramChatId)
    .single();

  // Se encontrou, retorna o ID (e atualiza nome se estava vazio)
  if (usuarioExistente) {
    // Preenche nome/username se estavam nulos e agora temos o dado
    const precisaAtualizar =
      (!usuarioExistente.first_name && firstName) ||
      (!usuarioExistente.telegram_username && telegramUsername);

    if (precisaAtualizar) {
      await supabase
        .from("users")
        .update({
          first_name: usuarioExistente.first_name || firstName,
          telegram_username: usuarioExistente.telegram_username || telegramUsername,
        })
        .eq("id", usuarioExistente.id);
    }

    return { sucesso: true, userId: usuarioExistente.id };
  }

  // Se não encontrou, cria um novo
  if (erroSelect?.code === "PGRST116") {
    // Erro "no rows returned" é esperado
    const { data: novoUsuario, error: erroInsert } = await supabase
      .from("users")
      .insert({
        telegram_chat_id: telegramChatId,
        telegram_username: telegramUsername,
        first_name: firstName,
      })
      .select("id")
      .single();

    if (erroInsert) {
      return { sucesso: false, erro: `Erro ao criar usuário: ${erroInsert.message}` };
    }

    return { sucesso: true, userId: novoUsuario.id };
  }

  // Outro erro qualquer
  return { sucesso: false, erro: `Erro ao buscar usuário: ${erroSelect.message}` };
}

// ============================================
// FERRAMENTA 1: Criar novo hábito
// ============================================
export async function criarHabito({
  telegramChatId,
  telegramUsername,
  firstName,
  nome,
  descricao = "",
  categoria = "exercício",
  icone = "📝",
}) {
  try {
    // 1. Garantir que o usuário existe
    const { sucesso: usuarioOk, userId, erro: erroUser } = await garantirUsuario(
      telegramChatId,
      telegramUsername,
      firstName
    );

    if (!usuarioOk) {
      return { sucesso: false, mensagem: erroUser };
    }

    // 2. Contar quantos hábitos o usuário já tem (ativos)
    const { count: habitosCount, error: erroCount } = await supabase
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!erroCount && habitosCount && habitosCount >= 3) {
      return {
        sucesso: false,
        mensagem: `⚠️ Limite atingido! Você tem 3 hábito(s) ativo(s). Máximo: 3. Delete ou desative um antes de criar novo.`,
      };
    }

    // 3. Inserir o novo hábito
    const { data: novoHabito, error: erroInsert } = await supabase
      .from("habits")
      .insert({
        user_id: userId,
        name: nome,
        description: descricao,
        category: categoria,
        icon: icone,
        is_active: true,
      })
      .select()
      .single();

    if (erroInsert) {
      return { sucesso: false, mensagem: `❌ Erro ao criar hábito: ${erroInsert.message}` };
    }

    // Usa habitosCount (não "habitos") para montar a contagem
    const totalAtual = (habitosCount || 0) + 1;

    return {
      sucesso: true,
      habitoId: novoHabito.id,
      mensagem: `✅ Hábito "${nome}" criado com sucesso! (${totalAtual}/3)`,
      habito: novoHabito,
    };
  } catch (err) {
    return { sucesso: false, mensagem: `❌ Erro inesperado: ${err.message}` };
  }
}

// ============================================
// FERRAMENTA 2: Listar hábitos do usuário
// ============================================
export async function listarHabitos({
  telegramChatId,
  telegramUsername,
  firstName,
}) {
  try {
    // 1. Garantir que o usuário existe
    const { sucesso: usuarioOk, userId, erro: erroUser } = await garantirUsuario(
      telegramChatId,
      telegramUsername,
      firstName
    );

    if (!usuarioOk) {
      return { sucesso: false, mensagem: erroUser };
    }

    // 2. Buscar hábitos ativos do usuário COM as métricas
    const { data: habitos, error: erroSelect } = await supabase
      .from("habits")
      .select(
        `
        id,
        name,
        description,
        category,
        icon,
        is_active,
        created_at,
        habit_metrics(
          current_streak,
          longest_streak,
          total_days_completed,
          total_hours_spent,
          last_completion_date
        )
        `
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (erroSelect) {
      return { sucesso: false, mensagem: `❌ Erro ao listar: ${erroSelect.message}` };
    }

    if (!habitos || habitos.length === 0) {
      return {
        sucesso: true,
        total: 0,
        habitos: [],
        mensagem: "📭 Nenhum hábito ativo. Crie um com /create!",
      };
    }

    // Formata a resposta de forma legível
    const habitosFormatados = habitos.map((h) => {
      const metricas = h.habit_metrics?.[0] || {};
      return {
        id: h.id,
        nome: h.name,
        descricao: h.description,
        categoria: h.category,
        icone: h.icon,
        streakAtual: metricas.current_streak || 0,
        melhorStreak: metricas.longest_streak || 0,
        diasCompletados: metricas.total_days_completed || 0,
        horasTotal: metricas.total_hours_spent || 0,
        ultimoRegistro: metricas.last_completion_date,
      };
    });

    return {
      sucesso: true,
      total: habitosFormatados.length,
      habitos: habitosFormatados,
      mensagem: `📋 Você tem ${habitosFormatados.length} hábito(s) ativo(s).`,
    };
  } catch (err) {
    return { sucesso: false, mensagem: `❌ Erro inesperado: ${err.message}` };
  }
}

// ============================================
// FERRAMENTA 3: Registrar execução de hábito
// ============================================
export async function registrarExecucao({
  telegramChatId,
  telegramUsername,
  firstName,
  habitoNome,
  descricao = "",
  duracao_minutos = null,
  duracao_horas = null,
  tipo_atividade = "exercício",
  intensidade = "moderado",
  data = null, // opcional: "2026-08-21", se não informar usa hoje
  hora = null, // opcional: "18:30", se não informar usa agora
}) {
  try {
    // 1. Garantir que o usuário existe
    const { sucesso: usuarioOk, userId, erro: erroUser } = await garantirUsuario(
      telegramChatId,
      telegramUsername,
      firstName
    );

    if (!usuarioOk) {
      return { sucesso: false, mensagem: erroUser };
    }

    // 2. Buscar o hábito pelo nome (case-insensitive)
    const { data: habito, error: erroHabito } = await supabase
      .from("habits")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", habitoNome)
      .eq("is_active", true)
      .single();

    if (erroHabito || !habito) {
      return {
        sucesso: false,
        mensagem: `❌ Hábito "${habitoNome}" não encontrado. Verifique o nome.`,
      };
    }

    // 3. Preparar data e hora (com defaults)
    const agora = new Date();
    const dataLog = data || agora.toISOString().split("T")[0]; // YYYY-MM-DD
    const horaLog = hora || agora.toTimeString().slice(0, 5); // HH:MM

    // 4. Inserir o log
    const { data: novoLog, error: erroInsert } = await supabase
      .from("habit_logs")
      .insert({
        user_id: userId,
        habit_id: habito.id,
        logged_date: dataLog,
        logged_time: horaLog,
        description: descricao,
        duration_minutes: duracao_minutos,
        duration_hours: duracao_horas,
        activity_type: tipo_atividade,
        intensity: intensidade,
      })
      .select()
      .single();

    if (erroInsert) {
      return {
        sucesso: false,
        mensagem: `❌ Erro ao registrar: ${erroInsert.message}`,
      };
    }

    return {
      sucesso: true,
      logId: novoLog.id,
      mensagem: `✅ "${habitoNome}" registrado em ${dataLog} às ${horaLog}!\n${descricao}`,
      log: novoLog,
    };
  } catch (err) {
    return { sucesso: false, mensagem: `❌ Erro inesperado: ${err.message}` };
  }
}

// ============================================
// FERRAMENTA 4: Editar hábito
// ============================================
export async function editarHabito({
  telegramChatId,
  telegramUsername,
  firstName,
  habitoId,
  novoNome = null,
  novaDescricao = null,
  novaCategoria = null,
  novoIcone = null,
}) {
  try {
    // 1. Garantir que o usuário existe
    const { sucesso: usuarioOk, userId, erro: erroUser } = await garantirUsuario(
      telegramChatId,
      telegramUsername,
      firstName
    );

    if (!usuarioOk) {
      return { sucesso: false, mensagem: erroUser };
    }

    // 2. Preparar campos para atualizar
    const camposAtualizar = {};
    if (novoNome !== null) camposAtualizar.name = novoNome;
    if (novaDescricao !== null) camposAtualizar.description = novaDescricao;
    if (novaCategoria !== null) camposAtualizar.category = novaCategoria;
    if (novoIcone !== null) camposAtualizar.icon = novoIcone;
    camposAtualizar.updated_at = new Date().toISOString();

    // 3. Atualizar
    const { data: habito, error: erroUpdate } = await supabase
      .from("habits")
      .update(camposAtualizar)
      .eq("id", habitoId)
      .eq("user_id", userId)
      .select()
      .single();

    if (erroUpdate || !habito) {
      return {
        sucesso: false,
        mensagem: `❌ Hábito com ID "${habitoId}" não encontrado ou erro ao editar.`,
      };
    }

    return {
      sucesso: true,
      mensagem: `✅ Hábito "${habito.name}" atualizado com sucesso!`,
      habito,
    };
  } catch (err) {
    return { sucesso: false, mensagem: `❌ Erro inesperado: ${err.message}` };
  }
}

// ============================================
// FERRAMENTA 5: Deletar/desativar hábito
// ============================================
export async function deletarHabito({
  telegramChatId,
  telegramUsername,
  firstName,
  habitoId,
}) {
  try {
    // 1. Garantir que o usuário existe
    const { sucesso: usuarioOk, userId, erro: erroUser } = await garantirUsuario(
      telegramChatId,
      telegramUsername,
      firstName
    );

    if (!usuarioOk) {
      return { sucesso: false, mensagem: erroUser };
    }

    // 2. Buscar o hábito antes de deletar
    const { data: habito, error: erroSelect } = await supabase
      .from("habits")
      .select("name")
      .eq("id", habitoId)
      .eq("user_id", userId)
      .single();

    if (erroSelect || !habito) {
      return {
        sucesso: false,
        mensagem: `❌ Hábito com ID "${habitoId}" não encontrado.`,
      };
    }

    // 3. Deletar
    const { error: erroDelete } = await supabase
      .from("habits")
      .delete()
      .eq("id", habitoId)
      .eq("user_id", userId);

    if (erroDelete) {
      return {
        sucesso: false,
        mensagem: `❌ Erro ao deletar: ${erroDelete.message}`,
      };
    }

    return {
      sucesso: true,
      mensagem: `✅ Hábito "${habito.name}" deletado com sucesso.`,
    };
  } catch (err) {
    return { sucesso: false, mensagem: `❌ Erro inesperado: ${err.message}` };
  }
}

// ============================================
// FERRAMENTA 6: Ver estatísticas
// ============================================
export async function verEstatisticas({
  telegramChatId,
  telegramUsername,
  firstName,
  habitoNome,
}) {
  try {
    // 1. Garantir que o usuário existe
    const { sucesso: usuarioOk, userId, erro: erroUser } = await garantirUsuario(
      telegramChatId,
      telegramUsername,
      firstName
    );

    if (!usuarioOk) {
      return { sucesso: false, mensagem: erroUser };
    }

    // 2. Buscar o hábito
    const { data: habito, error: erroHabito } = await supabase
      .from("habits")
      .select("id, name")
      .eq("user_id", userId)
      .ilike("name", habitoNome)
      .eq("is_active", true)
      .single();

    if (erroHabito || !habito) {
      return {
        sucesso: false,
        mensagem: `❌ Hábito "${habitoNome}" não encontrado.`,
      };
    }

    // 3. Buscar as métricas
    const { data: metricas, error: erroMetricas } = await supabase
      .from("habit_metrics")
      .select("*")
      .eq("user_id", userId)
      .eq("habit_id", habito.id)
      .single();

    if (erroMetricas || !metricas) {
      return {
        sucesso: true,
        mensagem: `📭 "${habitoNome}" ainda não tem registros.`,
      };
    }

    // 4. Formatar resposta
    const resposta = `
📊 **Estatísticas de "${habito.name}"**
🔥 Streak atual: ${metricas.current_streak} dias
🏆 Melhor streak: ${metricas.longest_streak} dias
📅 Dias completados: ${metricas.total_days_completed}
⏱️ Horas totais: ${(metricas.total_hours_spent || 0).toFixed(1)}h
📍 Último registro: ${metricas.last_completion_date || "nunca"}
    `.trim();

    return {
      sucesso: true,
      metricas,
      mensagem: resposta,
    };
  } catch (err) {
    return { sucesso: false, mensagem: `❌ Erro inesperado: ${err.message}` };
  }
}

// ============================================
// EXPORTAR TODAS AS FERRAMENTAS
// ============================================
export const ferramentas = {
  criarHabito,
  listarHabitos,
  registrarExecucao,
  editarHabito,
  deletarHabito,
  verEstatisticas,
};