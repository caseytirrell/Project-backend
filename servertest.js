const request = require('supertest');
const app = require('./server');

describe('Get Endpoints', () => {

	it('health check', async () => {
		const res = await request(app)
			.get('/heath-check')
		expect(res.statusCode).toEqual(200)
		expect(res.text).toEqual('Hello!')
	});
})