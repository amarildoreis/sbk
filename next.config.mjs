/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit lê arquivos .afm (fontes padrão) do disco via
  // fs.readFileSync(__dirname + ...) dentro do próprio pacote — se o Next
  // tentar processar/bundlar esse código (webpack), __dirname deixa de
  // apontar pra pasta real do pacote em node_modules e a leitura falha em
  // runtime (erro genérico "Não foi possível exportar agora" no Comportamental,
  // 2026-07-15). Marcando como pacote externo, o Next faz um require()
  // normal em vez de tentar processar o pacote, preservando o __dirname real.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

export default nextConfig;
