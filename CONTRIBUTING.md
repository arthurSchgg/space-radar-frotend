# Guia de colaboração — Space Radar

## Processo
1. Criar issue do escopo com prioridades e checklist.
2. Criar feature/* a partir de develop.
3. Implementar somente o escopo daquela issue, sem segredos.
4. Commits semânticos: feat(radar), feat(data), fix(ui), docs, test, chore.
5. Abrir PR feature/* → develop vinculado à issue.
6. Rodar CI, revisar impacto visual, responsividade e acessibilidade.
7. Fazer merge em develop após os testes.
8. Preparar release develop → main **somente após homologação**.

## Definition of Done
- [ ] Implementação e critérios de aceite concluídos
- [ ] Sem dependências desnecessárias ou arquivos secretos
- [ ] Sintaxe JS e testes de dados passam
- [ ] Estados loading, vazio, erro e demonstração verificáveis
- [ ] Dados científicos não confundidos com movimento cenográfico
- [ ] Acessível por teclado e adaptado ao celular
- [ ] Documentação e variáveis de deploy atualizadas
- [ ] Integração real com backend homologada (para release)
- [ ] PR revisado e com evidências antes do merge

## Separação
HTML = semântica; CSS = aparência; data.js = API e modelo; radar.js = renderização; app.js = UI. O frontend jamais recebe token admin nem chave NASA.
