CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name varchar(255) NOT NULL UNIQUE,
    email varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL NOT EMPTY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);