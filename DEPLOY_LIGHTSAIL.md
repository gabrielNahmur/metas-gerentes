# Deploy na Amazon Lightsail

Guia completo para deploy da aplicação Metas de Gerentes na Lightsail.

---

## ⚠️ Pré-requisito Importante

Esta aplicação precisa acessar o **SQL Server da empresa** (192.168.20.250). Como a Lightsail está na nuvem e o SQL Server está na rede interna, você precisará configurar um **túnel SSH** entre os dois.

---

## Parte 1: Configurar a Lightsail

Conecte via SSH na sua Lightsail:

```bash
ssh ubuntu@3.239.244.231
```

### 1.1 Instalar Node.js

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node -v    # Deve mostrar v20.x.x
npm -v     # Deve mostrar 10.x.x
```

### 1.2 Instalar PM2

```bash
sudo npm install -g pm2
pm2 -v
```

### 1.3 Clonar o projeto

```bash
cd ~
git clone https://github.com/gabrielNahmur/metas-gerentes.git
cd metas-gerentes

# Instalar dependências
npm install

# Criar pasta de dados
mkdir -p data
```

### 1.4 Configurar porta no firewall da Lightsail

No **console da AWS Lightsail**:

1. Vá em **Networking**
2. Clique em **Add rule**
3. Adicione:
   - **Application:** Custom
   - **Protocol:** TCP
   - **Port:** 3000
4. Clique **Create**

---

## Parte 2: Configurar Túnel SSH (Servidor da Empresa → Lightsail)

Este túnel permite que a Lightsail acesse o SQL Server através do servidor da empresa.

### 2.1 Na Lightsail - Gerar chave SSH

```bash
# Gerar chave
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_tunnel -N ""

# Mostrar chave pública
cat ~/.ssh/id_tunnel.pub
```

**Copie todo o conteúdo** (começa com `ssh-rsa...`).

### 2.2 Na Lightsail - Configurar SSH para aceitar conexões

```bash
# Editar configuração SSH
sudo nano /etc/ssh/sshd_config
```

Adicione estas linhas no final:

```
GatewayPorts yes
AllowTcpForwarding yes
```

Salve (Ctrl+O, Enter, Ctrl+X) e reinicie SSH:

```bash
sudo systemctl restart sshd
```

### 2.3 No servidor da empresa (Windows) - Configurar chave

1. Abra **PowerShell como Administrador**
2. Execute:

```powershell
# Criar pasta .ssh
mkdir C:\Users\Administrador\.ssh -Force

# Baixar chave da Lightsail
# Cole este comando e depois cole a chave pública que você copiou
notepad C:\Users\Administrador\.ssh\authorized_keys
```

3. Cole a chave pública no bloco de notas
4. Salve e feche

### 2.4 No servidor da empresa - Testar conexão

```powershell
ssh ubuntu@3.239.244.231
```

Se pedir senha, a chave não foi configurada corretamente.
Se conectar direto, está OK! ✅

### 2.5 No servidor da empresa - Criar túnel persistente

Instale o **autossh** (mantém o túnel ativo):

```powershell
# Baixar autossh para Windows ou usar o túnel manualmente:
ssh -R 1433:192.168.20.250:1433 ubuntu@3.239.244.231 -N -f
```

Este comando expõe a porta 1433 do SQL Server como `localhost:1433` na Lightsail.

---

## Parte 3: Configurar a aplicação na Lightsail

### 3.1 Alterar arquivo de conexão SQL

Na Lightsail:

```bash
cd ~/metas-gerentes
nano backend/sql-connection.js
```

Mude a linha do servidor:

```javascript
const config = {
  server: "localhost", // ← MUDAR DE 192.168.20.250 PARA localhost
  // ... resto igual
};
```

Salve (Ctrl+O, Enter, Ctrl+X).

### 3.2 Iniciar a aplicação

```bash
cd ~/metas-gerentes
pm2 start backend/server.js --name metas-gerentes
pm2 save
pm2 startup
```

### 3.3 Testar

```bash
curl http://localhost:3000/api/metas
```

---

## Parte 4: Acessar externamente

Acesse no navegador:

```
http://3.239.244.231:3000
```

---

## Resumo de comandos

### Lightsail

```bash
# Iniciar
pm2 start metas-gerentes

# Parar
pm2 stop metas-gerentes

# Reiniciar
pm2 restart metas-gerentes

# Ver logs
pm2 logs metas-gerentes

# Atualizar código
cd ~/metas-gerentes && git pull && pm2 restart metas-gerentes
```

### Servidor da Empresa (manter túnel)

```powershell
ssh -R 1433:192.168.20.250:1433 ubuntu@3.239.244.231 -N
```

---

## Troubleshooting

| Problema                 | Solução                                                |
| ------------------------ | ------------------------------------------------------ |
| Conexão SQL falha        | Verificar se o túnel está ativo no servidor da empresa |
| Porta 3000 não acessível | Verificar firewall da Lightsail                        |
| PM2 não inicia           | Verificar logs: `pm2 logs metas-gerentes`              |
