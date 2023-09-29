const exp = require('express');
const cors = require('cors');
const app = exp();
const PORT = 3001;
const mySQL = require('mysql');

app.use(cors());
app.use(exp.json());

const database = mySQL.createConnection({

	host: 'localhost',
	user: 'root',
	password: 'CaseyTirrell5',
	database: 'sakila'
})

database.connect((err) => {

	if(err){
	
		throw err;
	}
	//console.log('Connected to the database');
});

app.get('/health-check', (req, res) => {
	res.send('Hello!');
});


app.get('/top-5-rented-movies', (req, res) => {

	const query = `
		SELECT film.title, film.description, category.name AS genre, COUNT(rental.rental_id) AS rental_count 
    	FROM rental 
    	JOIN inventory ON rental.inventory_id = inventory.inventory_id
    	JOIN film ON inventory.film_id = film.film_id
    	JOIN film_category ON film.film_id = film_category.film_id
    	JOIN category ON film_category.category_id = category.category_id
    	GROUP BY film.film_id, category.name
    	ORDER BY rental_count DESC
    	LIMIT 5
    	`;

	database.query(query, (err, results) => {

		if(err) {

			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		res.json(results);
	});
});

app.get('/top-5-rented-actors', (req, res) => {

	const query = `
		SELECT actor.actor_id, actor.first_name, actor.last_name, COUNT(film_actor.actor_id) AS movie_count
		FROM actor
		JOIN film_actor ON actor.actor_id = film_actor.actor_id
		GROUP BY actor.actor_id
		ORDER BY movie_count DESC
		LIMIT 5
		`;

	database.query(query, (err, results) => {

		if(err) {
			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		res.json(results);
	});
});

app.get('/actors-top-5/:actorId', (req, res) => {

	const actorId = req.params.actorId;
	const query = `
		SELECT film.title, COUNT(rental.rental_id) as rental_count
		FROM film_actor
		JOIN film ON film_actor.film_id = film.film_id
		JOIN inventory ON film.film_id = inventory.film_id
		JOIN rental ON inventory.inventory_id = rental.inventory_id
		WHERE film_actor.actor_id = ?
		GROUP BY film.film_id
		ORDER BY rental_count DESC
		LIMIT 5
		`;

	database.query(query, [actorId], (err, results) => {

		if(err) {
			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		res.json(results);
	});
});

app.get('/search-movies', (req, res) => {

	const filmName = req.query.filmName || '';
	const actorName = req.query.actorName || '';
	const genre = req.query.genre || '';

	let query = `
	SELECT DISTINCT film.* 
	FROM film
	`;
	
	const params = [];
	const clauses = [];

	if(filmName){

		clauses.push(`film.title LIKE ?`);
		params.push(`%${filmName}%`);
	}

	if(actorName) {

		const name = actorName.split(' '); 
		query += `
		LEFT JOIN film_actor ON film.film_id = film_actor.film_id
		LEFT JOIN actor ON film_actor.actor_id = actor.actor_id
		`;

		if(name.length === 1) {
		
			clauses.push(`(LOWER(actor.first_name) LIKE LOWER(?) OR LOWER(actor.last_name) LIKE LOWER(?))`);
			params.push(`%${name[0]}%`, `%${name[0]}%`);
		}
		else if (name.length >= 2) {

			clauses.push(`(LOWER(actor.first_name) LIKE LOWER(?) OR LOWER(actor.last_name) LIKE LOWER(?))`);
			params.push(`%${name[0]}%`, `%${name[1]}%`);
		}
	}

	if(genre) {

		query += `
		LEFT JOIN film_category ON film.film_id = film_category.film_id
		LEFT JOIN category ON film_category.category_id = category.category_id
		`;

		clauses.push(`category.name LIKE ?`);
		params.push(`%${genre}%`);
	}

	if(clauses.length > 0) {

		query += ` WHERE ` + clauses.join(" AND ");
	}

	database.query(query, params, (err, results) => {

		if(err) {

			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		res.json(results);
	});
});

app.post('/movie-rentals', (req, res) => {

	console.log('Received request:', req.body);
	console.log('Recieved FilmID', req.body.filmId);

	const { customerId, filmId, staffId } = req.body;

	if(!customerId || !filmId || !staffId) {

		return res.status(400).send("Missing content from the Customer ID or the Film ID..");
	}

	if(isNaN(customerId) || isNaN(filmId) || isNaN(staffId)) {

		return res.status(400).send("Missing content from the Customer ID or the Film ID..");
	}

	const inventoryQuery = `
	SELECT inventory_id
	FROM inventory
	WHERE film_id = ?
	LIMIT 1
	`;

	const query = `
	INSERT INTO rental (rental_date, inventory_id, customer_id, return_date, staff_id)
	VALUES (NOW(), ?, ?, NOW(), ?);
	`;

	database.query(inventoryQuery, [filmId], (err, results) => {

		if(err) {

			console.error(err);
			res.status(500).send("Query Error...");
			return;
		}
		const inventoryId = results[0].inventory_id;

		database.query(query, [inventoryId, customerId, staffId], (err, results) => {

			if(err) {

				console.error("Fetching Error: ", err);
				res.status(500).send("Query Error...");
				return;
			}
			console.log('Query Results', results);
			res.status(200).send("Successfully rented...");
		});
	})

});

app.get('/all-customers', (req, res) => {

	const query = `
	SELECT *
	FROM customer
	`;

	database.query(query, (err, results) => {

		if(err) {

			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		res.json(results);
	});
});

app.get('/search-customers', (req, res) => {
	const customerID = req.query.customerID || '';
	const customerName = req.query.customerName || '';

	let query = `
	SELECT DISTINCT customer.*
	FROM customer
	`;

	const params = [];
	const clauses = [];

	if(customerID) {

		clauses.push(`customer_id = ?`);
		params.push(customerID);
	}
	
	if(customerName) {

		const name = customerName.split(' ');
		if(name.length === 1) {
		
			clauses.push(`(LOWER(customer.first_name) LIKE LOWER(?) OR LOWER(customer.last_name) LIKE LOWER(?))`);
			params.push(`%${name[0]}%`, `%${name[0]}%`);
		}
		else if (name.length >= 2) {

			clauses.push(`(LOWER(customer.first_name) LIKE LOWER(?) AND LOWER(customer.last_name) LIKE LOWER(?))`);
			params.push(`%${name[0]}%`, `%${name[1]}%`);
		}
	}
	
	if(clauses.length > 0) {
		query += ` WHERE ` + clauses.join(" AND ");
	}

	database.query(query, params, (err, results) => {
		if(err) {
			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		res.json(results);
	});
});

app.get('/customer-rentals/:customerId', (req, res) => {

	const customerId = req.params.customerId;

	const query = `
	SELECT film.title, COUNT(rental.rental_id) as customer_rental_count
	FROM rental
	INNER JOIN inventory ON rental.inventory_id = inventory.inventory_id
	INNER JOIN film ON inventory.film_id = film.film_id
	WHERE rental.customer_id = ?
	GROUP BY film.title
	ORDER BY customer_rental_count DESC
	`; 

	const totalQuery = `
	SELECT COUNT(DISTINCT rental.rental_id) as total_rentals
	FROM rental
	WHERE rental.customer_id = ?
	`;

	database.query(totalQuery, [customerId], (err, countResults) => {

		if(err) {
			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
	

		database.query(query, [customerId], (err, results) => {

			if(err) {
				console.error("Fetching Error: ", err);
				res.status(500).send("Query Error...");
				return;
			}
			res.json({

				totalCount: countResults[0].total_rentals,
				movies: results.map(movie => ({
					title: movie.title
				}))
			});
		});
	});	
});

app.listen(PORT, () => {
	console.log(`Server is running on ${PORT}`);
});

//module.exports = { app, server, database };
