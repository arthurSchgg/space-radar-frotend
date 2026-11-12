/*
 * Endereço PÚBLICO do backend. Exemplo: "https://sua-api.onrender.com"
 * Para desenvolvimento local, altere temporariamente para http://localhost:8484.
 * Em produção, o build da Vercel substitui este valor usando SPACE_RADAR_API_URL.
 * NUNCA inclua tokens, senhas, NASA_API_KEY ou RADAR_ADMIN_TOKEN neste arquivo.
 */
window.SPACE_RADAR_CONFIG = Object.freeze({
  API_BASE_URL: "https://space-radar-backend.onrender.com",
  REQUEST_TIMEOUT_MS: 90000,
  PAGE_SIZE: 50
});
