# Entrega e publicação do RePlay

- O site público é `https://angeline1986.github.io/replay/`. O GitHub Pages publica o código da branch `main` após o CI passar; confira `.github/workflows/ci.yml` e `.github/workflows/deploy-pages.yml` se o fluxo mudar.
- Antes de concluir uma alteração de interface, verifique qual entrega a pessoa espera: código local, commit em uma branch ou mudança visível no site. Um build local ou push para outra branch não publica o site.
- Quando a publicação estiver autorizada, execute `npm run check`, envie o commit à `main` pelo fluxo adequado e confirme que CI e Pages terminaram com sucesso para o mesmo SHA. Confira também se o site serve o novo arquivo de interface.
- Se o trabalho ficar apenas em uma branch, diga explicitamente que a versão publicada ainda não foi alterada. Nunca chame a mudança de “publicada” antes das verificações acima.
- Não crie um PR como etapa obrigatória quando o envio direto à `main` já estiver autorizado e for apropriado. No resumo final, informe separadamente o estado do código, do remoto e da publicação.
