var fs = require('fs');
var get = require('./config.json');
var mysql = require('mysql');
var Q = require('q');
var _ = require('lodash');

var connection = mysql.createConnection({
	host : get.db.host,
	user : get.db.user,
	password : get.db.pass,
	database : get.db.dbName
});
// This bit here allows the usage of ":name" placeholder format in queries
connection.config.queryFormat = function (query, values) {
  if (!values) return query;
  return query.replace(/\:(\w+)/g, function (txt, key) {
    if (values.hasOwnProperty(key)) {
      return this.escape(values[key]);
    }
    return txt;
  }.bind(this));
};
// Q utility function to convert methods with
// Node-style callbacks to return promises instead.
var query = Q.nbind(connection.query, connection);

console.log('Starting the conversion...\n==============\n')

query('SELECT * FROM fashionItemsUK LIMIT 2400')
	.then(function (results) {

		console.log('Retrieved raw data, processing...');

		var intermediate = {},
			categories = [];

		_.each(results[0], function (row) {

			var temp, obj = {};

			// Extract product ID; if ID is successfully extracted,
			// we're dealing with an actual product here.
			temp = row.url.match(/iid=([0-9]+)/);
			if (temp) {

				obj.id = parseInt(temp[1], 10);

				// Process categories into several separate ones,
				// as well as add the missing one to category storage.
				obj.categories = row.category.split('/');
				obj.categories.sort();

				categories = _.union(categories, obj.categories);

				// If the ID has not been encountered before,
				// process the rest of the data and prepare it for insertion
				if (!(obj.id in intermediate)) {

					obj.timestamp = parseInt(row.timestamp, 10);
					obj.gender = (function () {
						if (row.gender === 'Women') { return 'female'; }
						else if (row.gender === 'Men') { return 'male'; }
						else { return ''; }
					}());
					obj.name = row.title;
					obj.description = (row.description && row.description.length && (row.description !== 'null') ? row.description : null);
					obj.image = row.image;
					obj.price = parseFloat(row.price);

					intermediate[obj.id] = obj;

				}

			}

		});

		// After pre-processing raw data, pass it forward;
		// First, the categories are added. Then, the actual products are inserted
		categories.sort();
		intermediate = _.values(intermediate);

		return [categories, intermediate];

	}).then(function (data) {

		// Insert each category into the DB to ensure they will have
		// appropriate IDs when the products are inserted.
		console.log('Finished processing data. Inserting missing categories into DB...');
		return Q.all(data[0].map(function (category) {
			return query('INSERT IGNORE INTO categories (name) VALUES (:category)', {'category': category});
		})).then(function () { return data[1]; });

	}).then(function (products) {

		console.log('Scheduling insertion of all products...\n');

		var deferred = Q.defer(),
			promise = deferred.promise,
			total = products.length,
			index = 0;

		// Chunk products to ensure there's some degree of parallel
		// operations, but without trying to run all queries at the
		// same time.
		_(products)
			.groupBy(function (val, index) { return Math.floor(index / 40); })
			.each(function (product_group) {

				promise = promise.then(function () {
					return Q.all(_.map(product_group, function (product) {

						return query('INSERT INTO products (' +
							'id, timestamp, gender, ' +
							'name, image, description' +
						') VALUES (' +
							':id, FROM_UNIXTIME(:timestamp), :gender, ' +
							':name, :image, :description' +
						')', product)
							.then(function () {
								// Once the main product is in, insert the price
								// (assume GBP as currency for now)
								return query(
									'INSERT INTO product_prices (product_id, currency, price) ' +
									'VALUES (:id, \'GBP\', :price)',
									product
								);
							})
							.then(function () {
								// Top it all by inserting entries tying products to categories
								// in which they might appear, one by one (though in parallel)
								return Q.all(product.categories.map(function (category) {

									return query(
										'INSERT INTO product_categories (product_id, category_id) ' +
										'SELECT :product_id, categories.id FROM categories ' +
										'WHERE categories.name = :category',
										{'product_id': product.id, 'category': category}
									);

								}));
							})
							.then(function () { console.log('Successfully written product #' + product.id + '  ( ' + (++index) + ' / ' + total + ')'); });

					}));
				});

			});

		deferred.resolve();
		return promise;

	// .done() is used here instead of .then() to make sure errors are thrown if detected
	}).done(function () {
		console.log('\n\n========\nCOMPLETED CONVERSION');
		connection.end(function () { console.log('DB connection closed, exiting...'); });
	});