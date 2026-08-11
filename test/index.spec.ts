import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import worker from '../src/index'

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

describe('given an event is starting message', () => {
	const body = {
		attachments: [
			{
				event_id: 'e22aa9f6f77346949ac0903e7fdd116d',
				view: 'brief',
				type: 'event',
			},
		],
		avatar_url:
			'https://i.groupme.com/204x204.png.ae6fd52515e747c88db501db9e9fcfd9',
		created_at: '2026-07-24T11:59:01.000Z',
		group_id: '116072458',
		id: '178489434135707461',
		name: 'GroupMe Calendar',
		sender_id: 'calendar',
		sender_type: 'service',
		source_guid: 'fbc828e06984013f3182425eb3f39ddd',
		system: false,
		text: "'Fri v5' is starting now",
		user_id: 'calendar',
		__IMTMETHOD__: 'POST',
	}

	it('responds with a 200 status', async () => {
		const response = await SELF.fetch('https://example.com', {
			method: 'POST',
			body: JSON.stringify(body),
		})
		expect(response.status).toBe(200)
	})
	it('responds with a 200 status', async () => {
		const response = await SELF.fetch('https://example.com', {
			method: 'POST',
			body: JSON.stringify(body),
		})
		expect(response.status).toBe(200)
	})
})
