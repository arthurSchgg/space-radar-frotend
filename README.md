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

Não usa React, Vue, Tailwind ou Vite. O desenvolvimento local é estático; para deploy na **Vercel**, um script Node.js sem dependências gera `dist/` e injeta somente a URL **pública** da API.

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

3. Acesse **http://localhost:5500**. Como a URL de API versionada vem vazia por padrão, o app inicia em **DEMONSTRAÇÃO — Dados 100% fictícios**.

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

4. Configure o backend para permitir a origem do frontend com **RADAR_CORS_ORIGINS** (por exemplo, http://localhost:5500). Para testes no IntelliJ, use `http://localhost:8484` caso essa seja sua porta; não envie essa alteração local para o Git.
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

## Deploy na Vercel (frontend)

O repositório inclui `vercel.json` e `scripts/build.cjs`; **não precisa de framework nem de npm install** para publicar.

1. Primeiro implante o backend no Render e copie a URL HTTPS pública dele (exemplo ilustrativo: `https://space-radar-api.onrender.com`).
2. Na Vercel, importe este repositório e selecione a branch **main**. Framework Preset: **Other**; Root Directory: `.`.
3. Em **Settings → Environment Variables**, configure `SPACE_RADAR_API_URL` com a **origem HTTPS pública da API**, sem barra no final. **Não é segredo**: o navegador precisa conhecê-la.
4. O `vercel.json` executa `node scripts/build.cjs` e publica `dist/`. O script valida a URL HTTPS e gera `dist/js/config.js`; **não altera o arquivo versionado `js/config.js`**.
5. Configure no Render `RADAR_CORS_ORIGINS=https://seu-site.vercel.app` (e também domínio customizado, se houver), e reinicie a API.
6. Faça o deploy e consulte o frontend; a API deve ter dados NASA importados para o período escolhido.

**Se `SPACE_RADAR_API_URL` estiver ausente ou não for HTTPS, a build falha intencionalmente** para não publicar produção inadvertidamente em demonstração ou com `localhost`. Após cadastrar/alterar a variável na Vercel, realize um novo deploy.

Execução local simples **continua sem build**: sirva `index.html` com Live Server e configure `js/config.js` no seu computador somente durante os testes. `dist/` e `.history/` não são enviados ao Git.

### Checagem local da build da Vercel

~~~powershell
$env:SPACE_RADAR_API_URL="https://api-publica.example.com"
node scripts/build.cjs
Remove-Item Env:SPACE_RADAR_API_URL
~~~

O endereço acima é apenas um exemplo para verificar a geração do diretório `dist/`; não corresponde a um backend existente.

## Deploy no Render (backend)

O backend Spring Boot utiliza um **Web Service** com Docker e PostgreSQL persistente no Render; o frontend vai para a Vercel, não para um Static Site no Render.

1. No Render, conecte `space-radar-backend` na branch `main`, com runtime **Docker** e Dockerfile `docker/Dockerfile`, usando a raiz do repositório como contexto.
2. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` a partir do PostgreSQL do Render. Não use `localhost` para o banco hospedado.
3. Configure `NASA_API_KEY`, `RADAR_ADMIN_TOKEN` e `RADAR_CORS_ORIGINS` no serviço do Render, nunca no GitHub/Vercel. Para carregar dados da NASA automaticamente, habilite `RADAR_SYNC_ENABLED=true` e `RADAR_SYNC_ON_STARTUP=true`.
4. Configure health check `/actuator/health` e confirme que `/v1/radar` responde antes de integrar a Vercel.
5. Gere **novas** credenciais para produção: o backend registra no README que credenciais antigas já foram versionadas historicamente.

A NASA NeoWs fornece aproximações reais, mas as posições e movimentos 3D são esquemáticos. Homologação em dispositivos reais continua pendente antes da publicação oficial.

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


## Ajustes de responsividade e refinamento 3D

A partir da versão de polimento visual:
- **Desktop acima de 900px:** radar ao centro, controles à esquerda, lista à direita.
- **Tablet/celular até 900px:** navegação fixa com três abas **Radar · Objetos · Filtros**, separando as áreas de interação e evitando que os painéis escondam o radar.
- Painel de detalhes em formato sobreposto com fechamento por botão e toque fora; botões e controles com áreas de toque maiores.
- Suporte a safe areas do dispositivo, telas compactas desde 320px, orientação paisagem, rolagem própria dos painéis e foco visível.
- Botão **Centralizar câmera**; gestos de pinça e arrasto no radar.
- Terra com shader de atmosfera, globo texturizado, luz de preenchimento e fallback independente da internet.
- Asteroides com relevo procedural determinístico, rotação cenográfica lenta, brilho e cor por classificação.
- WebGL limitado a aproximadamente **30 FPS** e DPR reduzido em telas até 900px (60 FPS em desktop); não renderiza a cena quando a aba está oculta.
- Eventos e dados científicos continuam vindo exclusivamente do backend configurado; a trajetória dos objetos permanece **esquemática**.

### Testes automatizados de interface

Além dos testes de dados em Node.js, o GitHub Actions executa um teste de navegação responsiva em **Chromium** nos tamanhos 320×568, 375×667, 390×844, 768×1024, 812×375, 1024×768 e 1440×900. Ele confere overflow horizontal, abas, seleção, detalhes, fechamento, reset da câmera e ausência de exceções JS.

O workflow envia capturas mobile-375.png e desktop-1440.png como artefato responsive-preview para revisão visual. Mesmo com o teste automatizado, **a homologação física de Android/iOS e a integração em produção continuam pendentes**.


## Classificação visual: turquesa × coral

**A distinção agora é visível sem depender apenas de cor:**

| Classificação NASA | Cor | Forma | Exibição |
|---|---|---|---|
| Não classificado como potencialmente perigoso | Turquesa (#49efce) | Losango | Marcador 3D de brilho turquesa e lista com borda verde-água |
| Potencialmente perigoso (PHA) | Coral/laranja (#ff7455) | Exclamação e anel de alerta com quatro marcações | Brilho quente mais intenso, contorno na cena, prioridade de leitura na lista e detalhe destacado |

Os asteroides da página são **agrupados na lista**, com os potencialmente perigosos em primeiro lugar e os demais em seguida; em cada grupo há ordenação por distância.

Os cartões coloridos e a barra mostram **contagens apenas dos eventos da página atualmente carregada** pela API (não são totais de todos os asteroides catalogados pela NASA). Em modo demonstração, todos os dados continuam **explicitamente fictícios**.

> "Potencialmente perigoso" é uma classificação astronômica de atenção; não significa que haja previsão de impacto. Posições, anéis e movimentos no radar continuam sendo representações cenográficas dos dados de aproximação.
