# FluxBoard — Kanban Simples (Tema Minimalista)

Site estático (HTML/CSS/JS) que implementa um Kanban parecido com Trello,
salvando os dados no `localStorage`. Fácil de hospedar em GitHub Pages, Netlify ou Vercel.

## Recursos
- Drag & drop nativo (HTML5)
- Criar / Editar / Excluir cards
- Avançar status (por card e em lote por código)
- Export / Import JSON
- Persistência local (localStorage)
- Timer em tempo real por status
- Identificador de usuário (salvo localmente)

## Como usar localmente
1. Coloque os arquivos `index.html`, `styles.css`, `app.js` na mesma pasta.
2. Abra `index.html` no navegador (ou rode um servidor estático).
3. Use a interface: registre seu nome no campo superior, clique em "+ Nova Demanda".

## Deploy rápido (GitHub Pages)
1. Crie um repositório no GitHub.
2. Envie os arquivos (push).
3. Em Settings > Pages, selecione o branch `main` e root (/) e salve.
4. Aguarde a URL `https://<seu-usuario>.github.io/<repo>/`.

## Observações
- Para migrar para Firebase no futuro, eu posso gerar uma versão que salva no Firestore com autenticação.
