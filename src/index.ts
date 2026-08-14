import { env } from 'cloudflare:workers'
import { Logger } from 'tslog'
import { z } from 'zod'

const logger = new Logger({
	type: env.ENVIRONMENT === 'production' ? 'json' : 'pretty',
})

const GROUPME_ACCESS_TOKEN = env.GROUPME_ACCESS_TOKEN
const MessageSchema = z.object({
	attachments: z.array(
		z.discriminatedUnion('type', [
			z.object({
				type: z.literal('image'),
				url: z.httpUrl(),
			}),
			z.object({
				type: z.literal('video'),
				url: z.httpUrl(),
				preview_url: z.httpUrl(),
			}),
			z.object({
				type: z.literal('file'),
				file_id: z.string(),
			}),
			z.object({
				type: z.literal('location'),
				name: z.string(),
				lat: z.string().regex(/^-?\d+(\.\d+)?$/),
				lng: z.string().regex(/^-?\d+(\.\d+)?$/),
			}),
			z.object({
				type: z.literal('emoji'),
				placeholder: z.string(),
				charmap: z.array(z.tuple([z.number(), z.number()])),
			}),

			z.object({
				type: z.literal('reply'),
				reply_id: z.string(),
				base_reply_id: z.string(),
			}),

			z.object({
				type: z.literal('mentions'),
				user_ids: z.array(z.string()),
				loci: z.array(z.tuple([z.number(), z.number()])),
			}),
			z.object({
				type: z.literal('poll'),
				poll_id: z.string(),
			}),
			z.object({
				type: z.literal('event'),
				event_id: z.string(),
				view: z.enum(['brief', 'full']),
			}),
			z.object({
				type: z.literal('copilot'),
				message_id: z.string(),
				part_id: z.string(),
				prompt_sender: z.string(),
			}),
			z.object({
				type: z.literal('partial_image'),
				id: z.string(),
				content: z.string(),
			}),
		])
	),
	group_id: z.string(),
	id: z.string(),
	sender_id: z.string().max(100),
	sender_type: z.enum(['user', 'service', 'system']),
	source_guid: z.string(),
	system: z.boolean(),
	text: z.string(),
})

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 })
		}
		logger.info(
			{ request: await serializeRequest(request) },
			'Incoming request'
		)

		let body: z.infer<typeof MessageSchema>

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
			logger.info({ body }, 'Event is starting')
			await groupMeApi.unpinEvent({
				groupId: body.group_id,
				eventId: body.attachments[0].event_id,
				logger,
			})

			return createSuccessResponse()
		}
		// event is created
		if (
			body.attachments.length === 1 &&
			body.attachments[0].type === 'event' &&
			body.text.includes('created event')
		) {
			logger.info({ body }, 'Event is created')
			await groupMeApi.pinEvent({
				groupId: body.group_id,
				messageId: body.id,
				logger,
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
			logger.info({ body }, 'Event is canceled')
			await groupMeApi.unpinEvent({
				groupId: body.group_id,
				eventId: body.attachments[0].event_id,
				logger,
			})
			return createSuccessResponse()
		}

		return createSuccessResponse()
	},
} satisfies ExportedHandler<Env>

function createSuccessResponse() {
	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	})
}

const groupMeApi = {
	pinEvent: async ({
		groupId,
		messageId,
		logger,
	}: {
		groupId: string
		messageId: string
		logger: Logger<unknown>
	}) => {
		await fetch(
			`https://api.groupme.com/v3/conversations/${groupId}/messages/${messageId}/pin`,
			{
				method: 'POST',
				headers: { 'X-Access-Token': GROUPME_ACCESS_TOKEN },
			}
		)

		logger.info({ groupId, messageId }, 'Event was pinned')
	},

	unpinEvent: async ({
		groupId,
		eventId,
		logger,
	}: {
		groupId: string
		eventId: string
		logger: Logger<unknown>
	}) => {
		const pinnedMessages = await fetch(
			`https://api.groupme.com/v3/pinned/groups/${groupId}/messages`,
			{ headers: { 'X-Access-Token': GROUPME_ACCESS_TOKEN } }
		)
			.then((res) => res.json())
			.then((data) =>
				z
					.object({
						response: z.object({
							messages: z.array(MessageSchema),
						}),
					})
					.parseAsync(data)
			)
			.then((data) => data.response.messages)

		const matchedMessage = pinnedMessages.find((message) =>
			message.attachments.some(
				(attachment) =>
					attachment.type === 'event' &&
					attachment.event_id === eventId
			)
		)
		if (matchedMessage === undefined) {
			logger.debug(
				{ pinnedMessages, groupId, eventId },
				'No pinned message found for event'
			)

			return
		}

		await fetch(
			`https://api.groupme.com/v3/conversations/${groupId}/messages/${matchedMessage.id}/unpin`,
			{
				method: 'POST',
				headers: { 'X-Access-Token': GROUPME_ACCESS_TOKEN },
			}
		)

		logger.info(
			{ groupId, messageId: matchedMessage.id, eventId },
			'Event was unpinned'
		)
	},
}

async function serializeRequest(
	request: Request<unknown, IncomingRequestCfProperties<unknown>>
) {
	const url = new URL(request.url)

	let body = null
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		try {
			body = await request.clone().json()
		} catch (e) {
			body = '[Unable to parse body]'
		}
	}

	return {
		method: request.method,
		url: request.url,
		path: url.pathname,
		query: url.search,
		headers: Object.fromEntries(request.headers.entries()),
		body,
		cf: request.cf || null,
	}
}
