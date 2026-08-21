import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import {
  criarHabito,
  listarHabitos,
  registrarExecucao,
  editarHabito,
  deletarHabito,
  verEstatisticas,
} from "./supabase.js";

// ============================================
// CONFIGURAÇÃO DO SERVIDOR EXPRESS
// ============================================
const app = express();
const PORT = process.env.PORT || 3001;

const transports = {};
const serverConnections = {};

// ============================================
// ENDPOINT SSE (Server-Sent Events)
// ============================================
app.get("/sse", async (req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;

    // Cria uma nova instância de servidor MCP para essa conexão
    const sessionServer = new McpServer({
      name: "habit-tracker-mcp-server",
      version: "2.0.0",
    });

    // ============================================
    // FERRAMENTA 1: Criar hábito
    // ============================================
    sessionServer.tool(
      "criar_habito",
      "Cria um novo hábito para o usuário. Máximo 3 hábitos ativos por usuário.",
      {
        telegramChatId: z.number().describe("ID do chat do Telegram"),
        telegramUsername: z.string().nullable().optional().describe("Nome de usuário do Telegram"),
        firstName: z.string().nullable().optional().describe("Primeiro nome do usuário"),
        nome: z.string().describe("Nome do hábito (ex: 'Corrida', 'Estudo')"),
        descricao: z.string().optional().describe("Descrição detalhada do hábito"),
        categoria: z
          .enum(["exercício", "estudo", "saúde", "leitura", "meditação", "outro"])
          .optional()
          .describe("Categoria do hábito"),
        icone: z.string().optional().describe("Emoji do hábito (ex: '🏃')"),
      },
      async (args) => {
        // Garante que null vire undefined
        const resultado = await criarHabito({
          ...args,
          telegramUsername: args.telegramUsername || undefined,
          firstName: args.firstName || undefined,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
        };
      }
    )

    // ============================================
    // FERRAMENTA 2: Listar hábitos
    // ============================================
    sessionServer.tool(
      "listar_habitos",
      "Lista todos os hábitos ativos do usuário com suas métricas (streak, horas totais, etc).",
      {
        telegramChatId: z.number().describe("ID do chat do Telegram"),
        telegramUsername: z.string().optional().describe("Nome de usuário do Telegram"),
        firstName: z.string().optional().describe("Primeiro nome do usuário"),
      },
      async (args) => {
        const resultado = await listarHabitos(args);
        return {
          content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
        };
      }
    );

    // ============================================
    // FERRAMENTA 3: Registrar execução
    // ============================================
    sessionServer.tool(
      "registrar_execucao",
      "Registra que o usuário completou um hábito em uma data/hora específica. Se não informar data/hora, usa hoje/agora.",
      {
        telegramChatId: z.number().describe("ID do chat do Telegram"),
        telegramUsername: z.string().optional().describe("Nome de usuário do Telegram"),
        firstName: z.string().optional().describe("Primeiro nome do usuário"),
        habitoNome: z.string().describe("Nome do hábito a registrar"),
        descricao: z.string().optional().describe("Como você fez (ex: '20 min de corrida 5km')"),
        duracao_minutos: z.number().optional().describe("Duração em minutos"),
        duracao_horas: z.number().optional().describe("Duração em horas (alternativa a minutos)"),
        tipo_atividade: z
          .string()
          .optional()
          .describe("Tipo de atividade (exercício, estudo, meditação, etc)"),
        intensidade: z
          .enum(["leve", "moderado", "intenso"])
          .optional()
          .describe("Intensidade do exercício/atividade"),
        data: z
          .string()
          .optional()
          .describe("Data (formato: YYYY-MM-DD). Se vazio, usa hoje."),
        hora: z
          .string()
          .optional()
          .describe("Hora (formato: HH:MM). Se vazio, usa hora atual."),
      },
      async (args) => {
        const resultado = await registrarExecucao(args);
        return {
          content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
        };
      }
    );

    // ============================================
    // FERRAMENTA 4: Editar hábito
    // ============================================
    sessionServer.tool(
      "editar_habito",
      "Edita as informações de um hábito existente (nome, descrição, categoria, ícone).",
      {
        telegramChatId: z.number().describe("ID do chat do Telegram"),
        telegramUsername: z.string().optional().describe("Nome de usuário do Telegram"),
        firstName: z.string().optional().describe("Primeiro nome do usuário"),
        habitoId: z.string().describe("ID do hábito a editar"),
        novoNome: z.string().optional().describe("Novo nome do hábito"),
        novaDescricao: z.string().optional().describe("Nova descrição"),
        novaCategoria: z.string().optional().describe("Nova categoria"),
        novoIcone: z.string().optional().describe("Novo emoji"),
      },
      async (args) => {
        const resultado = await editarHabito(args);
        return {
          content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
        };
      }
    );

    // ============================================
    // FERRAMENTA 5: Deletar hábito
    // ============================================
    sessionServer.tool(
      "deletar_habito",
      "Deleta permanentemente um hábito e todos os seus registros históricos.",
      {
        telegramChatId: z.number().describe("ID do chat do Telegram"),
        telegramUsername: z.string().optional().describe("Nome de usuário do Telegram"),
        firstName: z.string().optional().describe("Primeiro nome do usuário"),
        habitoId: z.string().describe("ID do hábito a deletar"),
      },
      async (args) => {
        const resultado = await deletarHabito(args);
        return {
          content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
        };
      }
    );

    // ============================================
    // FERRAMENTA 6: Ver estatísticas
    // ============================================
    sessionServer.tool(
      "ver_estatisticas",
      "Exibe as estatísticas de um hábito específico (streak atual, melhor streak, dias completados, horas totais).",
      {
        telegramChatId: z.number().describe("ID do chat do Telegram"),
        telegramUsername: z.string().optional().describe("Nome de usuário do Telegram"),
        firstName: z.string().optional().describe("Primeiro nome do usuário"),
        habitoNome: z.string().describe("Nome do hábito para consultar estatísticas"),
      },
      async (args) => {
        const resultado = await verEstatisticas(args);
        return {
          content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
        };
      }
    );

    // Registra a conexão
    serverConnections[sessionId] = sessionServer;

    // Limpa quando a conexão fecha
    res.on("close", () => {
      delete transports[sessionId];
      delete serverConnections[sessionId];
      console.log(`❌ Conexão SSE fechada: ${sessionId}`);
    });

    // Conecta o servidor ao transporte
    await sessionServer.connect(transport);
    console.log(`✅ Nova conexão SSE estabelecida: ${sessionId}`);
  } catch (err) {
    console.error("❌ Erro ao conectar SSE:", err);
    res.status(500).send("Erro ao conectar ao servidor MCP");
  }
});

