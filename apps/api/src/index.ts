import Fastify from 'fastify'

import { registerAdminVergleich } from './admin-vergleich.js'
import { registerEvaluationRoutes } from './evaluations.js'
import { registerNewsletterRoutes } from './newsletter.js'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok' }))

registerNewsletterRoutes(app)
registerEvaluationRoutes(app)
registerAdminVergleich(app)

const port = Number(process.env.PORT ?? 3001)

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
