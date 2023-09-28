const request = require('supertest');
const { server, database } = require('./server');

describe('Get Endpoints', () => {
	it('Health Check Endpoint', async () => {		
		const res = await request(server).get('/health-check');
		expect(res.statusCode).toEqual(200);
		expect(res.text).toEqual('Hello!');
	});

	it('Top 5 Rented Movies Endpoint', async () => {
		const res = await request(server).get('/top-5-rented-movies');
		expect(res.statusCode).toEqual(200);
		expect(Array.isArray(res.body)).toBe(true);
		expect(res.body.length).toEqual(5);
	});

	it('Top 5 Rented Actors Endpoint', async () => {
		const res = await request(server).get('/top-5-rented-actors');
		expect(res.statusCode).toEqual(200);
		expect(Array.isArray(res.body)).toBe(true);
		expect(res.body.length).toEqual(5);
	});

	it('Search Movies Endpoint', async () => {
		const res = await request(server).get('/search-movies');
		expect(res.statusCode).toEqual(200);
		res.body.forEach(movie => {

    		expect(movie).toHaveProperty('title');
    		expect(movie).toHaveProperty('description');
    		expect(movie).toHaveProperty('rating');
    	});
	});
});

afterAll(done => {
  server.close(() => {
  	console.log('Server closed...');
  	database.end(err => {
  		if(err) {
  		console.log('Error closing the database', err);
  		}
  		else {
  		console.log('Database connection closed...');
  		}
  		done();
  	});
  });
});