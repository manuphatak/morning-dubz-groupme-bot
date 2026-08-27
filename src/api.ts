import { env } from 'cloudflare:workers'

import z from 'zod'
import { logger } from './logger'
import { MessageSchema } from './schema'

const MessagesResponseSchema = z.object({
	response: z.object({
		messages: z.array(MessageSchema),
	}),
})
export class GroupMeApi {
	static async pinEvent({
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

		logger.info({ groupId, messageId }, 'Action: Event was pinned')
	}

	static async unpinEvent({
		groupId,
		eventId,
	}: {
		groupId: string
		eventId: string
	}) {
		const pinnedMessages = await fetch(
			`https://api.groupme.com/v3/pinned/groups/${groupId}/messages`,
			{ headers: { 'X-Access-Token': env.GROUPME_ACCESS_TOKEN } }
		)
			.then((res) => res.json())
			.then((data) => MessagesResponseSchema.parseAsync(data))
			.then((data) => data.response.messages)

		logger.debug(
			{ pinnedMessages, groupId, eventId },
			`${pinnedMessages.length} pinned message${pinnedMessages.length === 1 ? '' : 's'} retrieved`
		)

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

		await fetch(
			`https://api.groupme.com/v3/conversations/${groupId}/messages/${matchedMessage.id}/unpin`,
			{
				method: 'POST',
				headers: { 'X-Access-Token': env.GROUPME_ACCESS_TOKEN },
			}
		)

		logger.info(
			{ groupId, messageId: matchedMessage.id, eventId },
			'Action: Event was unpinned'
		)
	}
}
