# FitCore Pro — Site para Personal Trainer

Site estático (HTML/CSS/JS puro, sem dependências) para consultoria de personal trainer.

- `index.html` — página inicial com recursos, planos, depoimentos e login (Aluno ou Personal).
- `app.html` — área logada com rotas por hash:
  - **Aluno** (`#/cliente/...`): dashboard, treinos (marcar exercícios, cronômetro de descanso), dieta (refeições e macros), evolução (gráficos e registro de medições), agenda, mensagens e perfil.
  - **Personal** (`#/personal/...`): dashboard com faturamento e aderência, lista/cadastro de alunos, agenda e mensagens.

Os dados de exemplo ficam em `js/data.js`; o progresso do usuário é salvo no `localStorage` do navegador.

Para rodar: abra `index.html` no navegador ou sirva a pasta (`python3 -m http.server`).

Publicado via GitHub Pages: https://gusttavo-luiz.github.io/FitCore/
