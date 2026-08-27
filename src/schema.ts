import { z } from 'zod'

export const MessageSchema = z.object({
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

export type MessageSchema = z.infer<typeof MessageSchema>
