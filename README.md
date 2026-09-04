# Card de Comissões de Desenho — Docker Compose

Projeto acadêmico e prático de uma aplicação web desacoplada para gerenciamento e solicitação de comissões artísticas, orquestrada via Docker Compose com comunicação entre containers em rede interna isolada.

---

## 1. Projeto
**Card de Comissões de Desenho**  
Aplicação web interativa para exibição de tipos de comissões artísticas, cálculo dinâmico de orçamento através de carrinho de itens e envio automático de resumo do pedido por e-mail (via SMTP).

---

## 2. Integrantes
* Max Dezan Rossi

---

## 3. Tecnologias Utilizadas

* **Back-end**:
  * [Node.js 20 (Alpine)](https://nodejs.org/)
  * [Express](https://expressjs.com/) (API REST e middlewares CORS / JSON)
  * [Nodemailer](https://nodemailer.com/) (Envio de e-mails via protocolo SMTP)
  * [dotenv](https://github.com/motdotla/dotenv) (Carregamento de variáveis de ambiente)
* **Front-end**:
  * HTML5 Semântico, CSS3 Moderno e JavaScript Puro (Vanilla JS)
  * [Nginx (Alpine)](https://nginx.org/) (Servidor web de arquivos estáticos e Proxy Reverso)
  * `envsubst` (Processamento de templates de configuração em runtime)
* **Infraestrutura e Orquestração**:
  * [Docker](https://www.docker.com/) (Containerização de serviços)
  * [Docker Compose](https://docs.docker.com/compose/) (Orquestração de múltiplos containers e gerenciamento de rede)

---

## 4. Como Executar o Projeto

### Pré-requisitos
* **Windows / macOS**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução.
* **Ubuntu / Linux**: Docker Engine + Plugin Docker Compose instalado (`sudo apt install docker.io docker-compose-v2`).

### Passo a Passo

1. **Configurar as Variáveis de Ambiente do Back-end**:
   Crie o arquivo `.env` no diretório `backend` com base no `.env.example`:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Preencha as credenciais SMTP no arquivo `backend/.env`.

2. **No Ubuntu / Linux (configuração rápida de permissões)**:
   Caso vá executar no Ubuntu, adicione seu usuário ao grupo do Docker para não precisar de `sudo` em cada comando:
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **Subir os Containers com Build**:
   Na raiz do projeto (onde está o `compose.yml`), execute:
   ```bash
   docker compose up --build
   ```
   > Para rodar em segundo plano: `docker compose up --build -d`

4. **Encerrar a Execução dos Containers**:
   ```bash
   docker compose down
   ```

---

## 5. Como Acessar o Front-end

Após a inicialização dos containers, abra o navegador web e acesse:

👉 **[http://localhost:8080](http://localhost:8080)**

---

## 6. Como o Front-end Encontra o Back-end

A comunicação entre o Front-end e o Back-end não utiliza endereços IP fixos nem URLs externas hardcoded no código client-side:

1. O navegador do usuário envia requisições para caminhos relativos na mesma origem do front-end (ex: `GET /api/comissoes` ou `POST /api/pedidos` em `http://localhost:8080/api/...`).
2. O servidor **Nginx** (dentro do container `frontend`) intercepta as requisições sob a rota `/api/` e atua como **Proxy Reverso**, repassando a chamada internamente para `http://backend:3000/api/`.
3. O nome de host `backend` é resolvido automaticamente pelo **servidor DNS interno embutido do Docker**, que traduz o nome do serviço `backend` para o endereço IP privado do container correspondente dentro da rede virtual.
4. O back-end processa a requisição e responde ao Nginx, que por sua vez devolve a resposta ao navegador do cliente sem problemas de CORS ou exposição direta da porta do back-end.

---

## 7. Rede Docker (Bridge Network)

No arquivo `compose.yml`, foi definida uma rede bridge customizada chamada `app-network`:

```yaml
networks:
  app-network:
    driver: bridge
```

### Por que `http://backend:3000` funciona?
* Quando múltiplos containers são associados à mesma rede bridge gerenciada pelo Docker Compose, o Docker cria uma interface de rede isolada e ativa um **DNS interno**.
* Cada serviço se torna detectável por outros containers através do seu **nome de serviço** (`backend`, `frontend`).
* Portanto, dentro do container `frontend`, o nome `backend` funciona como um hostname válido, permitindo que o Nginx converse diretamente com `http://backend:3000`.

---

## 8. Mapeamento de Portas (`ports`)

No `compose.yml`, as portas são declaradas no formato `HOST:CONTAINER`:

```yaml
services:
  backend:
    ports:
      - "3001:3000"  # Opcional / Testes manuais
  frontend:
    ports:
      - "8080:80"    # Acesso do usuário
```

* **Frontend (`8080:80`)**: Mapeia a porta `8080` da máquina host para a porta `80` do Nginx dentro do container. Isso torna a interface visual acessível pelo navegador do usuário em `http://localhost:8080`.
* **Backend (`3001:3000`)**: Mapeia a porta `3001` da máquina host para a porta `3000` do Express.
  * **Importante**: O back-end **NÃO precisaria expor nenhuma porta ao host** para o funcionamento da aplicação web, pois o Nginx acessa o back-end internamente através da rede Docker (`app-network`) na porta 3000.
  * A porta `3001` foi mapeada apenas para fins de depuração e testes manuais da API diretamente pelo desenvolvedor (ex: via Postman, Insomnia ou cURL em `http://localhost:3001/api/comissoes`).

---

## 9. Variáveis de Ambiente (`environment`) e Dynamic Injection

As variáveis de ambiente permitem desacoplar a configuração do código-fonte:

```yaml
services:
  backend:
    environment:
      - PORT=3000
      - SMTP_HOST=${SMTP_HOST:-smtp.example.com}
      - SMTP_PORT=${SMTP_PORT:-587}
      - SMTP_USER=${SMTP_USER:-}
      - SMTP_PASS=${SMTP_PASS:-}
      - EMAIL_DESTINO=${EMAIL_DESTINO:-}

  frontend:
    environment:
      - API_URL=http://backend:3000
```

### Como o Front-end utiliza a variável sem hardcode:
1. Arquivos estáticos (HTML/JS) rodam no navegador do cliente e não têm acesso nativo às variáveis de ambiente do container Docker em tempo de execução.
2. Para solucionar isso, o container `frontend` executa um script [`entrypoint.sh`](frontend/entrypoint.sh) durante a inicialização:
   - Extrai o host e porta de `API_URL` (ex: `backend:3000`).
   - Usa `envsubst` para substituir `${API_UPSTREAM}` no arquivo de template [`nginx.conf.template`](frontend/nginx.conf.template), gerando o `default.conf` do Nginx.
   - Gera dinamicamente o arquivo `config.js` com `window.API_URL = ''` (para que o JavaScript use requisições relativas `/api/...`).
3. **Vantagem**: O código JavaScript e as imagens Docker permanecem genéricos e portáveis. Para apontar a aplicação para outro serviço ou ambiente (staging, produção), basta alterar a variável `API_URL` no `compose.yml` sem recompilar o código-fonte.

---

## 10. Comportamento do `depends_on`

No `compose.yml`, o serviço `frontend` possui a diretiva:

```yaml
depends_on:
  - backend
```

### O que `depends_on` garante:
* **Ordem de Inicialização**: Garante que o container `backend` seja criado e iniciado antes do container `frontend`.

### O que `depends_on` NÃO garante:
* **Prontidão da Aplicação (Readiness)**: Ele **não** espera a aplicação Node.js/Express carregar completamente na memória, conectar-se ao banco/serviço SMTP ou estar pronta para receber requisições HTTP na porta 3000. Ele apenas aguarda o processo de inicialização do container ter início a nível de daemon do Docker.
* *(Para garantir prontidão em cenários avançados, utilizam-se `healthcheck` em conjunto com `condition: service_healthy`)*.

---

## 11. Dificuldades Encontradas e Soluções Adotadas

Durante o desenvolvimento e a orquestração do projeto com Docker Compose, foram enfrentados e solucionados os seguintes desafios técnicos:

### 1. Injeção de Variáveis de Ambiente em Front-end Estático (Client-Side)
* **Dificuldade**: Aplicações puramente estáticas (HTML/CSS/JS) rodam no navegador do usuário final e não no servidor, não tendo acesso a `process.env`. Se o endereço do back-end fosse hardcoded no JavaScript (ex: `http://localhost:3000`), a aplicação não funcionaria em outros ambientes e violaria a exigência de usar variáveis de ambiente do Docker Compose.
* **Solução**: Foi implementada uma arquitetura com **Nginx atuando como Servidor Web e Proxy Reverso**. O container do front-end executa um script [`entrypoint.sh`](frontend/entrypoint.sh) na inicialização que lê a variável `API_URL`, substitui o upstream no [`nginx.conf.template`](frontend/nginx.conf.template) via `envsubst` e gera dinamicamente a configuração do Nginx. Dessa forma, as chamadas da API são feitas de forma relativa (`/api/...`) e roteadas internamente pelo Nginx diretamente para `http://backend:3000`, eliminando URLs fixas e prevenindo problemas de CORS.

### 2. Carregamento de Credenciais e Variáveis no Back-end
* **Dificuldade**: Ao preencher as configurações do serviço SMTP no arquivo `.env` dentro do diretório `backend/`, o Docker Compose originalmente utilizava valores padrão (`smtp.example.com`) declarados no arquivo de composição quando não encontrados na raiz, gerando falha de resolução DNS (`ENOTFOUND smtp.example.com`) ao tentar disparar e-mails.
* **Solução**: Ajustou-se o `compose.yml` para utilizar a diretiva explícita `env_file: - ./backend/.env`. Isso garantiu que o Compose carregue diretamente o arquivo de ambiente editado no back-end, injetando as variáveis no container sem necessidade de duplicar arquivos.

### 3. Conflito de Portas e Gerenciamento de Containers Órfãos
* **Dificuldade**: Durante testes de recriação de containers em ambientes com múltiplas execuções, ocorreu o erro `Bind for 0.0.0.0:8080 failed: port is already allocated`, indicando que a porta do host já estava vinculada a um container remanescente em segundo plano.
* **Solução**: Foi realizada uma inspeção via `docker ps -a` para rastrear processos que mantinham a porta aberta, efetuando a finalização e remoção com `docker stop` e `docker rm`. Para evitar recorrência, padronizou-se o fluxo de encerramento utilizando `docker compose down`, que desmonta os containers, redes e vínculos de porta de forma limpa.

### 4. Cache de Assets Estáticos do Navegador Durante o Ciclo de Build
* **Dificuldade**: Ao atualizar o código-fonte do front-end e reconstruir as imagens Docker, o navegador persistia servindo versões antigas em cache dos arquivos `app.js` e `style.css`, dando a falsa impressão de que o container não havia sido atualizado.
* **Solução**: O fluxo de desenvolvimento foi ajustado para reconstruir as imagens explicitamente com `docker compose up -d --build` e forçar o recarregamento limpo no navegador através de *Hard Reload* (`Ctrl + Shift + R` ou limpeza de cache no DevTools), garantindo que os novos assets compilados pelo Nginx fossem imediatamente baixados.

