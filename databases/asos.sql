SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

CREATE SCHEMA IF NOT EXISTS `asos` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci ;
USE `asos` ;

-- -----------------------------------------------------
-- Table `asos`.`fashionItemsUK`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `asos`.`fashionItemsUK` ;

CREATE  TABLE IF NOT EXISTS `asos`.`fashionItemsUK` (
  `gender` VARCHAR(40) NULL,
  `price` DOUBLE NULL ,
  `category` VARCHAR(300) NULL ,
  `description` VARCHAR(3000) NULL ,
  `title` VARCHAR(140) NULL ,
  `image` VARCHAR(200) NULL ,
  `url` VARCHAR(400) NOT NULL ,
  `timestamp` VARCHAR(45) NULL )
ENGINE = InnoDB;

USE `asos` ;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
