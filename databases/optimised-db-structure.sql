-- MAIN PRODUCT STORAGE
-- Storage of core one-by-one data for the product.
-- ID by which the product is identified, along with time of latest modification.
-- Gender for which the product is designated (can be null, indicating no preference),
-- title and description, as well as URL to the image.
-- Categories and prices are in separate, linked tables and URL can be easily reconstructed.

CREATE TABLE `products` (
  `id` bigint(20) unsigned NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gender` enum('male','female') NULL,
  `name` varchar(255) NOT NULL,
  `image` text NOT NULL,
  `description` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `product_groups` (
  `group_id` int(10) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`group_id`, `product_id`),
  KEY `product_fk_idx` (`product_id`),
  CONSTRAINT `product_group_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Category listing
CREATE TABLE `categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Glue table for many-to-many off products and categories
CREATE TABLE `product_categories` (
  `product_id` bigint(20) unsigned NOT NULL,
  `category_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`product_id`,`category_id`),
  KEY `product_fk_idx` (`product_id`),
  KEY `category_fk_idx` (`category_id`),
  CONSTRAINT `product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `category_fk` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Product prices
CREATE TABLE `product_prices` (
  `product_id` bigint(20) unsigned NOT NULL,
  `currency` char(3) NOT NULL,
  `price` decimal(8,4) NOT NULL DEFAULT '0.0000',
  PRIMARY KEY (`product_id`,`currency`),
  KEY `product_price_fk_idx` (`product_id`),
  CONSTRAINT `product_price_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;