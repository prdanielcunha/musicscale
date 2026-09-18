# MusicScale Live Node — instalação alpha

Este pacote contém o **MusicScale Live Node** e a interface web local necessária para operar o MusicScale Live na LAN.

## Windows

1. Extraia o ZIP completo.
2. Clique com o botão direito em `install.ps1` e execute com PowerShell.
3. O Windows poderá pedir elevação apenas para liberar a porta TCP 4317 no perfil de rede **Privada**.
4. O instalador copia o Node para o perfil do usuário, registra inicialização automática e abre:
   `http://127.0.0.1:4317/node`.

Se a política do Windows impedir scripts PowerShell, abra um PowerShell no diretório extraído e execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

## macOS

1. Extraia o arquivo `.tar.gz`.
2. Abra o Terminal no diretório extraído.
3. Execute:

```bash
chmod +x install.command
./install.command
```

O Node é instalado no perfil do usuário e registrado como LaunchAgent. O painel local é aberto automaticamente.

## Primeiro uso

No computador de produção:

1. Abra o painel local.
2. Configure o Holyrics usando a URL da API local e o token gerado no Holyrics.
3. Confirme que o provider aparece como conectado.
4. Escaneie o QR para abrir o MusicScale Live no tablet/celular da mesma rede.
5. Faça o pareamento com o PIN exibido somente no computador de produção.

## Segurança

- O token do Holyrics não é enviado para Firebase, browser remoto ou MillionsNest.
- O endpoint de configuração do provider responde apenas no loopback do computador do Node.
- O pareamento de operadores usa PIN temporário e token persistido como hash no Node.
- O modo remoto/cloud-relay permanece desabilitado.

## Estado desta distribuição

Esta é uma distribuição **alpha para testes controlados**. O binário macOS ainda não possui assinatura Developer ID/notarização e o Windows ainda não possui assinatura Authenticode. Esses itens são obrigatórios antes da distribuição pública.
