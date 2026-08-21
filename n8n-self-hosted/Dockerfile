FROM n8nio/n8n:latest

# Expose padrão (n8n já tá configurado pra rodar na porta 5678)
EXPOSE 5678

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5678/healthz || exit 1