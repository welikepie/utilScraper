SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;

SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;

SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';



CREATE SCHEMA IF NOT EXISTS `eatSoup` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci ;

USE `eatSoup` ;



-- -----------------------------------------------------

-- Table `mydb`.`dailySoup`

-- -----------------------------------------------------

CREATE  TABLE IF NOT EXISTS `eatSoup`.`dailySoup` (

  `day` INT NOT NULL ,

  `type` VARCHAR(100) NULL ,

  `description` VARCHAR(200) NULL ,

  PRIMARY KEY (`day`) )

ENGINE = InnoDB;



USE `eatSoup` ;





SET SQL_MODE=@OLD_SQL_MODE;

SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;

SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;


