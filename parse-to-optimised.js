var fs = require('fs'),
    get = require('./config.json'),
    mysql = require('mysql'),
    cheerio = require('cheerio'),
    Q = require('q'),
    _ = require('lodash');

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
		console.log(results);
		console.log('Retrieved raw data, processing...');

		var intermediate = {},
			categories = [];

		_.each(results[0], function (row) {

			var i, j, temp,
				obj = {};

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
					obj.image = row.image;
					obj.price = parseFloat(row.price);

					// Parse the description and sanitise the HTML
					if (
						row.description &&
						row.description.length &&
						(row.description.toLowerCase() !== 'null') &&
						(row.description.toLowerCase() !== 'undefined')
					) {

						// TEXT-BASED PROCESSING
						// First, split the description by double line breaks.
						// Those are used instead of proper paragraphs and we shall
						// return the natural way of things.
						var chunk,
							list_start = null,
							list_detected = false,
							chunk_before, chunk_after, list_chunk;

						// Those lines here replace some bizarre apostrophes and quotes
						// (which seem to be giving PHP some trouble parsing into JSON)
						// with generic equivalent, before splitting along two-line breaks.
						temp = row.description
							.replace(/‘|’|’|’/g, '&quot;')
							.replace(/“|”/g, "'")
							.split('<br><br>');

						for (i = 0; i < temp.length; i += 1) {

							// Split each chunk by linebreaks, then reduce whitespace,
							// trim redundant spaces and remove empty text nodes.
							// This will ensure proper quality and reduce chance of
							// badly-looking description.
							chunk = _(temp[i].split('<br>'))
								.map(function (str) {
									return str
										.replace(/^\s+|\s+$/g, '')    // trimming
										.replace(/\s+/g, ' '); // whitespace reduction
								})
								.compact()
								.value();

							// Traverse description in search of lists.
							// These are provided as mere linebreaks with hyphens,
							// whereas parsing and styling is easier if they're made
							// into proper lists;
							list_indicators = [];
							for (j = 0; j <= chunk.length; j += 1) {
								if ((typeof chunk[j] === 'undefined') || !chunk[j].match(/^\- /)) {
									if (list_detected) {
										list_detected = false;
										list_indicators.push([list_start, j]);
									}
								} else {
									if (!list_detected) {
										list_start = j;
										list_detected = true;
									}
								}
							}

							// If there were no lists detected, return the chunk as it is.
							// Otherwise, proceed with splitting them out of the chunk.
							if (!list_indicators.length) {
								temp[i] = chunk.join('<br>');
							} else {
								var result = [];
								list_indicators = _.flatten([0, list_indicators, chunk.length]);
								for (j = 1; j < list_indicators.length; j += 1) {
									if (j % 2) {
										result.push(chunk.slice(list_indicators[j - 1], list_indicators[j]).join('<br>'));
									} else {
										result.push('<ul>' + _.map(chunk.slice(list_indicators[j - 1], list_indicators[j]), function (line) {
											return '<li>' + line.substr(2) + '</li>';
										}).join('') + '</ul>');
									}
								}
								temp[i] = _.compact(result);
							}

						}
						// Once the chunks have been processed,
						// wrap each in a paragraph and join them together.
						temp = _(temp)
							.flatten()
							.map(function (chunk) { return '<p>' + chunk + '</p>'; })
							.value().join('');

						// PARSER-BASED PROCESSING
						var $ = cheerio.load(temp, {'ignoreWhitespace': true});

						// Remove all links that are not absolute
						$('a').each(function (index, el) {
							if (!(
								el.attribs &&
								el.attribs.href &&
								el.attribs.href.match(/^[a-z0-9]+:\/\//)
							)) { this.replaceWith(this.html()); }
						});

						// Extract lists from single-child paragraphs
						$('ul').each(function (index, el) {
							if ((el.prev === null) && (el.next === null)) {
								$(el.parent).replaceWith($(el));
							}
						});

						// Reparse the titles
						$('strong').each(function (index, el) {
							if (el.next && el.next.type === 'tag' && el.next.tag === 'br') {
								$(el.parent).before('<h3>' + this.html() + '</h3>');
								$(el.next).remove();
							}
						});

						obj.description = $.html();

					} else { obj.description = null; }

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