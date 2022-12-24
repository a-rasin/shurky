CREATE TABLE IF NOT EXISTS BOOKS (
    id     INT       NOT NULL AUTO_INCREMENT,
    sales  INT       NOT NULL,
    title  CHAR(255) NOT NULL,
    author CHAR(255) NOT NULL,
    price  DECIMAL   NOT NULL,
    PRIMARY KEY (id)
);


insert into BOOKS(sales, title, author, price) values(10, "A Time to Kill Bill", "John Grisham", "100");
insert into BOOKS(sales, title, author, price) values(20, "Blood and Smoke", "Stephen King", "1000");
insert into BOOKS(sales, title, author, price) values(30, "The Rainmaker", "John Grisham", "-200");
insert into BOOKS(sales, title, author, price) values(40, "The Painmaker >:)", "The pain man", "4200");


CREATE TABLE IF NOT EXISTS USERS (
    id     INT       NOT NULL AUTO_INCREMENT,
    name  CHAR(255) NOT NULL,
    phone CHAR(255) NOT NULL,
    visitorType  INT   NOT NULL,
    password CHAR(200),
    publicKey TEXT,
    raw_id BLOB,
    PRIMARY KEY (id),
    FOREIGN KEY (visitorType) REFERENCES USER_TYPES(id)
);

CREATE TABLE IF NOT EXISTS USER_TYPES (
    id     INT       NOT NULL AUTO_INCREMENT,
    name  CHAR(255) NOT NULL,
    PRIMARY KEY (id)
);

insert into USER_TYPES(name) values("Emlpoyer / Business"), ("NOVA Participant"), ("NOVA staff"), ("Other"), ("Random");
