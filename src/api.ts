import { env } from 'cloudflare:workers'

import z from 'zod'
import { logger } from './logger'
import { EventSchema, MessageSchema } from './schema'

export class GroupMeSdk {
	static async getEvent({
		groupId,
		eventId,
	}: {
		groupId: string
		eventId: string
	}) {
		return await GroupMeApi.events.show({ groupId, eventId })
	}

	static async pinEvent({
		groupId,
		messageId,
	}: {
		groupId: string
		messageId: string
	}) {
		await GroupMeApi.messages.pin({ groupId, messageId })

		logger.info({ groupId, messageId }, 'Action: Event was pinned')
	}

	static async unpinEvent({
		groupId,
		eventId,
	}: {
		groupId: string
		eventId: string
	}) {
		// Get pinned messages
		const pinnedMessages = await GroupMeApi.messages.getAllPinned(groupId)
		logger.debug(
			{ pinnedMessages, groupId, eventId },
			`${pinnedMessages.length} pinned message${pinnedMessages.length === 1 ? '' : 's'} retrieved`
		)

		// Find pinned message for event
		const matchedMessage = pinnedMessages.find((message) =>
			message.attachments.some(
				(attachment) =>
					attachment.type === 'event' &&
					attachment.event_id === eventId
			)
		)
		logger.debug(
			{ matchedMessage, groupId, eventId },
			`${matchedMessage === undefined ? 'No pinned' : 'Pinned'} message found for event`
		)
		if (matchedMessage === undefined) return

		// Unpin matched message
		await GroupMeApi.messages.unpin({
			groupId,
			messageId: matchedMessage.id,
		})
		logger.info(
			{ groupId, messageId: matchedMessage.id, eventId },
			'Action: Event was unpinned'
		)
	}
	static async unpinMessage({
		groupId,
		messageId,
		eventId,
	}: {
		groupId: string
		eventId: string
		messageId: string
	}) {
		// Unpin matched message
		await GroupMeApi.messages.unpin({
			groupId,
			messageId,
		})
		logger.info(
			{ groupId, messageId, eventId },
			'Action: Event was unpinned'
		)
	}
}

const MessagesResponseSchema = z.object({
	response: z.object({
		messages: z.array(MessageSchema),
	}),
})

const EventResponseSchema = z.object({
	response: z.object({
		event: EventSchema,
	}),
})

class GroupMeApi {
	public static events = class {
		public static async show({
			groupId,
			eventId,
		}: {
			groupId: string
			eventId: string
		}) {
			return await fetch(
				`https://api.groupme.com/v3/conversations/${groupId}/events/show?event_id=${eventId}`,
				{ headers: { 'X-Access-Token': env.GROUPME_ACCESS_TOKEN } }
			)
				.then((res) => res.json())
				.then((data) => EventResponseSchema.parseAsync(data))
				.then((data) => data.response.event)
		}
	}
	public static messages = class {
		public static async getAllPinned(groupId: string) {
			return await fetch(
				`https://api.groupme.com/v3/pinned/groups/${groupId}/messages`,
				{ headers: { 'X-Access-Token': env.GROUPME_ACCESS_TOKEN } }
			)
				.then((res) => res.json())
				.then((data) => MessagesResponseSchema.parseAsync(data))
				.then((data) => data.response.messages)
		}
		public static async pin({
			groupId,
			messageId,
		}: {
			groupId: string
			messageId: string
		}) {
			await fetch(
				`https://api.groupme.com/v3/conversations/${groupId}/messages/${messageId}/pin`,
				{
					method: 'POST',
					headers: { 'X-Access-Token': env.GROUPME_ACCESS_TOKEN },
				}
			)
		}
		public static async unpin({
			groupId,
			messageId,
		}: {
			groupId: string
			messageId: string
		}) {
			await fetch(
				`https://api.groupme.com/v3/conversations/${groupId}/messages/${messageId}/unpin`,
				{
					method: 'POST',
					headers: { 'X-Access-Token': env.GROUPME_ACCESS_TOKEN },
				}
			)
		}
	}
}
