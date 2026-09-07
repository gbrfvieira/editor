import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: 'Política de privacidade do Pascal Editor e da plataforma Pascal.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/"
            >
              Início
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/terms"
            >
              Termos de serviço
            </Link>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium text-foreground">Política de privacidade</span>
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-6 py-12">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="mb-2 font-bold text-3xl">Política de privacidade</h1>
          <p className="mb-8 text-muted-foreground text-sm">Vigência: 20 de fevereiro de 2026</p>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">1. Introdução</h2>
            <p className="text-foreground/90 leading-relaxed">
              A Pascal Group Inc. (“nós” ou “nosso”) opera o Pascal Editor e a plataforma em
              pascal.app. Esta Política de Privacidade explica como coletamos, usamos e protegemos
              suas informações quando você utiliza nossos serviços.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">2. Informações que coletamos</h2>

            <h3 className="mt-4 font-medium text-lg">Informações da conta</h3>
            <p className="text-foreground/90 leading-relaxed">
              Quando você cria uma conta, coletamos:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-foreground/90">
              <li>Endereço de e-mail</li>
              <li>Nome</li>
              <li>Foto de perfil/avatar</li>
              <li>Dados do provedor OAuth (do Google quando você entra com sua conta Google)</li>
            </ul>

            <h3 className="mt-4 font-medium text-lg">Dados do projeto</h3>
            <p className="text-foreground/90 leading-relaxed">
              Quando você utiliza a Plataforma, armazenamos seus projetos, incluindo modelos 3D de
              edificações, plantas baixas e metadados associados.
            </p>

            <h3 className="mt-4 font-medium text-lg">Análises de uso</h3>
            <p className="text-foreground/90 leading-relaxed">
              Usamos Vercel Analytics e Speed Insights para coletar dados de uso anonimizados,
              incluindo visualizações de páginas, métricas de desempenho e padrões gerais de uso.
              Isso nos ajuda a melhorar a Plataforma.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">3. Como usamos suas informações</h2>
            <p className="text-foreground/90 leading-relaxed">Usamos suas informações para:</p>
            <ul className="list-disc space-y-2 pl-6 text-foreground/90">
              <li>Disponibilizar e manter sua conta</li>
              <li>Armazenar e sincronizar seus projetos entre dispositivos</li>
              <li>Melhorar nossos serviços com base nos padrões de uso</li>
              <li>
                Enviar notificações opcionais por e-mail sobre novos recursos e atualizações (você
                pode desativá-las nas configurações)
              </li>
              <li>Responder a solicitações de suporte</li>
              <li>Garantir a segurança da plataforma e prevenir abusos</li>
            </ul>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">4. Armazenamento de dados</h2>
            <p className="text-foreground/90 leading-relaxed">
              Seus dados são armazenados no Supabase (banco de dados PostgreSQL), em infraestrutura
              de nuvem segura. Implementamos medidas técnicas e organizacionais adequadas para
              proteger seus dados.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">5. Serviços de terceiros</h2>
            <p className="text-foreground/90 leading-relaxed">
              Usamos os seguintes serviços de terceiros para operar a Plataforma:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-foreground/90">
              <li>
                <strong>Google</strong> - Autenticação OAuth para acesso
              </li>
              <li>
                <strong>Vercel</strong> - Hospedagem do aplicativo, análises e monitoramento de
                desempenho
              </li>
              <li>
                <strong>Supabase</strong> - Hospedagem de banco de dados e infraestrutura de
                autenticação
              </li>
            </ul>
            <p className="mt-4 text-foreground/90 leading-relaxed">
              Cada um desses serviços possui suas próprias políticas de privacidade, que regem o
              tratamento dos seus dados.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">6. Cookies</h2>
            <p className="text-foreground/90 leading-relaxed">
              Usamos o mínimo de cookies necessário para o funcionamento da Plataforma:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-foreground/90">
              <li>
                <strong>Cookies de sessão</strong> - Essenciais para autenticação e para manter sua
                sessão ativa
              </li>
              <li>
                <strong>Cookies de análise</strong> - Usados pelo Vercel Analytics para coletar
                dados de uso anonimizados
              </li>
            </ul>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">7. Seus direitos</h2>
            <p className="text-foreground/90 leading-relaxed">Você tem o direito de:</p>
            <ul className="list-disc space-y-2 pl-6 text-foreground/90">
              <li>Acessar os dados pessoais que mantemos sobre você</li>
              <li>Solicitar a correção de dados incorretos</li>
              <li>Solicitar a exclusão dos seus dados</li>
              <li>Exportar os dados dos seus projetos</li>
              <li>Recusar comunicações de marketing</li>
            </ul>
            <p className="mt-4 text-foreground/90 leading-relaxed">
              Para exercer qualquer um desses direitos, entre em contato conosco em{' '}
              <a
                className="text-foreground underline hover:text-foreground/80"
                href="mailto:support@pascal.app"
              >
                support@pascal.app
              </a>
              .
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">8. Retenção de dados</h2>
            <p className="text-foreground/90 leading-relaxed">
              Mantemos seus dados enquanto sua conta estiver ativa. Se você excluir sua conta,
              excluiremos seus dados pessoais e de projetos em até 30 dias, exceto quando a lei
              exigir a retenção de determinadas informações.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">9. Privacidade infantil</h2>
            <p className="text-foreground/90 leading-relaxed">
              A Plataforma não se destina a crianças menores de 13 anos. Não coletamos
              intencionalmente informações pessoais de crianças menores de 13 anos. Se você
              acreditar que coletamos essas informações, entre em contato conosco imediatamente.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">10. Alterações nesta política</h2>
            <p className="text-foreground/90 leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Informaremos sobre
              alterações relevantes publicando a política atualizada na Plataforma. A continuidade
              do uso da Plataforma após a publicação das alterações constitui sua aceitação da
              política revisada.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold text-xl">11. Fale conosco</h2>
            <p className="text-foreground/90 leading-relaxed">
              Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos seus
              dados, entre em contato conosco em{' '}
              <a
                className="text-foreground underline hover:text-foreground/80"
                href="mailto:support@pascal.app"
              >
                support@pascal.app
              </a>
              .
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
