import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de serviço',
  description: 'Termos de serviço do Pascal Editor e da plataforma Pascal.',
}

export default function TermsPage() {
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
            <span className="font-medium text-foreground">Termos de serviço</span>
            <span className="text-muted-foreground">|</span>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/privacy"
            >
              Política de privacidade
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-6 py-12">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="mb-2 font-bold text-3xl">Termos de serviço</h1>
          <p className="mb-8 text-muted-foreground text-sm">Vigência: 20 de fevereiro de 2026</p>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">1. Introdução</h2>
            <p className="text-foreground/90 leading-relaxed">
              Boas-vindas ao Pascal Editor (“Editor”) e à plataforma Pascal em pascal.app
              (“Plataforma”), operados pela Pascal Group Inc. (“nós” ou “nosso”). Ao acessar ou usar
              nossos serviços, você concorda com estes Termos de Serviço.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">2. O editor e a plataforma</h2>
            <p className="text-foreground/90 leading-relaxed">
              O Pascal Editor é um software de código aberto disponibilizado sob a licença MIT. Você
              pode usar, copiar, modificar, mesclar, publicar, distribuir, sublicenciar e/ou vender
              cópias do software Editor de acordo com os termos da licença MIT.
            </p>
            <p className="text-foreground/90 leading-relaxed">
              A plataforma Pascal (pascal.app) e seus serviços associados, incluindo contas de
              usuário, armazenamento em nuvem e hospedagem de projetos, são serviços proprietários
              pertencentes à Pascal Group Inc. e operados por ela. Estes Termos regem seu uso da
              Plataforma.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">3. Contas e autenticação</h2>
            <p className="text-foreground/90 leading-relaxed">
              Para usar determinados recursos da Plataforma, você deve criar uma conta. Usamos
              Google OAuth e autenticação por link de acesso enviado por e-mail, via Supabase. Você
              é responsável por manter a segurança das credenciais da sua conta e por todas as
              atividades realizadas nela.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">4. Uso aceitável</h2>
            <p className="text-foreground/90 leading-relaxed">Você concorda em não:</p>
            <ul className="list-disc space-y-2 pl-6 text-foreground/90">
              <li>Usar a Plataforma para fins ilegais ou em violação de qualquer lei aplicável</li>
              <li>
                Enviar, compartilhar ou distribuir conteúdo que viole direitos de propriedade
                intelectual
              </li>
              <li>Tentar obter acesso não autorizado à Plataforma ou aos seus sistemas</li>
              <li>Interferir na infraestrutura da Plataforma ou interromper seu funcionamento</li>
              <li>Enviar código malicioso, vírus ou conteúdo prejudicial</li>
              <li>Assediar, abusar ou causar danos a outros usuários</li>
              <li>Usar a Plataforma para enviar spam ou comunicações não solicitadas</li>
            </ul>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">5. Seu conteúdo e propriedade intelectual</h2>
            <p className="text-foreground/90 leading-relaxed">
              Você mantém a titularidade integral de todo conteúdo, projeto e dado que criar ou
              enviar à Plataforma (“Seu Conteúdo”). Ao usar a Plataforma, você nos concede uma
              licença limitada para armazenar, exibir e transmitir Seu Conteúdo exclusivamente para
              prestar nossos serviços a você.
            </p>
            <p className="text-foreground/90 leading-relaxed">
              Não reivindicamos quaisquer direitos de propriedade sobre Seu Conteúdo. Você pode
              exportar ou excluir Seu Conteúdo a qualquer momento.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">6. Propriedade da plataforma</h2>
            <p className="text-foreground/90 leading-relaxed">
              A Plataforma, incluindo seu design, recursos e código proprietário, pertence à Pascal
              Group Inc. e é protegida pelas leis de propriedade intelectual. Embora o código-fonte
              do Editor seja aberto sob a licença MIT, os serviços, a marca e a infraestrutura da
              Plataforma continuam sendo de nossa propriedade exclusiva.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">7. Encerramento da conta</h2>
            <p className="text-foreground/90 leading-relaxed">
              Reservamo-nos o direito de suspender ou encerrar sua conta se você violar estes Termos
              ou adotar condutas que consideremos prejudiciais à Plataforma ou a outros usuários.
              Você também pode excluir sua conta a qualquer momento entrando em contato conosco em{' '}
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
            <h2 className="font-semibold text-xl">8. Isenção de garantias</h2>
            <p className="text-foreground/90 leading-relaxed">
              A PLATAFORMA É FORNECIDA “NO ESTADO EM QUE SE ENCONTRA” E “CONFORME DISPONÍVEL”, SEM
              GARANTIAS DE QUALQUER TIPO, EXPRESSAS OU IMPLÍCITAS, INCLUINDO, SEM LIMITAÇÃO,
              GARANTIAS IMPLÍCITAS DE COMERCIABILIDADE, ADEQUAÇÃO A UMA FINALIDADE ESPECÍFICA E NÃO
              VIOLAÇÃO DE DIREITOS.
            </p>
            <p className="text-foreground/90 leading-relaxed">
              Não garantimos que a Plataforma funcionará sem interrupções, estará livre de erros ou
              de componentes prejudiciais.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">9. Limitação de responsabilidade</h2>
            <p className="text-foreground/90 leading-relaxed">
              NA MÁXIMA EXTENSÃO PERMITIDA POR LEI, A PASCAL GROUP INC. NÃO SERÁ RESPONSÁVEL POR
              QUAISQUER DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS OU PUNITIVOS,
              INCLUINDO PERDA DE DADOS, LUCROS OU FUNDO DE COMÉRCIO, DECORRENTES DO SEU USO DA
              PLATAFORMA.
            </p>
          </section>

          <section className="mb-8 space-y-4">
            <h2 className="font-semibold text-xl">10. Alterações nos termos</h2>
            <p className="text-foreground/90 leading-relaxed">
              Podemos atualizar estes Termos periodicamente. Informaremos sobre alterações
              relevantes publicando os Termos atualizados na Plataforma. A continuidade do uso da
              Plataforma após a publicação das alterações constitui sua aceitação dos Termos
              revisados.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold text-xl">11. Fale conosco</h2>
            <p className="text-foreground/90 leading-relaxed">
              Se você tiver dúvidas sobre estes Termos, entre em contato conosco em{' '}
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
