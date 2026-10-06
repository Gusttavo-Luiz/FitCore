# Sidnei Muller Coach — Site de consultoria online

Repositório FitCore. Os dados do coach (Instagram, link do checkout, cupom) ficam em `js/config.js`.

📄 **Documentação completa:** [docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md) — tecnologias, estrutura de arquivos, funções, dados, publicação e histórico de mudanças.

Site estático (HTML/CSS/JS puro, sem dependências) para consultoria de personal trainer.

- `index.html` — página inicial com recursos, planos, depoimentos e login (Aluno ou Personal).
- `app.html` — área logada com rotas por hash:
  - **Aluno** (`#/cliente/...`): dashboard, treinos (marcar exercícios, cronômetro de descanso), biblioteca de exercícios com vídeos, dieta, evolução, avaliação física com fotos, agenda, pagamentos, mensagens e perfil.
  - **Personal** (`#/personal/...`): dashboard, alunos, fichas de treino por aluno (criar, editar, duplicar, copiar), biblioteca (cadastrar link de vídeo por exercício), avaliações, financeiro (cobranças, marcar pago), agenda e mensagens.

Novas telas ficam em `js/features/`. Os pagamentos são apenas uma demonstração: nenhum valor é cobrado. Para cobrar de verdade é preciso integrar um provedor (Mercado Pago, Stripe, PagSeguro).

Os dados de exemplo ficam em `js/data.js`; tudo o que o usuário faz (inclusive fotos das avaliações, reduzidas para 480 px) é salvo no `localStorage` do navegador, que costuma ter limite de ~5 MB.

Para rodar: abra `index.html` no navegador ou sirva a pasta (`python3 -m http.server`).

Publicado via GitHub Pages: https://gusttavo-luiz.github.io/FitCore/
