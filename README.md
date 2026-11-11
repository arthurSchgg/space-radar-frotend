# ✳ Space Radar — Frontend

**Observatório interativo de aproximações de asteroides próximos da Terra**, com Terra 3D no centro, anéis de distância, varredura estilizada e Via Láctea artística.

> **Importante:** o radar é uma **simulação visual**. A NASA NeoWs fornece datas de aproximação, distâncias, velocidades, diâmetros estimados e classificação de perigo potencial, **não coordenadas 3D ou órbitas em tempo real**. Posição angular e movimento dos marcadores são fictícios. Uma classificação de perigo potencial não significa colisão prevista.

## Tecnologias

- **HTML5** sem framework
- **CSS3** com variáveis, transparência, layout responsivo e acessibilidade
- **JavaScript nativo** (DOM, fetch, Intl, estado)
- **Three.js r128** para renderização WebGL 3D (via CDN, não requer npm para rodar)
- Testes com **Node.js** nativo (apenas desenvolvimento / CI)
- Integração com backend **Spring Boot + PostgreSQL + NASA NeoWs**

Não usa React, Vue, Tailwind, Vite nem etapa de build.

## Funcionalidades

- Globo terrestre central com rotação, textura e iluminação; textura artística interna e opção de carregar textura de demonstração do Three.js
- Fundo estelar e faixa artística da Via Láctea
- Anéis com referência de distância lunar, varredura de radar, iluminação de asteroides
- Arrastar para girar a câmera, rolar/pinçar para dar zoom, clicar nos asteroides para selecionar
- Lista de objetos sincronizada com seleção e card de detalhes
- Filtro de objetos perigosos, datas e distância máxima; busca de nome/ID na página carregada
- Velocidade do **movimento ilustrativo**, opção de desligar varredura, Via Láctea e autorrotação
- Respeito à preferência do sistema por movimento reduzido, navegação pela lista usando teclado
- Paginação, estados de erro e modo demonstrativo **explicitamente fictício**
- Backend configurável em arquivo separado — nenhuma chave secreta no frontend

## Estrutura do projeto

~~~text
space-radar-frotend/
├── index.html
├── assets/
│   └── favicon.svg
├── css/
│   └── style.css
├── js/
│   ├── config.js        # URL pública da API
│   ├── data.js          # Adapter REST, validação e demo
│   ├── radar.js         # Cena Three.js, Terra, objetos, interação
│   └── app.js           # Estado, controles, lista, detalhes
├── tests/
│   └── data.test.js
├── .github/workflows/ci.yml
├── CONTRIBUTING.md
└── README.md
~~~

## Começando rapidamente

Não há build.

1. Clone a branch de integração após aprovação do PR:

~~~bash
git clone -b develop https://github.com/arthurSchgg/space-radar-frotend.git
cd space-radar-frotend
~~~

2. Abra com Live Server do VS Code ou execute um servidor HTTP local:

~~~bash
python -m http.server 5500
~~~

3. Acesse **http://localhost:5500**. Como a URL de API vem vazia por padrão, o app inicia em **DEMONSTRAÇÃO — Dados 100% fictícios**.

Também é possível acessar com **?demo=1** para forçar o modo demonstração quando uma URL de API já estiver configurada.

A CDN Three.js e as fontes Google exigem internet; se não puder carregar WebGL, a lista continua acessível.

## Conectar ao backend real

