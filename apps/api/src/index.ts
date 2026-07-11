import Fastify from 'fastify'

import { registerNewsletterRoutes } from './newsletter.js'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok' }))

registerNewsletterRoutes(app)

const port = Number(process.env.PORT ?? 3001)

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
