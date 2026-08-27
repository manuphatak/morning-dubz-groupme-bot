import { env, exports } from 'cloudflare:workers'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, test, vi } from 'vitest'
import { server } from './server'

describe('given an event is canceled', () => {
	const unpinCommentSpy = vi.fn()

	beforeEach(() => {
		unpinCommentSpy.mockClear()
	})
	const body = {
		attachments: [
			{
				event_id: 'a1a3470d77be4e6792649628e6f526da',
				view: 'brief',
				type: 'event',
			},
		],
		avatar_url: null,
		created_at: '2026-08-11T21:44:01.000Z',
		group_id: '116072458',
		id: '178648464127430125',
		name: 'GroupMe',
		sender_id: 'system',
		sender_type: 'system',
		source_guid: 'b066021077fb013f63303216f4a20974',
		system: true,
		text: "Manu Phatak canceled 'Wed am'",
		user_id: '0',
	}
	beforeEach(() => {
		server.use(
			http.get(
				'https://api.groupme.com/v3/pinned/groups/:groupId/messages',
				({ params }) =>
					HttpResponse.json({
						meta: {
							code: 200,
						},
						response: {
							count: 1,
							messages: [
								{
									attachments: [
										{
											event_id:
												'a1a3470d77be4e6792649628e6f526da',
											view: 'full',
											type: 'event',
										},
									],
									avatar_url:
										'https://i.groupme.com/1024x1024.jpeg.a4df44ca09a84f598e8f946b753da36b',
									created_at: 1786478175,
									favorited_by: [],
									group_id: params.groupId,
									id: '178647817512111235',
									name: 'Manu Phatak',
									sender_id: '109479116',
									sender_type: 'user',
									source_guid:
										'0fd1b475b6a54d63895107291cdfc8a7',
									system: false,
									text: "Manu Phatak created event 'Wed am'",
									user_id: '109479116',
									event: {
										type: 'calendar.event.created',
										data: {
											event: {
												id: 'a1a3470d77be4e6792649628e6f526da',
												name: 'Wed am',
											},
											original_url:
												'https://groupme.com/events/116072458/a1a3470d77be4e6792649628e6f526da',
											url: 'https://group.me/130VcXXRKp6WYC',
											user: {
												id: '109479116',
												nickname: 'Manu Phatak',
											},
										},
									},
									platform: 'gm',
									pinned_at: 1786478175,
									pinned_by: '109479116',
								},
							],
						},
					})
			)
		)

		server.use(
			http.post(
				'https://api.groupme.com/v3/conversations/:groupId/messages/:messageId/unpin',
				({ params, request }) => {
					unpinCommentSpy({ params, request })
					return HttpResponse.json({
						data: { meta: { code: 200 }, response: null },
						statusCode: 200,
					})
				}
			)
		)
	})

	it('responds with a 200 status', async () => {
		const response = await exports.default.fetch('https://example.com', {
			method: 'POST',
			body: JSON.stringify(body),
		})
		expect(response.status).toBe(200)
	})
	it('unpins the event', async () => {
		await exports.default.fetch('https://example.com', {
			method: 'POST',
			body: JSON.stringify(body),
		})
		expect(unpinCommentSpy).toHaveBeenCalledWith({
			params: { groupId: '116072458', messageId: '178647817512111235' },
			request: expect.objectContaining({ method: 'POST' }),
		})
	})
})
describe('given an event is created', () => {
	const pinCommentSpy = vi.fn()
	beforeEach(() => {
		pinCommentSpy.mockClear()
	})
	const body = {
		attachments: [
			{
				event_id: 'a1a3470d77be4e6792649628e6f526da',
				view: 'full',
				type: 'event',
			},
		],
		avatar_url:
			'https://i.groupme.com/1024x1024.jpeg.a4df44ca09a84f598e8f946b753da36b',
		created_at: '2026-08-11T19:56:15.000Z',
		group_id: '116072458',
		id: '178647817512111235',
		name: 'Manu Phatak',
		sender_id: '109479116',
		sender_type: 'user',
		source_guid: '0fd1b475b6a54d63895107291cdfc8a7',
		system: false,
		text: "Manu Phatak created event 'Wed am'",
		user_id: '109479116',
		__IMTMETHOD__: 'POST',
	}
	beforeEach(() => {
		server.use(
			http.post(
				'https://api.groupme.com/v3/conversations/:groupId/messages/:messageId/pin',
				({ params, request }) => {
					pinCommentSpy({ params, request })
					return HttpResponse.json({
						data: { meta: { code: 200 }, response: null },
						statusCode: 200,
					})
				}
			)
		)

		server.use(
			http.get(
				`https://api.groupme.com/v3/conversations/:groupId/events/show`,
				({ params, request }) => {
					const url = new URL(request.url)
					const eventId = url.searchParams.get('event_id')

					return HttpResponse.json({
						meta: { code: 200 },
						response: {
							event: {
								name: 'Fri',
								start_at: '2026-08-28T07:00:00-05:00',
								end_at: '2026-08-28T09:05:00-05:00',
								is_all_day: false,
								timezone: 'America/Chicago',
								scheduled_call: false,
								reminders: [],
								end_at_set: true,
								aesthetics: {
									font: 'classic',
									theme: 'NONE',
									effect: 'NONE',
								},
								call_started: false,
								conversation_id: '101200928',
								event_id: eventId,
								creator_id: '13497478',
								going: ['16550925', '20609438', '13497478'],
								not_going: [],
								maybe_going: [],
								going_count: 3,
								created_at: '2026-08-27T13:32:46Z',
								updated_at: '2026-08-27T15:42:03Z',
								rsvp_list: {
									'13497478': '2026-08-27T13:32:46Z',
									'16550925': '2026-08-27T13:47:03Z',
									'20609438': '2026-08-27T15:42:03Z',
								},
								rsvp_sources: {
									'16550925': 'instance',
									'20609438': 'instance',
								},
								share_url:
									'https://groupme.com/join_event/101200928/20440ee6590848f38584522d90adcea3/2DqnZwXl',
								deep_link_ios:
									'groupme://join_event/101200928/20440ee6590848f38584522d90adcea3/2DqnZwXl',
								deep_link_android:
									'groupme://groupme.com/join_event/101200928/20440ee6590848f38584522d90adcea3/2DqnZwXl',
								share_qr_code:
									'https://image.groupme.com/qr/events/101200928/20440ee6590848f38584522d90adcea3/preview/token/2DqnZwXl',
								is_top_level: false,
								waitlisted: [],
							},
						},
					})
				}
			)
		)
	})

	it('responds with a 200 status', async () => {
		const response = await exports.default.fetch('https://example.com', {
			method: 'POST',
			body: JSON.stringify(body),
		})
		expect(response.status).toBe(200)
	})
	it('pins the event', async () => {
		await exports.default.fetch('https://example.com', {
			method: 'POST',
			body: JSON.stringify(body),
		})

		expect(pinCommentSpy).toHaveBeenCalledWith({
			params: { groupId: '116072458', messageId: '178647817512111235' },
			request: expect.objectContaining({ method: 'POST' }),
		})
	})
})

