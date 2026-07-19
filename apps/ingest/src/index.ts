import Fastify from 'fastify'

import { registerAdmin } from './admin.js'
import { registerAdminAttributes } from './admin-attributes.js'
import { registerAdminExtractions } from './admin-extractions.js'
import { registerAdminAuth } from './auth.js'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok' }))

registerAdminAuth(app)
registerAdmin(app)
registerAdminAttributes(app)
registerAdminExtractions(app)

const port = Number(process.env.PORT ?? 3002)

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
