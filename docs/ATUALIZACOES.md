# VTMaster — Atualizações Automáticas e Publicação de Releases

> Atualizado em 14/05/2026 — fluxo introduzido na v5.1.5 e validado com release de teste v5.1.6.

---

## 1. Como funciona

O VTMaster usa `electron-updater` com GitHub Releases como servidor de atualização.

- Repositório de releases: `RobsonDV/VTMaster`
- Provider configurado: `github`
- Instalador suportado para auto-update: `Setup.exe` / NSIS
- Arquivo de metadata público: `latest.yml`
- Arquivo interno no app empacotado: `resources/app-update.yml`

O app instalado verifica atualização:

- automaticamente alguns segundos após abrir;
- novamente a cada 6 horas;
- manualmente em **Configurações → Atualizações → Verificar atualização**.

Quando a atualização termina de baixar, o app pergunta se o operador quer reiniciar agora ou depois.

---

## 2. Limites importantes

- O auto-update só funciona no app instalado pelo `Setup.exe`.
- O `Portable.exe` é distribuído, mas não deve ser usado como base para atualização automática.
- Versões anteriores à v5.1.5 não têm updater embutido. Usuários dessas versões precisam instalar manualmente a primeira versão com updater.
- Releases marcadas como `draft` ou `pre-release` não devem ser usadas para update estável.
- O versionamento precisa subir sempre em SemVer: `5.1.6`, `5.1.7`, `5.2.0` etc.

---

## 3. Arquivos obrigatórios na GitHub Release

Para o Windows/NSIS, anexe sempre:

```text
VTMaster-x.y.z-Setup.exe
VTMaster-x.y.z-Setup.exe.blockmap
latest.yml
```

Também é recomendado anexar:

```text
VTMaster-x.y.z-Portable.exe
```

O updater usa principalmente `latest.yml`, o `Setup.exe` e o `.blockmap`.

---

## 4. Checklist para publicar uma nova atualização

1. Confirme que a árvore está limpa:

```bash
git status --short
```

2. Atualize a versão em `package.json`.

Exemplo:

```json
"version": "5.1.7"
```

3. Sincronize o lockfile:

```bash
npm.cmd install --package-lock-only
```

4. Atualize os documentos:

- `docs/INDEX.md`
- `docs/ESTADO_ATUAL.md`
- `docs/DEVELOPMENT.md`
- este arquivo, se o processo de atualização mudar

5. Rode validações:

```bash
npm.cmd run lint
npm.cmd run build
```

6. Gere instalador, portable e metadata:

```bash
npm.cmd run build:dist
```

7. Confira os arquivos gerados:

```powershell
Get-ChildItem release -Filter "VTMaster-x.y.z*"
Get-Content release\latest.yml
Get-Content release\win-unpacked\resources\app-update.yml
```

O `latest.yml` deve apontar para a versão nova. O `app-update.yml` deve conter:

```yaml
owner: RobsonDV
repo: VTMaster
provider: github
releaseType: release
```

8. Faça commit e push:

```bash
git add -A
git commit -m "Release vx.y.z"
git push origin main
```

9. Crie a GitHub Release.

Opção manual:

- Vá em GitHub → Releases → Draft a new release.
- Tag: `vx.y.z`, por exemplo `v5.1.7`.
- Target: `main`.
- Marque como release normal, não draft e não pre-release.
- Anexe `Setup.exe`, `.blockmap`, `latest.yml` e opcionalmente `Portable.exe`.

Opção via GitHub CLI:

```bash
gh release create vx.y.z ^
  release\VTMaster-x.y.z-Setup.exe ^
  release\VTMaster-x.y.z-Setup.exe.blockmap ^
  release\latest.yml ^
  release\VTMaster-x.y.z-Portable.exe ^
  --title "VTMaster x.y.z" ^
  --notes "Notas da versão."
```

10. Confira a release:

```bash
gh release view vx.y.z --json tagName,isDraft,isPrerelease,assets,url
```

---

## 5. Como testar uma atualização real

Para testar corretamente, é preciso ter duas versões publicadas:

- versão instalada: por exemplo `5.1.5`;
- versão mais nova publicada: por exemplo `5.1.6`.

Passos:

1. Instale a versão antiga usando `VTMaster-5.1.5-Setup.exe`.
2. Abra o VTMaster instalado.
3. Vá em **Configurações → Atualizações**.
4. Clique em **Verificar atualização**.
5. Confirme se o app detecta a versão nova.
6. Aguarde o download.
7. Clique em **Reiniciar e instalar** ou aceite o diálogo de reinício.
8. Depois de abrir novamente, confira a versão no rodapé das Configurações.