describe('given an event is updated', () => {
	let requestCount = 0

	beforeEach(() => {
		requestCount = 0
	})
	const body = {
		attachments: [
			{
				event_id: 'd2d304ead6cc4c52bf5221cb7ae01775',
				view: 'brief',
				type: 'event',
			},
		],
		avatar_url:
			'https://i.groupme.com/204x204.png.ae6fd52515e747c88db501db9e9fcfd9',
		created_at: 1787861357,
		group_id: '116072458',
		id: '178786135763974982',
		name: 'GroupMe Calendar',
		sender_id: 'calendar',
		sender_type: 'service',
		source_guid: '1b4c2fb08481013fc04d0a820081a5c1',
		system: false,
		text: "Manu Phatak updated the time for the event 'Now 3'",
		user_id: 'calendar',
	}
	const createEventBody = {
		attachments: [
			{
				event_id: 'd2d304ead6cc4c52bf5221cb7ae01775',
				view: 'full',
				type: 'event',
			},
		],
		avatar_url:
			'https://i.groupme.com/1024x1024.jpeg.a4df44ca09a84f598e8f946b753da36b',
		created_at: '2026-08-11T19:56:15.000Z',
		group_id: '116072458',
		id: '178647817512111235',
		name: 'Manu Phatak',
		sender_id: '109479116',
		sender_type: 'user',
		source_guid: '0fd1b475b6a54d63895107291cdfc8a7',
		system: false,
		text: "Manu Phatak created event 'Wed am'",
		user_id: '109479116',
	}
	beforeEach(async () => {
		server.use(
			http.post(
				'https://api.groupme.com/v3/conversations/:groupId/messages/:messageId/pin',
				({ params, request }) =>
					HttpResponse.json({
						data: { meta: { code: 200 }, response: null },
						statusCode: 200,
					})
			)
		)

		server.use(
			http.get(
				`https://api.groupme.com/v3/conversations/:groupId/events/show`,
				({ params, request }) => {
					requestCount++

					const url = new URL(request.url)
					const eventId = url.searchParams.get('event_id')

					const start_at =
						requestCount === 1
							? '2026-08-28T07:00:00-05:00'
							: '2026-08-28T09:00:00-05:00'

					return HttpResponse.json({
						meta: { code: 200 },
						response: {
							event: {
								name: 'Fri',
								start_at,
								end_at: '2026-08-28T09:05:00-05:00',
								is_all_day: false,
								timezone: 'America/Chicago',
								scheduled_call: false,
								reminders: [],
								end_at_set: true,

								call_started: false,
								conversation_id: '101200928',
								event_id: eventId,
								creator_id: '13497478',
								going: [],
								not_going: [],
								maybe_going: [],
								going_count: 3,
								created_at: '2026-08-27T13:32:46Z',
								updated_at: '2026-08-27T15:42:03Z',
								rsvp_list: {},
								rsvp_sources: {},
								share_url:
									'https://groupme.com/join_event/101200928/20440ee6590848f38584522d90adcea3/2DqnZwXl',
								deep_link_ios:
									'groupme://join_event/101200928/20440ee6590848f38584522d90adcea3/2DqnZwXl',
								deep_link_android:
									'groupme://groupme.com/join_event/101200928/20440ee6590848f38584522d90adcea3/2DqnZwXl',
								share_qr_code:
									'https://image.groupme.com/qr/events/101200928/20440ee6590848f38584522d90adcea3/preview/token/2DqnZwXl',
								is_top_level: false,
								waitlisted: [],
							},
						},
					})
				}
			)
		)
	})

	it('responds with a 200 status', async () => {
		await exports.default.fetch('https://example.com/1', {
			method: 'POST',
			body: JSON.stringify(createEventBody),
		})
		const response = await exports.default.fetch('https://example.com/1', {
			method: 'POST',
			body: JSON.stringify(body),
		})
		expect(response.status).toBe(200)
	})
	it('has initial state (debug helper)', async () => {
		await exports.default.fetch('https://example.com/2', {
			method: 'POST',
			body: JSON.stringify(createEventBody),
		})
		const unpinManager = env.UNPIN_MANAGER.getByName('/2')

		expect(await unpinManager._getState()).toEqual(
			new Map(
				Object.entries({
					'event:d2d304ead6cc4c52bf5221cb7ae01775': {
						eventId: 'd2d304ead6cc4c52bf5221cb7ae01775',
						groupId: '116072458',
						messageId: '178647817512111235',
						runAt: 1787918400000,
					},
				})
			)
		)
	})
	it('updates the runAt time', async () => {
		await exports.default.fetch('https://example.com/3', {
			method: 'POST',
			body: JSON.stringify(createEventBody),
		})
		const unpinManager = env.UNPIN_MANAGER.getByName('/3')

		await exports.default.fetch('https://example.com/3', {
			method: 'POST',
			body: JSON.stringify(body),
		})

		expect(await unpinManager._getState()).toEqual(
			new Map(
				Object.entries({
					'event:d2d304ead6cc4c52bf5221cb7ae01775': {
						eventId: 'd2d304ead6cc4c52bf5221cb7ae01775',
						groupId: '116072458',
						messageId: '178647817512111235',
						runAt: 1787925600000,
					},
				})
			)
		)
	})
})
