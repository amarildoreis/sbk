export interface WelcomeEmailInput {
  nome: string;
  email: string;
  senha: string;
  loginUrl: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderWelcomeEmail({
  nome,
  email,
  senha,
  loginUrl,
}: WelcomeEmailInput): string {
  const safeNome = escapeHtml(nome);
  const safeEmail = escapeHtml(email);
  const safeSenha = escapeHtml(senha);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bem-vindo(a) à SBK Capital</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F7F8FA; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FA; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background-color:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 8px 24px rgba(18,24,63,0.10);">

            <tr>
              <td style="background-color:#12183F; padding:36px 40px; text-align:center;">
                <div style="display:inline-block; padding:10px 20px; border:1px solid rgba(255,255,255,0.25); border-radius:12px;">
                  <span style="color:#FFFFFF; font-size:20px; font-weight:700; letter-spacing:0.5px;">SBK</span>
                  <span style="color:#C8CDD6; font-size:11px; font-weight:600; letter-spacing:2px; display:block; margin-top:2px;">CAPITAL</span>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:40px 40px 8px 40px;">
                <p style="margin:0; color:#2E3F7F; font-size:13px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
                  Acesso liberado
                </p>
                <h1 style="margin:10px 0 0 0; color:#1A2347; font-size:26px; line-height:1.3; font-weight:700;">
                  Bem-vindo(a) à plataforma de inteligência analítica da SBK, ${safeNome}.
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 40px 0 40px;">
                <p style="margin:0; color:#3A4468; font-size:15px; line-height:1.65;">
                  A partir de agora você tem acesso à plataforma da <strong>SBK Capital</strong> —
                  o ambiente de análise de carteira, comercial, comportamental e comissões que
                  reúne, em um só lugar, a inteligência de dados do seu dia a dia.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 40px 0 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FA; border:1px solid #E4E7EE; border-radius:14px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 4px 0; color:#8891AC; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
                        E-mail de acesso
                      </p>
                      <p style="margin:0 0 16px 0; color:#1A2347; font-size:15px; font-weight:600;">
                        ${safeEmail}
                      </p>
                      <p style="margin:0 0 4px 0; color:#8891AC; font-size:11px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">
                        Senha temporária
                      </p>
                      <p style="margin:0; color:#1A2347; font-size:18px; font-weight:700; font-family:'Courier New',monospace; letter-spacing:1px;">
                        ${safeSenha}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 40px 0 40px;">
                <p style="margin:0; color:#B3495A; font-size:13px; line-height:1.6; background-color:rgba(179,73,90,0.08); border-radius:10px; padding:12px 16px;">
                  Por segurança, você vai precisar trocar essa senha no primeiro acesso.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 40px 40px 40px; text-align:center;">
                <a href="${loginUrl}" style="display:inline-block; background-color:#1A2347; color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:600; padding:14px 32px; border-radius:12px;">
                  Acessar a plataforma
                </a>
                <p style="margin:16px 0 0 0; color:#8891AC; font-size:12px; word-break:break-all;">
                  ${loginUrl}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 40px; background-color:#F7F8FA; text-align:center; border-top:1px solid #E4E7EE;">
                <p style="margin:0; color:#8891AC; font-size:12px;">
                  Acesso exclusivo para clientes SBK Capital. Se você não esperava este e-mail, pode ignorá-lo.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
