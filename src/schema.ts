import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

export const MessageSchema = z.compile(
	z.object({
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
)

export type MessageSchema = z.infer<typeof MessageSchema>

export const EventSchema = z.compile(
	z.object({
		// Base fields found across payloads
		name: z.string(),
		description: z.string().optional(),
		image_url: z.url().optional(),

		// Geolocation properties (optional based on second sample)
		location: z
			.object({
				lat: z.number(),
				lng: z.number(),
				name: z.string(),
				address: z.string(),
			})
			.optional(),

		// Date and Time tracking
		start_at: z.iso.datetime({ offset: true }).transform(toTemporalInstant),
		end_at: z.iso.datetime({ offset: true }).transform(toTemporalInstant),
		is_all_day: z.boolean(),
		timezone: z.string(),
		end_at_set: z.boolean().optional(),

		// Calling features
		scheduled_call: z.boolean().optional(),
		call_started: z.boolean().optional(),

		// Visual/Theming configuration
		aesthetics: z
			.object({
				font: z.string(),
				theme: z.string(),
				effect: z.string(),
			})
			.optional(),

		// Identifiers
		conversation_id: z.string(),
		event_id: z.string(),
		creator_id: z.string(),

		// Attendance metrics
		reminders: z.array(z.number()),
		going: z.array(z.string()),
		not_going: z.array(z.string()),
		maybe_going: z.array(z.string()).optional(),
		waitlisted: z.array(z.string()).optional(),
		going_count: z.number().optional(),

		// RSVP Timestamps mapping user ID keys to date strings
		rsvp_list: z
			.record(z.string(), z.iso.datetime().transform(toTemporalInstant))
			.optional(),
		rsvp_sources: z.record(z.string(), z.string()).optional(),

		// Deep linking and share metrics
		share_url: z.url().optional(),
		deep_link_ios: z.string().optional(), // Protocols can use custom schemes like 'groupme://'
		deep_link_android: z.string().optional(),
		share_qr_code: z.url().optional(),

		// Meta parameters
		is_top_level: z.boolean().optional(),
		created_at: z.iso.datetime().transform(toTemporalInstant),
		updated_at: z.iso.datetime().transform(toTemporalInstant),
	})
)
export type EventSchema = z.infer<typeof EventSchema>

function toTemporalInstant(text: string): Temporal.Instant {
	return Temporal.Instant.from(text)
}