// ============================================
// ENDPOINT POST para mensagens
// ============================================
app.post("/messages", express.json(), async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).json({ erro: "Sessão não encontrada" });
  }
});

// ============================================
// ENDPOINT HEALTH CHECK
// ============================================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    banco: "Supabase PostgreSQL",
    versao: "2.0.0",
    ferramentas: [
      "criar_habito",
      "listar_habitos",
      "registrar_execucao",
      "editar_habito",
      "deletar_habito",
      "ver_estatisticas",
    ],
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   ✅ HABIT TRACKER MCP SERVER v2.0 rodando                 ║
╠════════════════════════════════════════════════════════════╣
║   🌐 Servidor: http://localhost:${PORT}                       ║
║   📡 Endpoint SSE: http://localhost:${PORT}/sse                ║
║   ❤️  Health check: http://localhost:${PORT}/health            ║
║   📊 Banco de dados: Supabase PostgreSQL                   ║
║                                                            ║
║   🔧 Ferramentas disponíveis:                              ║
║      1. criar_habito                                       ║
║      2. listar_habitos                                     ║
║      3. registrar_execucao                                 ║
║      4. editar_habito                                      ║
║      5. deletar_habito                                     ║
║      6. ver_estatisticas                                   ║
╚════════════════════════════════════════════════════════════╝
  `);
});