Resultado esperado:

- a versão exibida muda para a nova versão;
- os dados locais continuam preservados em `%APPDATA%/vtmaster/SpotMaster` ou no caminho legado equivalente;
- o app não pede reinstalação manual nas próximas releases.

---

## 6. Publicação automatizada

Existe o script:

```bash
npm.cmd run release:github
```

Ele executa:

```bash
npm run build && electron-builder --publish always
```

Use esse caminho apenas quando:

- o `GH_TOKEN` estiver configurado no ambiente;
- a versão já estiver correta em `package.json`;
- `npm.cmd run lint` e `npm.cmd run build` já tiverem passado;
- você quiser deixar o `electron-builder` publicar os assets diretamente.

Para controle fino e teste manual, o caminho mais transparente é `npm.cmd run build:dist` seguido de `gh release create`.

---

## 7. Troubleshooting

### O app diz que já está atualizado

Verifique:

- se a nova release está publicada e não é draft/pre-release;
- se o `latest.yml` está anexado na release mais nova;
- se o `latest.yml` contém a versão correta;
- se a versão instalada é menor que a versão publicada;
- se o app instalado veio do `Setup.exe`, não do `Portable.exe`.

### O app não baixa

Verifique:

- se `VTMaster-x.y.z-Setup.exe` está anexado;
- se `VTMaster-x.y.z-Setup.exe.blockmap` está anexado;
- se os nomes no `latest.yml` batem exatamente com os assets da release;
- se a máquina tem acesso ao GitHub.

### O update não instala no Portable

Comportamento esperado. Auto-update é suportado no app instalado via NSIS/Setup.

### sha512 checksum mismatch — erro ao instalar a atualização

**Causa:** o `Setup.exe` no GitHub e o `latest.yml` foram gerados em **builds separados**. Cada build gera um binário ligeiramente diferente (timestamp, hash de recursos), então os hashes SHA512 nunca vão coincidir entre dois builds.

Isso acontece quando:
1. `npm run release:github` é executado mas o upload automático falha (sem `GH_TOKEN`);
2. Os arquivos são enviados ao GitHub via `gh release create` — esse é o **Build 1**;
3. `npm run build:dist` é executado novamente para gerar um `latest.yml` novo — esse é o **Build 2**;
4. O `latest.yml` do Build 2 é enviado ao GitHub;
5. Resultado: `Setup.exe` (Build 1) ≠ hash no `latest.yml` (Build 2).

**Regra de ouro: todos os arquivos de um release devem vir de um único `build:dist`.**

**Como corrigir depois que aconteceu:**

```bash
# Identificar qual build gerou o latest.yml atual (pelo size no latest.yml)
cat release\latest.yml   # anote o size

# Verificar se o Setup.exe local bate com esse size
ls -l release\VTMaster-x.y.z-Setup.exe

# Se bater: o latest.yml está correto, precisa substituir só os assets do GitHub
gh release delete-asset vx.y.z "VTMaster-x.y.z-Setup.exe" --yes
gh release delete-asset vx.y.z "VTMaster-x.y.z-Setup.exe.blockmap" --yes
gh release upload vx.y.z release\VTMaster-x.y.z-Setup.exe release\VTMaster-x.y.z-Setup.exe.blockmap

# Se não bater: fazer build limpo e substituir tudo
npm run build:dist
gh release delete-asset vx.y.z "VTMaster-x.y.z-Setup.exe" --yes
gh release delete-asset vx.y.z "VTMaster-x.y.z-Setup.exe.blockmap" --yes
gh release delete-asset vx.y.z latest.yml --yes
gh release upload vx.y.z release\VTMaster-x.y.z-Setup.exe release\VTMaster-x.y.z-Setup.exe.blockmap release\latest.yml
```

**Como prevenir:**

Seguir sempre o fluxo do item 3 deste documento:
1. `npm run build:dist` → gera todos os artefatos em um único build
2. `gh release create` → envia **todos** os arquivos desse mesmo build de uma vez
3. **Nunca** rodar um segundo build para o mesmo release

Se o `npm run release:github` for usado (com `GH_TOKEN` configurado), ele faz tudo em um único build automaticamente e não tem esse problema.

### Quero testar sem esperar a checagem automática

Use **Configurações → Atualizações → Verificar atualização**.
