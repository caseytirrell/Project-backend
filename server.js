const exp = require('express');
const cors = require('cors');
const app = exp();
const PORT = 3001;
const mySQL = require('mysql');
const PDF = require('pdfkit');
const fs = require('fs');

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

	const indexQuery = `
	SHOW INDEXES FROM address
	WHERE Column_name=\'location\'
	`;

	database.query(indexQuery, (err, results) => {

		if(err) {

			console.error('Fetching Index Error: ', err);
			return;
		}
		if(results && results.length > 0) {

			const indexName = results[0].Key_name;

			const dropQuery = `
			ALTER TABLE address
			DROP INDEX ${indexName}
			`;

			database.query(dropQuery, (err, results) => {
				if(err) {

					console.error("Dropping Index Error: ", err);
					return;
				}
				alterLocationColumn();
			});
		}
		else {

			alterLocationColumn();
		}
	});
});

const alterLocationColumn = () => {

	const alterTableQuery = `
	ALTER TABLE address
	MODIFY COLUMN location BLOB NULL
	`;

	database.query(alterTableQuery, (err, results) => {

		if(err) {

			console.error("Altered Table Error: ", err);
			return;
		}
		console.log('Table altercation worked...');
	});
};

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

app.get('/generate-customer-report', (req, res) => {

	let fName = "customer_rental_report";
	const name = 'Rental Report';

	const query = `
	SELECT customer.first_name, customer.last_name, COUNT(rental.rental_id) AS rental_count
	FROM customer
	JOIN rental on customer.customer_id = rental.customer_id
	GROUP BY customer.customer_id
	ORDER BY rental_count DESC
	`;

	database.query(query, (err, results) => {

		if(err) {
			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		
		const PDFdoc = new PDF();

		res.setHeader('Content-disposition', 'attachment; filename="' + fName + '"');
		res.setHeader('Content-type', 'application/pdf');

		PDFdoc.fontSize(20).text(name, 50, 50);
		PDFdoc.moveDown();

		results.forEach((customer) => {

			PDFdoc.fontSize(15).text(`${customer.first_name} ${customer.last_name} ${customer.rental_count} rentals`);
			PDFdoc.moveDown();
		});

		PDFdoc.pipe(res);
		PDFdoc.end();
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
	VALUES (NOW(), ?, ?, null, ?);
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

app.get('/current-rentals/:filmId', (req, res) => {

	const filmId = req.params.filmId;

	const query = `
	SELECT customer.*
	FROM customer
	JOIN rental ON customer.customer_id = rental.customer_id
	JOIN inventory ON rental.inventory_id = inventory.inventory_id
	WHERE inventory.film_id = ? AND rental.return_date IS NULL
	`;

	database.query(query, [filmId], (err, results) => {

		if(err) {

			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		console.log(results);
		res.json(results);
	});
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

app.post('/return-movie', (req, res) => {

	console.log("Received request body:", req.body)

	const { customerId, filmId } = req.body;

	if(!customerId || !filmId) {

		res.status(400).json({error: 'Missing content from the Customer ID or Film ID...'});
		return;
	}

	const query = `
	UPDATE rental
	SET return_date = NOW()
	WHERE customer_id = ?
	AND inventory_id IN (SELECT inventory_id FROM inventory WHERE film_id = ?)
	AND return_date IS NULL;
	`;

	database.query(query, [customerId, filmId], (err, results) => {

		if(err) {

			console.error("Fetching Error: ", err);
			res.status(500).send("Query Error...");
			return;
		}
		res.json(results)
	})
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

app.post('/new-customer', (req, res) => {

	console.log(req.body);
	const { storeId, firstName, lastName, email, phone, address, city, district, country } = req.body;

	if(!storeId || !firstName || !lastName || !email || !phone || !address || !city || !district || !country) {

		return res.status(400).send("Missing content that needs to be entered..");
	}

	const countryQuery = `
	INSERT INTO country (country)
	VALUES (?)
	ON DUPLICATE KEY UPDATE country_id=LAST_INSERT_ID(country_id), country=?
	`;

	const cityQuery = `
	INSERT INTO city (city, country_id)
	VALUES (?, ?)
	ON DUPLICATE KEY UPDATE city_id=LAST_INSERT_ID(city_id), city=?, country_id=?
	`;

	const addressQuery = `
	INSERT INTO address (address, district, city_id, phone)
	VALUES (?, ?, ?, ?)
	`;

	const query = `
	INSERT INTO customer (store_id, first_name, last_name, email, address_id)
	VALUES (?, ?, ?, ?, ?)
	`;


	database.query(countryQuery, [country, country], (err, countryResults) => {

		if(err) {

			console.error("Insertion Error (country): ", err);
			res.status(500).send("Query Error...");
			return;
		}
		console.log('Country Insert ID:', countryResults.insertId);

		const countryId = countryResults.insertId;
		database.query(cityQuery, [city, countryId, city, countryId], (err, cityResults) => {

			if(err) {

				console.error("Insertion Error (city): ", err);
				res.status(500).send("Query Error...");
				return;
			}
			console.log('City Insert ID:', cityResults.insertId);

			const cityId = cityResults.insertId;
			database.query(addressQuery, [address, district, cityId, phone], (err, addressResults) => {

				if(err) {
					console.error("Insertion Error (address): ", err);
					res.status(500).send("Query Error...");
					return;
				}

				console.log('Address Insert ID:', addressResults.insertId);

				const addressId = addressResults.insertId;
				database.query(query, [storeId, firstName, lastName, email, addressId], (err, results) => {

					if(err) {
						console.error("Insertion Error (address): ", err);
						res.status(500).send("Query Error...");
						return;
					}

					console.log('Results:', results.insertId);

					res.status(200).send('Customer added...');
				});
			});
		});
	});
});

app.delete('/delete-customer', (req, res) => {

	const customer = req.body;
	const query = ``;
	const params = [];

	if(customer.customer_id) {

		query = `
		DELETE FROM customer
		WHERE customer_id = ?
		`;
		params = [customer.customer_id];
	}
	else if(customer.first_name && customer.last_name) {

		query = `
		DELETE FROM customer
		WHERE first_name = ? AND last_name = ?
		LIMIT 1
		`;
		params = [customer.first_name, customer.last_name];
	}
	else {

		return res.status(400).send("Missing Info...");
	}

	database.query(query, params, (err, results) => {

		if(err) {

			console.error("Deleteion Error: ", err);
			res.status(500).send("Query Error...");
			return
		}
		if(results.affectedRows === 0) {

			return res.status(404).send("Customer not found...");
		}

		return res.status(200).send('Deleted Customer...');
	});
});

app.put('/update-customer/:customerId', (req, res) => {
	console.log(req.params);
	console.log(req.body);

    const customerId = req.params.customerId;
    const updatedData = req.body;

    const countryQuery = `
        INSERT INTO country (country)
        VALUES (?)
        ON DUPLICATE KEY UPDATE country_id=LAST_INSERT_ID(country_id), country=?
    `;

    const cityQuery = `
        INSERT INTO city (city, country_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE city_id=LAST_INSERT_ID(city_id), city=?, country_id=?
    `;

    const addressQuery = `
        INSERT INTO address (address, district, city_id, phone)
    	VALUES (?, ?, ?, ?)
    	ON DUPLICATE KEY UPDATE address_id=LAST_INSERT_ID(address_id), address=VALUES(address), district=VALUES(district), city_id=VALUES(city_id), phone=VALUES(phone);
    `;

    const customerQuery = `
        UPDATE customer 
        SET first_name = ?, last_name = ?, email = ?, address_id = ?
        WHERE customer_id = ?
    `;

    database.query(countryQuery, [updatedData.country, updatedData.country], (err, countryResults) => {
        if (err) {
            console.error("Country Error: ", err);
            return res.status(500).send("Country Query Error");
        }

        const countryId = countryResults.insertId;
        
        database.query(cityQuery, [updatedData.city, countryId, updatedData.city, countryId], (err, cityResults) => {
            if (err) {
                console.error("City Error: ", err);
                return res.status(500).send("City Query Error");
            }

            const cityId = cityResults.insertId;

            database.query(addressQuery, [updatedData.address, updatedData.district, cityId, updatedData.phone, updatedData.address, updatedData.district, cityId, updatedData.phone], (err, addressResults) => {
                if (err) {
                    console.error("Address Error: ", err);
                    return res.status(500).send("Address Query Error");
                }

                const addressId = addressResults.insertId;

                database.query(customerQuery, [updatedData.firstName, updatedData.lastName, updatedData.email, addressId, customerId], (err, results) => {
                    if (err) {
                        console.error("Customer Update Error: ", err);
                        return res.status(500).send("Customer Update Error");
                    }

                    return res.status(200).send("Customer Updated Successfully");
                });
            });
        });
    });
});


const server = app.listen(PORT, () => {
	console.log(`Server is running on ${PORT}`);
});

module.exports = { app, server, database };