Repositório: [space-radar-backend](https://github.com/arthurSchgg/space-radar-backend).

1. Execute o backend Spring Boot com PostgreSQL (consulte o README do backend).
2. Importe um período de dados NASA no backend, pela rota administrativa protegida. Não coloque o token no navegador.
3. Edite **somente a URL pública** de **js/config.js**:

~~~js
window.SPACE_RADAR_CONFIG = Object.freeze({
  API_BASE_URL: "http://localhost:8181",
  REQUEST_TIMEOUT_MS: 16000,
  PAGE_SIZE: 50
});
~~~

4. Configure o backend para permitir a origem do frontend com **RADAR_CORS_ORIGINS** (por exemplo, http://localhost:5500).
5. Atualize a página. Se a API foi configurada, o frontend inicia em modo API; também existe o botão **Usar demonstração**.

**Segurança:** nunca inclua NASA_API_KEY, DB_PASSWORD, RADAR_ADMIN_TOKEN ou segredos de qualquer tipo no frontend.

### Contrato da API

GET /v1/radar

Parâmetros de consulta: startDate, endDate (ISO yyyy-MM-dd), hazardousOnly, maxDistanceKm, page, size.

~~~json
{
  "visualizationMode": "SCHEMATIC_DISTANCE_ONLY",
  "realTimeCoordinatesAvailable": false,
  "events": {
    "content": [{
      "id": "00000000-0000-4000-8000-000000000001",
      "asteroidId": "00000000-0000-4000-8000-000000000002",
      "nasaId": 123456,
      "asteroidName": "EXEMPLO",
      "hazardous": false,
      "approachAtUtc": "2026-11-13T10:25:00Z",
      "velocityKmS": 12.7,
      "distanceKm": 3500000,
      "lunarDistance": 9.11
    }],
    "page": 0,
    "size": 50,
    "totalElements": 1,
    "totalPages": 1
  }
}
~~~

O JSON é **apenas um exemplo de formato**, não representa uma observação real.

Se o diâmetro não estiver disponível no objeto de aproximação, a interface consulta GET /v1/space-radar/{nasaId} ao selecionar um objeto, exibindo maxDiameterM.

A API retorna **eventos de aproximação**, não posições atuais. O radar não utiliza coordenadas astronômicas reais.

### Estados esperados

| Estado | Comportamento |
| --- | --- |
| Sem URL de backend | Demonstração fictícia identificada |
| API disponível com eventos | Marcadores, lista e detalhes reais de aproximação |
| API disponível sem importação para a data | Lista vazia; não inventa eventos |
| API indisponível | Exibe erro e oferece alternar manualmente para demonstração |
| WebGL indisponível | Lista e filtros continuam utilizáveis |
| Movimento reduzido | Desativa movimento de câmera/asteroides |

## Executar testes

Requer Node.js 20+ **apenas para testes**, não para renderizar o site.

~~~bash
node --check js/config.js
node --check js/data.js
node --check js/radar.js
node --check js/app.js
node --test tests/data.test.js
~~~

O GitHub Actions executa essas verificações em PRs de feature e pushes para develop/main.

## Deploy na Vercel

1. Importe o repositório no painel Vercel.
2. Framework: **Other**.
3. Root Directory: **.**; sem comando de build; site estático.
4. Para produção, edite **js/config.js** apontando para o backend HTTPS público e abra PR de release.
5. Inclua a origem HTTPS do frontend no CORS do backend.
6. Homologue e publique a **main**.

## Deploy no Render (Static Site)

1. Conecte o repositório como **Static Site**.
2. Use a branch **main** depois de aprovar a release.
3. Build Command: echo "Static site - no build".
4. Publish Directory: **.**.
5. Configure a URL HTTPS pública do backend no arquivo de config do frontend; configure CORS correspondente no backend.

Para hospedar o backend Spring Boot, é necessário um **Web Service** e banco PostgreSQL persistente, separados da hospedagem estática do frontend.

## Git Flow

~~~text
main                         releases / produção
 └── develop                 integração e testes
      └── feature/*          uma issue/funcionalidade por branch
~~~

- Crie **issues** com critérios de aceite.
- Use **Conventional Commits** (feat, fix, docs, test, refactor, chore).
- PR de feature **para develop**, revisão e CI obrigatórios.
- PR de release **develop para main** após homologação.
- Hotfixes partem de main e devem ser reaplicados à develop.

As issues de homologação permanecem abertas até teste visual e integração de ponta a ponta.

## Acessibilidade e limitações

- As interações essenciais podem ser feitas pela lista de asteroides, usando teclado.
- O WebGL é opcional para leitura dos dados.
- Efeitos visuais se ajustam a telas menores; controles usam HTML semântico.
- A varredura, a altura de cada marcador, a direção e a velocidade de animação não correspondem a elementos orbitais reais.
- É necessário verificar o funcionamento em dispositivos e navegadores reais antes do lançamento.

Projeto educacional independente; não é um sistema oficial da NASA.
