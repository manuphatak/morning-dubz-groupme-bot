import z from 'zod'
import { GroupMeSdk } from './api'
import { logger } from './logger'
import { MessageSchema } from './schema'
import { DurableObject } from 'cloudflare:workers'

const UNPIN_DELAY = 0

type AlarmEvent = {
	groupId: string
	eventId: string
	messageId: string
	runAt: number
}

/** A Durable Object's behavior is defined in an exported Javascript class */
export class UnpinManager extends DurableObject<Env> {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
	}

	public async schedule({
		groupId,
		eventId,
		messageId,
	}: {
		groupId: string
		eventId: string
		messageId: string
	}) {
		// Find event start time
		const eventStartTime = await GroupMeSdk.getEvent({
			groupId,
			eventId,
		}).then((event) => event.start_at)

		// Schedule an alarm 60 minutes after start time
		const alarmTime = eventStartTime
		alarmTime.setMinutes(alarmTime.getMinutes() + UNPIN_DELAY)

		await this.addAlarm(eventId, groupId, messageId, alarmTime.getTime())
		logger.info(
			{
				groupId,
				eventId,
				messageId,
				eventStartTime,
				alarmTime,
			},
			`Alarm scheduled: ${alarmTime}`
		)
	}

	public async cancel({ eventId }: { eventId: string }) {
		await this.ctx.storage.delete(`event:${eventId}`)
		logger.info({ eventId }, `Alarm cancelled: ${eventId}`)
	}

	async alarm() {
		logger.info(`Checking for alarms`)

		const now = Date.now()
		const events = await this.ctx.storage.list<AlarmEvent>({
			prefix: 'event:',
		})

		let nextAlarm = null
		for (const [key, event] of events) {
			if (event.runAt <= now) {
				await this.processAlarm(event)
				await this.ctx.storage.delete(key)
			}
			// Track the next event time
			if (event.runAt > now && (!nextAlarm || event.runAt < nextAlarm)) {
				nextAlarm = event.runAt
			}
		}

		if (nextAlarm) await this.ctx.storage.setAlarm(nextAlarm)
	}

	private async processAlarm({ groupId, eventId, messageId }: AlarmEvent) {
		logger.info({ groupId, eventId, messageId }, 'Processing alarm')
		await GroupMeSdk.unpinMessage({ groupId, eventId, messageId })
	}

	private async addAlarm(
		eventId: string,
		groupId: string,
		messageId: string,
		runAt: number
	) {
		const [, currentAlarm] = await Promise.all([
			this.ctx.storage.put<AlarmEvent>(`event:${eventId}`, {
				eventId,
				groupId,
				messageId,
				runAt,
			}),
			this.ctx.storage.getAlarm(),
		])

		if (!currentAlarm || runAt < currentAlarm) {
			await this.ctx.storage.setAlarm(runAt)
		}
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 })
		}
		await logRequest(request)

		const unpinManager = env.UNPIN_MANAGER.getByName(
			new URL(request.url).pathname
		)

		let body: MessageSchema
		try {
			const rawBody = await request.json()
			body = MessageSchema.parse(rawBody)
		} catch (err) {
			logger.error(err as Object, 'Invalid JSON')

			if (err instanceof z.ZodError) {
				return new Response(
					JSON.stringify({ error: err.message, issues: err.issues }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				)
			}
			return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		// event is created
		if (
			body.attachments.length === 1 &&
			body.attachments[0].type === 'event' &&
			body.text.includes('created event')
		) {
			logger.info({ body }, 'Message: Event was created')
			await Promise.all([
				GroupMeSdk.pinEvent({
					groupId: body.group_id,
					messageId: body.id,
				}),
				unpinManager.schedule({
					groupId: body.group_id,
					eventId: body.attachments[0].event_id,
					messageId: body.id,
				}),
			])
			return createSuccessResponse()
		}

		// event is cancelled
		if (
			body.attachments.length === 1 &&
			body.attachments[0].type === 'event' &&
			body.sender_id === 'system' &&
			body.system === true &&
			body.text.includes('canceled')
		) {
			logger.info({ body }, 'Message: Event was canceled')
			await Promise.all([
				GroupMeSdk.unpinEvent({
					groupId: body.group_id,
					eventId: body.attachments[0].event_id,
				}),
				unpinManager.cancel({
					eventId: body.attachments[0].event_id,
				}),
			])
			return createSuccessResponse()
		}

		logger.info({ body }, 'No action taken for this message')
		return createSuccessResponse()
	},
} satisfies ExportedHandler<Env>

function createSuccessResponse() {
	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	})
}

async function logRequest(
	request: Request<unknown, IncomingRequestCfProperties<unknown>>
) {
	const url = new URL(request.url)

	let body: { text: string } | null = null
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		try {
			body = await request.clone().json()
		} catch (e) {
			body = { text: '[Unable to parse body]' }
		}
	}

	logger.info(
		{
			request: {
				method: request.method,
				url: request.url,
				path: url.pathname,
				query: url.search,
				headers: Object.fromEntries(request.headers.entries()),
				body,
				cf: request.cf || null,
			},
		},
		`Message: ${body?.text ?? '[unknown]'}`
	)
}
