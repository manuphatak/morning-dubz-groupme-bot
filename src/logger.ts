import { env } from 'cloudflare:workers'
import { Logger } from 'tslog'

export const logger = new Logger({ type: env.LOGGER_TYPE })
