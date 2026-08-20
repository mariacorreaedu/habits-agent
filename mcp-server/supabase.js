import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// Conecta usando a service_role key (acesso total, só o servidor tem essa chave)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// FERRAMENTA 1: Criar tarefa/hábito
export async function criarTarefa({ habito, status, dias_consecutivos, observacao }) {
  const { data, error } = await supabase
    .from("habitos")
    .insert({
      habito,
      status: status || "pendente",
      dias_consecutivos: dias_consecutivos || 0,
      observacao: observacao || null,
    })
    .select()
    .single();

  if (error) {
    return { sucesso: false, mensagem: `Erro ao criar hábito: ${error.message}` };
  }

  return { sucesso: true, id: data.id, mensagem: `Hábito "${habito}" registrado com sucesso.` };
}

// FERRAMENTA 2: Listar tarefas/hábitos
export async function listarTarefas() {
  const { data, error } = await supabase
    .from("habitos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { sucesso: false, mensagem: `Erro ao listar hábitos: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return { sucesso: true, total: 0, habitos: [], mensagem: "Nenhum hábito registrado ainda." };
  }

  return { sucesso: true, total: data.length, habitos: data };
}

// FERRAMENTA 3: Buscar tarefa/hábito específico (por nome ou id)
export async function buscarTarefa({ termo }) {
  // Tenta primeiro como busca por id numérico
  if (!isNaN(Number(termo))) {
    const { data, error } = await supabase
      .from("habitos")
      .select("*")
      .eq("id", Number(termo));

    if (!error && data && data.length > 0) {
      return { sucesso: true, encontrado: true, resultados: data };
    }
  }

  // Busca por nome (case-insensitive, parcial)
  const { data, error } = await supabase
    .from("habitos")
    .select("*")
    .ilike("habito", `%${termo}%`);

  if (error) {
    return { sucesso: false, mensagem: `Erro ao buscar: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return { sucesso: true, encontrado: false, mensagem: `Nenhum hábito encontrado com "${termo}".` };
  }

  return { sucesso: true, encontrado: true, resultados: data };
}

// FERRAMENTA 4: Editar tarefa/hábito (por id)
export async function editarTarefa({ id, status, dias_consecutivos, observacao }) {
  const camposParaAtualizar = {};
  if (status !== undefined) camposParaAtualizar.status = status;
  if (dias_consecutivos !== undefined) camposParaAtualizar.dias_consecutivos = dias_consecutivos;
  if (observacao !== undefined) camposParaAtualizar.observacao = observacao;

  const { data, error } = await supabase
    .from("habitos")
    .update(camposParaAtualizar)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return { sucesso: false, mensagem: `Hábito com id "${id}" não encontrado ou erro ao editar.` };
  }

  return { sucesso: true, mensagem: `Hábito "${data.habito}" atualizado com sucesso.` };
}

// FERRAMENTA 5: Deletar tarefa/hábito (por id)
export async function deletarTarefa({ id }) {
  // Busca antes pra confirmar que existe e pegar o nome pra mensagem
  const { data: existente } = await supabase
    .from("habitos")
    .select("habito")
    .eq("id", id)
    .single();

  if (!existente) {
    return { sucesso: false, mensagem: `Hábito com id "${id}" não encontrado.` };
  }

  const { error } = await supabase.from("habitos").delete().eq("id", id);

  if (error) {
    return { sucesso: false, mensagem: `Erro ao deletar: ${error.message}` };
  }

  return { sucesso: true, mensagem: `Hábito "${existente.habito}" deletado com sucesso.` };
}