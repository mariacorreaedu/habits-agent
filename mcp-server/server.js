import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import dotenv from "dotenv";
import {
  criarTarefa,
  listarTarefas,
  buscarTarefa,
  editarTarefa,
  deletarTarefa,
} from "./supabase.js";

dotenv.config();

// ---------- 1. O servidor MCP será criado por conexão (abaixo) ----------
// Isso evita conflitos quando múltiplas conexões SSE chegam ao mesmo tempo

// ---------- 2. Expõe o servidor via HTTP (SSE) para o n8n se conectar ----------
const app = express();
const PORT = process.env.PORT || 3001;

const transports = {};
const serverConnections = {};

app.get("/sse", async (req, res) => {
  try {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;
    
    // Cria uma nova instância de servidor para cada conexão
    const sessionServer = new McpServer({
      name: "habits-mcp-server",
      version: "2.0.0",
    });

    // Registra as mesmas 5 ferramentas pra esse servidor
    sessionServer.tool(
      "criar_habito",
      "Cria/registra um novo hábito no banco de dados.",
      {
        habito: z.string().describe("Nome do hábito"),
        status: z.enum(["completo", "pendente", "falhou"]).describe("Status do hábito"),
        dias_consecutivos: z.number().optional(),
        observacao: z.string().optional(),
      },
      async (args) => {
        const resultado = await criarTarefa(args);
        return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
      }
    );

    sessionServer.tool(
      "listar_habitos",
      "Lista todos os hábitos registrados.",
      {},
      async () => {
        const resultado = await listarTarefas();
        return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
      }
    );

    sessionServer.tool(
      "buscar_habito",
      "Busca um hábito específico.",
      {
        termo: z.string().describe("Nome ou id do hábito"),
      },
      async (args) => {
        const resultado = await buscarTarefa(args);
        return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
      }
    );

    sessionServer.tool(
      "editar_habito",
      "Edita um hábito existente.",
      {
        id: z.union([z.string(), z.number()]).describe("Id do hábito"),
        status: z.enum(["completo", "pendente", "falhou"]).optional(),
        dias_consecutivos: z.number().optional(),
        observacao: z.string().optional(),
      },
      async (args) => {
        const resultado = await editarTarefa(args);
        return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
      }
    );

    sessionServer.tool(
      "deletar_habito",
      "Remove um hábito.",
      {
        id: z.union([z.string(), z.number()]).describe("Id do hábito"),
      },
      async (args) => {
        const resultado = await deletarTarefa(args);
        return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
      }
    );

    serverConnections[sessionId] = sessionServer;
    
    res.on("close", () => {
      delete transports[sessionId];
      delete serverConnections[sessionId];
    });

    await sessionServer.connect(transport);
  } catch (err) {
    console.error("Erro ao conectar SSE:", err);
    res.status(500).send("Erro ao conectar ao servidor MCP");
  }
});

app.post("/messages", express.json(), async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("Sessão não encontrada");
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", banco: "Supabase" });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor MCP de Hábitos rodando em http://localhost:${PORT}`);
  console.log(`   Endpoint SSE: http://localhost:${PORT}/sse`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Banco de dados: Supabase (Postgres)`);
});