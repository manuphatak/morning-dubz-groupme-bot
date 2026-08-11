import { exports } from 'cloudflare:workers'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, test, vi } from 'vitest'
import { server } from './server'

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

describe('given an event is starting message', () => {
	const unpinCommentSpy = vi.fn()

	beforeEach(() => {
		unpinCommentSpy.mockClear()
	})
	const body = {
		attachments: [
			{
				event_id: '9d0ea18bd9fd4d92be5763a05fcc0065',
				view: 'brief',
				type: 'event',
			},
		],
		avatar_url:
			'https://i.groupme.com/204x204.png.ae6fd52515e747c88db501db9e9fcfd9',
		created_at: '2026-07-22T22:34:00.000Z',
		group_id: '116072458',
		id: '178475964053833830',
		name: 'GroupMe Calendar',
		sender_id: 'calendar',
		sender_type: 'service',
		source_guid: '5bd65d20684b013f01ea1ed59e72d137',
		system: false,
		text: "'Ending v3' is starting now",
		user_id: 'calendar',
	}
	beforeEach(() => {
		server.use(
			http.get(
				'https://api.groupme.com/v3/pinned/groups/:groupId/messages',
				({ params }) =>
					HttpResponse.json({
						meta: { code: 200 },
						response: {
							count: 2,
							messages: [
								{
									attachments: [
										{
											event_id:
												'9d0ea18bd9fd4d92be5763a05fcc0065',
											view: 'full',
											type: 'event',
										},
									],
									avatar_url:
										'https://i.groupme.com/1024x1024.jpeg.a4df44ca09a84f598e8f946b753da36b',
									created_at: 1784759528,
									favorited_by: [],
									group_id: params.groupId,
									id: '178475952895339995',
									name: 'Manu Phatak',
									sender_id: '109479116',
									sender_type: 'user',
									source_guid:
										'120944e7dfd14160a8ca62a52e9564b8',
									system: false,
									text: "Manu Phatak created event 'Ending v3'",
									user_id: '109479116',
									event: {
										type: 'calendar.event.created',
										data: {
											event: {
												id: '9d0ea18bd9fd4d92be5763a05fcc0065',
												name: 'Ending v3',
											},
											original_url:
												'https://groupme.com/events/116072458/9d0ea18bd9fd4d92be5763a05fcc0065',
											url: 'https://group.me/YXT35r2rYkFUL',
											user: {
												id: '109479116',
												nickname: 'Manu Phatak',
											},
										},
									},
									platform: 'gm',
									pinned_at: 1784759529,
									pinned_by: '109479116',
								},
								{
									attachments: [
										{
											event_id:
												'e22aa9f6f77346949ac0903e7fdd116d',
											view: 'full',
											type: 'event',
										},
									],
									avatar_url:
										'https://i.groupme.com/1024x1024.jpeg.a4df44ca09a84f598e8f946b753da36b',
									created_at: 1784755657,
									favorited_by: [],
									group_id: params.groupId,
									id: '178475565773890239',
									name: 'Manu Phatak',
									sender_id: '109479116',
									sender_type: 'user',
									source_guid:
										'c3e0b981624e43baa6d7daf237fef3af',
									system: false,
									text: "Manu Phatak created event 'Fri v5'",
									user_id: '109479116',
									event: {
										type: 'calendar.event.created',
										data: {
											event: {
												id: 'e22aa9f6f77346949ac0903e7fdd116d',
												name: 'Fri v5',
											},
											original_url:
												'https://groupme.com/events/116072458/e22aa9f6f77346949ac0903e7fdd116d',
											url: 'https://group.me/4yTvYxSSR7iEKF',
											user: {
												id: '109479116',
												nickname: 'Manu Phatak',
											},
										},
									},
									platform: 'gm',
									pinned_at: 1784755658,
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
			params: { groupId: '116072458', messageId: '178475952895339995' },
			request: expect.objectContaining({ method: 'POST' }),
		})
	})
})
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
