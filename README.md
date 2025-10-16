# GitLab Issues SLA Dashboard

Um dashboard **estático e leve** para monitorar issues do GitLab (Open Finance / Open Insurance), com **regras de SLA**, **filtros**, **ordenação**, **comentários locais** e uma página de **dashboard** com indicadores e tendências.

---

## 🔎 O que é (e o que resolve)
- **Triagem rápida** de issues: quem abriu, quando, há quantos dias úteis está em aberto e como está versus o **SLA**.
- **Fechadas por período**: visualize issues **fechadas** em qualquer intervalo de datas (padrão inicial: **7 dias**).
- **Visão executiva**: **Dashboard** com KPIs, séries temporais (linhas) e rankings (autores, WGs, produtos etc.), todos com **seletor de período** (padrão: **30 dias**).

---

## 🧭 Páginas & Navegação
**View →**
1. **Open issues** – lista de issues abertas.
2. **Closed issues** – issues fechadas, com **intervalo customizável** (início e fim).
3. **Dashboard** – KPIs e gráficos, com **seletor de período** (7/14/30/60/90).

Troque entre **dark / light** e **PT / EN** a qualquer momento. A preferência é salva em `localStorage` e é **sincronizada** entre a lista e o dashboard. O site abre **em dark** por padrão.

---

## 🧩 Principais Funcionalidades

- **SLA em dias úteis**
  - Cálculo de **dias úteis** (desconsidera fins de semana).
  - Classificação visível por chip (ex.: _Within SLA_, _Over SLA_, _No SLA_, _Paused_).
  - Regras de SLA configuráveis (limiares e status que pausam).

- **Taxonomia de labels**
  Labels agrupadas automaticamente em **Nature**, **Status**, **Platform**, **Working Group (WG)** e **Product**.
  (Qualquer label fora das famílias reconhecidas cai em **Product**.)

- **Filtros e ordenação**
  - Filtros por chips (multi-seleção).
  - Ordenação por **ID**, **Título**, **Criado em**, **Working Days**, **SLA** etc., com setas ↑↓.
  - **Reset filters** com um clique.

- **Comentários por issue (locais)**
  - Campo inline + edição expandida em modal.
  - Salvos no navegador (`localStorage`).
  - **Clear all comments** disponível.

- **Dashboard (Executivo)**
  - **KPIs**: Abertas, Fechadas, Abertas no período, Tempo médio de fechamento (dias úteis).
  - **Tendências** (linhas): Criadas por dia, Fechadas por dia.
  - **Distribuições & Rankings**: por **dia da semana**, **Top autores**, **Top WGs**, **Top produtos**, **Top comentadas / 👍**.
  - **Seletor de período** global aplicado a todos os cards.

---

## ⚙️ Como rodar (local)

1) Baixe estes arquivos para a mesma pasta:
```
index.html
styles.css
script.js
dashboard.html
dashboard.css
dashboard.js
```
2) Abra `index.html` no navegador.

> É 100% **estático**. Não precisa build, servidor nem variáveis de ambiente.

---

## 🚀 Deploy (Netlify / Vercel / GitHub Pages)

1) Suba os arquivos para um repositório.
2) Configure o provedor para servir como **site estático** a partir da raiz.
3) (Opcional) Configure domínio.
> As chamadas são à **API pública do GitLab**; verifique limites de rate-limit em caso de alto tráfego.

---

## 🔧 Configuração (onde mexer)

- **Projetos GitLab**
  - Em `script.js`/`dashboard.js`, ajuste os `projectId` das chamadas de API.

- **Regras de SLA**
  - Em `script.js`, edite os **thresholds** (dias úteis) e status que **pausam** o SLA.

- **Taxonomia de labels**
  - Em `script.js` e `dashboard.js`, edite os conjuntos de labels reconhecidos (Nature, Status, Platform, WG).
  - Labels fora dessas famílias são tratadas como **Product**.

- **Períodos padrão**
  - **Closed issues**: inicial **7 dias** (alterável na UI).
  - **Dashboard**: inicial **30 dias** (alterável via seletor).

- **Idioma & Tema**
  - Chaves simples PT/EN; adicione traduções se criar novos textos.
  - Tema **dark** por padrão; toggle sincronizado entre páginas.

---

## 🗂️ Estrutura sugerida
```
/ (raiz)
 ├─ index.html          # Lista (open/closed) + filtros, SLA, comentários
 ├─ styles.css          # Estilos globais, chips, tabelas, dark/light
 ├─ script.js           # Lógica (fetch GitLab, SLA, filtros, i18n, tema)
 ├─ dashboard.html      # Página executiva
 ├─ dashboard.css       # Estilos do dashboard
 └─ dashboard.js        # KPIs, gráficos (SVG), rankings, período global
```

---

## 🧪 Dicas & Troubleshooting

- **“Nada aparece”**
  - Verifique o _Console_ do navegador (erros de sintaxe interrompem o JS).
  - Confirme conectividade com `gitlab.com` (algumas redes bloqueiam).

- **Limite da API**
  - A API pública do GitLab possui rate-limit. Requisições em excesso podem retornar 429.

- **Comentários sumiram**
  - Os comentários são locais (navegador). Limpeza de dados do site apaga os textos.

- **Tema/idioma não aplicam**
  - Faça **hard refresh** (Ctrl/Cmd+Shift+R).
  - Confira `localStorage.lang` e `localStorage.theme`.

---

## 📌 Roadmap (sugestões)
- Exportar CSV/Excel das listas filtradas.
- Breakdown por **Nature**/**Status** no dashboard.
- Cache leve por sessão para reduzir chamadas à API.
