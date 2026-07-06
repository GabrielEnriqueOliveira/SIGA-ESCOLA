# SIGA Escola

Sistema web de controle de faltas escolares para secretaria, com registro de alunos, presença, motivo de falta e notificações por WhatsApp.

## Recursos

- Cadastro de alunos por série/turma
- RA e telefone do responsável
- Marcação de presença e faltas diárias
- Motivo de falta (atestado, doença, outro)
- Envio automático de WhatsApp para responsáveis de alunos ausentes
- Histórico de faltas por data
- Filtro por série/turma
- Suporte para implantação em Railway com MySQL

## Tecnologias

- Node.js
- Express
- MySQL
- HTML/CSS/JavaScript
- WhatsApp Web para envio de notificações

## Instalação local

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
copy .env.example .env
```

3. Ajuste as variáveis de ambiente em `.env`.

4. Crie o banco de dados e as tabelas:

```bash
mysql -u seu_usuario -p < db/schema.sql
```

5. Opcional: carregue exemplos de alunos:

```bash
mysql -u seu_usuario -p < db/seed.sql
```

6. Inicie o servidor:

```bash
npm run dev
```

7. Abra `http://localhost:3000` no navegador.

## Variáveis de ambiente

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT`

## Deploy no Railway

1. Conecte o repositório no Railway.
2. Adicione o plugin MySQL ao projeto Railway.
3. Configure as variáveis de ambiente no Railway.
4. Defina o comando de inicialização:

```bash
npm start
```

> O envio de WhatsApp é feito pelo WhatsApp Web com mensagem pronta para o responsável.

## Observações

- O número de WhatsApp do responsável deve ser cadastrado no formato internacional sem sinais, por exemplo `5598999123456`.
- As faltas são registradas por data e atualizadas caso o mesmo aluno já tenha presença no mesmo dia.
- O sistema organiza os alunos por série no frontend e no histórico.
