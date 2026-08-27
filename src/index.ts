import z from 'zod'
import { GroupMeApi } from './api'
import { logger } from './logger'
import { MessageSchema } from './schema'

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 })
		}
		await logRequest(request)

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

		// event is starting
		if (
			body.sender_type === 'service' &&
			body.sender_id === 'calendar' &&
			body.attachments[0]?.type === 'event' &&
			body.text.endsWith('is starting now')
		) {
			logger.info({ body }, 'Message: Event is starting')
			await GroupMeApi.unpinEvent({
				groupId: body.group_id,
				eventId: body.attachments[0].event_id,
			})

			return createSuccessResponse()
		}
		// event is created
		if (
			body.attachments.length === 1 &&
			body.attachments[0].type === 'event' &&
			body.text.includes('created event')
		) {
			logger.info({ body }, 'Message: Event was created')
			await GroupMeApi.pinEvent({
				groupId: body.group_id,
				messageId: body.id,
			})
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
			await GroupMeApi.unpinEvent({
				groupId: body.group_id,
				eventId: body.attachments[0].event_id,
			})
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
