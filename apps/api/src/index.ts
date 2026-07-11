import Fastify from 'fastify'

import { registerAdminVergleich } from './admin-vergleich.js'
import { registerAffiliateRoutes } from './affiliate.js'
import { registerEvaluationRoutes } from './evaluations.js'
import { registerMethodikPublic } from './methodik-public.js'
import { registerNewsletterRoutes } from './newsletter.js'
import { registerPraxenRoutes } from './praxen.js'
import { registerTransparenzPublic } from './transparenz-public.js'
import { registerVergleichPublic } from './vergleich-public.js'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok' }))

registerNewsletterRoutes(app)
registerEvaluationRoutes(app)
registerAdminVergleich(app)
registerVergleichPublic(app)
registerAffiliateRoutes(app)
registerMethodikPublic(app)
registerTransparenzPublic(app)
registerPraxenRoutes(app)

const port = Number(process.env.PORT ?? 3001)

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
