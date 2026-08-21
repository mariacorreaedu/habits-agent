FROM n8n:latest

# Expõe a porta padrão do n8n
EXPOSE 5678

# Variáveis de ambiente padrão
ENV N8N_PROTOCOL=https
ENV N8N_HOST=0.0.0.0
ENV N8N_PORT=5678
ENV N8N_EDITOR_BASE_URL=${N8N_WEBHOOK_URL}
ENV WEBHOOK_TUNNEL_URL=${N8N_WEBHOOK_URL}

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5678/healthz || exit 1

CMD ["n8n", "start"]