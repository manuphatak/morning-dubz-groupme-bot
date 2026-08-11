/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { z } from 'zod'

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

const createSuccessResponse = () =>
	new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	})

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const groupMeAccessToken = '<ACCESS_TOKEN>'
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 })
		}

		let body: z.infer<typeof MessageSchema>

		try {
			const rawBody = await request.json()
			body = MessageSchema.parse(rawBody)
		} catch (err) {
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
			await groupMeApi.unpinEvent({
				groupMeAccessToken,
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
			await groupMeApi.pinEvent({
				groupId: body.group_id,
				messageId: body.id,
				groupMeAccessToken,
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
			await groupMeApi.unpinEvent({
				groupMeAccessToken,
				groupId: body.group_id,
				eventId: body.attachments[0].event_id,
			})
			return createSuccessResponse()
		}

		return createSuccessResponse()
	},
} satisfies ExportedHandler<Env>

const groupMeApi = {
	pinEvent: async ({
		groupId,
		messageId,
		groupMeAccessToken,
	}: {
		groupId: string
		messageId: string
		groupMeAccessToken: string
	}) =>
		await fetch(
			`https://api.groupme.com/v3/conversations/${groupId}/messages/${messageId}/pin`,
			{
				method: 'POST',
				headers: { 'X-Access-Token': groupMeAccessToken },
			}
		),

	unpinEvent: async ({
		groupMeAccessToken,
		groupId,
		eventId,
	}: {
		groupMeAccessToken: string
		groupId: string
		eventId: string
	}) => {
		const pinnedMessages = await fetch(
			`https://api.groupme.com/v3/pinned/groups/${groupId}/messages`,
			{ headers: { 'X-Access-Token': groupMeAccessToken } }
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
		if (matchedMessage === undefined) return

		await fetch(
			`https://api.groupme.com/v3/conversations/${groupId}/messages/${matchedMessage.id}/unpin`,
			{
				method: 'POST',
				headers: { 'X-Access-Token': groupMeAccessToken },
			}
		)
	},
}
